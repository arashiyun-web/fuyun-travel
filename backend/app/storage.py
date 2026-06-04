from __future__ import annotations

import os
import uuid
from copy import deepcopy
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any

try:
    import psycopg
    from psycopg.rows import dict_row
    from psycopg.types.json import Json
except Exception:  # pragma: no cover - handled at runtime
    psycopg = None
    dict_row = None
    Json = None


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _database_url() -> str | None:
    value = os.getenv("DATABASE_URL")
    if not value:
        return None
    cleaned = value.strip().strip('"').strip("'").strip()
    return cleaned or None


def _row_to_dict(row: Any) -> dict[str, Any] | None:
    if row is None:
        return None
    data = dict(row)
    if data.get("quote_options") is None:
        data["quote_options"] = []
    if data.get("draft_json") is None:
        data["draft_json"] = {}
    return data


@dataclass
class MemoryState:
    sessions: dict[str, dict[str, Any]] = field(default_factory=dict)
    quotes: list[dict[str, Any]] = field(default_factory=list)


class QuoteStore:
    def __init__(self) -> None:
        self.database_url = _database_url()
        self._memory = MemoryState()

    def reset(self) -> None:
        self._memory = MemoryState()

    def _use_db(self) -> bool:
        return bool(self.database_url and psycopg is not None)

    def get_session(self, user_id: str) -> dict[str, Any] | None:
        if self._use_db():
            with psycopg.connect(self.database_url) as conn:  # type: ignore[arg-type]
                conn.row_factory = dict_row
                with conn.cursor() as cur:
                    cur.execute(
                        'SELECT user_id, state, draft_json, updated_at FROM line_sessions WHERE user_id = %s',
                        (user_id,),
                    )
                    return _row_to_dict(cur.fetchone())
        session = self._memory.sessions.get(user_id)
        return deepcopy(session) if session else None

    def upsert_session(self, user_id: str, state: str, draft_json: dict[str, Any]) -> dict[str, Any]:
        payload = {
            "user_id": user_id,
            "state": state,
            "draft_json": deepcopy(draft_json),
            "updated_at": _utcnow().isoformat(),
        }
        if self._use_db():
            with psycopg.connect(self.database_url) as conn:  # type: ignore[arg-type]
                with conn.cursor() as cur:
                    cur.execute(
                        '''
                        INSERT INTO line_sessions (user_id, state, draft_json, updated_at)
                        VALUES (%s, %s, %s, CURRENT_TIMESTAMP)
                        ON CONFLICT (user_id)
                        DO UPDATE SET
                          state = EXCLUDED.state,
                          draft_json = EXCLUDED.draft_json,
                          updated_at = CURRENT_TIMESTAMP
                        ''',
                        (user_id, state, Json(deepcopy(draft_json))),  # type: ignore[arg-type]
                    )
                conn.commit()
            return payload
        self._memory.sessions[user_id] = payload
        return deepcopy(payload)

    def delete_session(self, user_id: str) -> None:
        if self._use_db():
            with psycopg.connect(self.database_url) as conn:  # type: ignore[arg-type]
                with conn.cursor() as cur:
                    cur.execute('DELETE FROM line_sessions WHERE user_id = %s', (user_id,))
                conn.commit()
            return
        self._memory.sessions.pop(user_id, None)

    def create_quote(self, quote: dict[str, Any]) -> dict[str, Any]:
        payload = deepcopy(quote)
        payload.setdefault("id", f"quote-{uuid.uuid4().hex}")
        payload.setdefault("quote_status", "DRAFT")
        payload.setdefault("quote_options", [])
        payload.setdefault("quote_draft_text", "")
        payload.setdefault("sent_at", None)
        payload.setdefault("created_at", _utcnow().isoformat())

        if self._use_db():
            with psycopg.connect(self.database_url) as conn:  # type: ignore[arg-type]
                with conn.cursor() as cur:
                    cur.execute(
                        '''
                        INSERT INTO charter_quotes (
                          id, line_user_id, line_name, trip_date, passenger_count, pickup, destination,
                          remark, recommended_vehicle, quote_options, quote_draft_text, quote_status, sent_at
                        ) VALUES (
                          %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
                        )
                        ''',
                        (
                            payload["id"],
                            payload["line_user_id"],
                            payload.get("line_name"),
                            payload.get("trip_date"),
                            payload.get("passenger_count"),
                            payload.get("pickup"),
                            payload.get("destination"),
                            payload.get("remark"),
                            payload.get("recommended_vehicle"),
                            Json(deepcopy(payload.get("quote_options") or [])),  # type: ignore[arg-type]
                            payload.get("quote_draft_text"),
                            payload.get("quote_status", "DRAFT"),
                            payload.get("sent_at"),
                        ),
                    )
                conn.commit()
            return payload

        self._memory.quotes.insert(0, payload)
        return deepcopy(payload)

    def latest_quote(self, user_id: str) -> dict[str, Any] | None:
        if self._use_db():
            with psycopg.connect(self.database_url) as conn:  # type: ignore[arg-type]
                conn.row_factory = dict_row
                with conn.cursor() as cur:
                    cur.execute(
                        '''
                        SELECT id, line_user_id, line_name, trip_date, passenger_count, pickup, destination,
                               remark, recommended_vehicle, quote_options, quote_draft_text,
                               quote_status, sent_at, created_at
                        FROM charter_quotes
                        WHERE line_user_id = %s
                        ORDER BY created_at DESC
                        LIMIT 1
                        ''',
                        (user_id,),
                    )
                    return _row_to_dict(cur.fetchone())
        for quote in self._memory.quotes:
            if quote.get("line_user_id") == user_id:
                return deepcopy(quote)
        return None


quote_store = QuoteStore()
