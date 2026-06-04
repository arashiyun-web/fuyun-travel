from __future__ import annotations

import re
from typing import Any


def _has_any(text: str, keywords: list[str]) -> bool:
    return any(keyword in text for keyword in keywords)


def _passenger_count(text: str) -> int | None:
    match = re.search(r"(\d{1,3})\s*(人|位)", text)
    return int(match.group(1)) if match else None


def analyze(message: str) -> dict[str, Any]:
    text = (message or "").strip()
    normalized = text.lower()
    passenger_count = _passenger_count(text)
    is_airport = _has_any(text, ["機場", "桃園機場", "松山機場", "航班", "航廈"])
    is_multi_day = _has_any(text, ["多日", "二日", "兩天", "三天", "住宿", "隔夜"])
    is_round_taiwan = _has_any(text, ["環島", "全台一圈", "繞台灣"])
    is_one_day = _has_any(text, ["一天", "一日", "當天", "單日"])
    has_big_luggage = _has_any(text, ["大行李", "行李箱", "大件行李", "每人一個大行李", "每人一件大行李"])
    asks_legal = _has_any(text, ["合法", "旅行社", "甲種", "履約", "品保", "註冊"])
    mentions_44_45_bus = bool(re.search(r"(44|45)\s*座", text)) or _has_any(text, ["大巴", "大型巴士", "遊覽車"])
    needs_luggage_warning = mentions_44_45_bus and (has_big_luggage or is_airport or is_multi_day or is_round_taiwan)

    missing_fields: list[str] = []
    if not re.search(r"\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}/\d{1,2}|\d{1,2}月\d{1,2}日", text):
        missing_fields.append("日期")
    if passenger_count is None:
        missing_fields.append("人數")
    if not _has_any(text, ["行李", "背包", "行李箱"]):
        missing_fields.append("行李件數")
    if not _has_any(text, ["到", "→", "->", "接送", "出發", "目的地", "路線", "板橋", "宜蘭", "台北", "桃園"]):
        missing_fields.append("路線")

    return {
        "message": text,
        "passenger_count": passenger_count,
        "is_airport": is_airport,
        "is_multi_day": is_multi_day,
        "is_round_taiwan": is_round_taiwan,
        "is_one_day_round_taiwan": is_round_taiwan and is_one_day,
        "has_big_luggage": has_big_luggage,
        "mentions_44_45_bus": mentions_44_45_bus,
        "needs_luggage_warning": needs_luggage_warning,
        "asks_legal": asks_legal,
        "missing_fields": missing_fields,
        "intent": "quote" if _has_any(normalized, ["包車", "報價", "詢價", "接送", "機場", "遊覽車"]) else "customer_service",
    }
