from __future__ import annotations

from pathlib import Path
from typing import Any

import yaml


class RagService:
    def __init__(self, knowledge_dir: str | Path | None = None) -> None:
        self.knowledge_dir = Path(knowledge_dir or Path(__file__).resolve().parent.parent / "knowledge_base")
        self.knowledge = self._load_yaml()

    def _load_yaml(self) -> dict[str, Any]:
        merged: dict[str, Any] = {}
        if not self.knowledge_dir.exists():
            return merged
        for path in sorted(self.knowledge_dir.glob("*.y*ml")):
            data = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
            if isinstance(data, dict):
                merged.update(data)
        return merged


    def document_count(self) -> int:
        count = 0
        for path in self.knowledge_dir.glob("*.y*ml"):
            data = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
            if isinstance(data, list):
                count += len(data)
            elif isinstance(data, dict):
                count += 1
        return count

    def as_context(self, message: str, analysis: dict[str, Any] | None = None) -> str:
        analysis = analysis or {}
        rules: list[str] = []
        company = self.knowledge.get("company", {})
        quote_rules = self.knowledge.get("quote_rules", {})
        trip_rules = self.knowledge.get("trip_rules", {})
        bus_rules = self.knowledge.get("bus_rules", {})
        price_examples = self.knowledge.get("price_examples", {})

        if company.get("language"):
            rules.append(company["language"])
        if quote_rules.get("no_official_price"):
            rules.append(quote_rules["no_official_price"])
        if quote_rules.get("work_hours"):
            rules.append(quote_rules["work_hours"])
        if analysis.get("asks_legal") and company.get("legal_identity"):
            rules.append(company["legal_identity"])
        if analysis.get("is_one_day_round_taiwan") and trip_rules.get("round_taiwan_one_day_block"):
            rules.append(trip_rules["round_taiwan_one_day_block"])
        if analysis.get("needs_luggage_warning") and bus_rules.get("luggage_limit_44_45"):
            rules.append(bus_rules["luggage_limit_44_45"])
        if price_examples.get("charter"):
            rules.append(price_examples["charter"])
        if price_examples.get("airport") and analysis.get("is_airport"):
            rules.append(price_examples["airport"])
        if company.get("closing"):
            rules.append(company["closing"])

        return "\n".join(f"- {rule}" for rule in rules)


rag_service = RagService()
