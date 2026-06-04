from __future__ import annotations

import re
from datetime import date
from typing import Any

ASK_DATE = "ASK_DATE"
ASK_PASSENGER = "ASK_PASSENGER"
ASK_PICKUP = "ASK_PICKUP"
ASK_DESTINATION = "ASK_DESTINATION"
ASK_REMARK = "ASK_REMARK"

QUOTE_ORDER = [
    (ASK_DATE, "trip_date"),
    (ASK_PASSENGER, "passenger_count"),
    (ASK_PICKUP, "pickup"),
    (ASK_DESTINATION, "destination"),
    (ASK_REMARK, "remark"),
]


def clean_text(value: Any, limit: int = 500) -> str:
    return (
        str(value or "")
        .replace("<", "")
        .replace(">", "")
        .replace("\r", " ")
        .replace("\n", " ")
        .replace("\t", " ")
        .replace("\u3000", " ")
        .strip()[:limit]
    )


def next_quote_question(state: str) -> str:
    if state == ASK_DATE:
        return "請輸入出車日期（YYYY-MM-DD）"
    if state == ASK_PASSENGER:
        return "請輸入人數"
    if state == ASK_PICKUP:
        return "請輸入出發地"
    if state == ASK_DESTINATION:
        return "請輸入目的地"
    if state == ASK_REMARK:
        return "請輸入備註"
    return "請輸入「包車」開始詢價。"


def recommended_vehicle(passenger_count: int = 0) -> str:
    if passenger_count <= 8:
        return "九人座"
    if passenger_count <= 20:
        return "中巴"
    if passenger_count <= 43:
        return "43座"
    return "遊覽車"


def _estimate(base: int, passenger_count: int = 0) -> str:
    group_factor = 3500 if passenger_count > 40 else 2500 if passenger_count > 20 else 1500 if passenger_count > 8 else 0
    return f"NT$ {base + group_factor:,} 起"


def build_quote_options(draft: dict[str, Any]) -> list[dict[str, str]]:
    passengers = int(draft.get("passenger_count") or 0)
    return [
        {"vehicle": "九人座", "estimate": _estimate(6500, passengers), "note": "建議方案" if passengers <= 8 else "人數可能不足，需拆車或改大車"},
        {"vehicle": "中巴", "estimate": _estimate(12000, passengers), "note": "團體舒適方案" if passengers <= 20 else "人數較多時需確認座位"},
        {"vehicle": "43座", "estimate": _estimate(18000, passengers), "note": "大型團體方案" if passengers <= 43 else "超過 43 人需另派車"},
        {"vehicle": "遊覽車", "estimate": _estimate(22000, passengers), "note": "適合校外教學、公司團體與大型活動"},
    ]


def build_quote_draft_text(draft: dict[str, Any]) -> str:
    options = build_quote_options(draft)
    recommended = recommended_vehicle(int(draft.get("passenger_count") or 0))
    return "\n".join([
        "浮雲輕鬆遊正式報價草稿",
        "",
        f"出車日期：{draft.get('trip_date') or '未填'}",
        f"人數：{draft.get('passenger_count') or '未填'}",
        f"出發地：{draft.get('pickup') or '未填'}",
        f"目的地：{draft.get('destination') or '未填'}",
        f"備註：{draft.get('remark') or '無'}",
        "",
        "AI 估價方案：",
        *[f"- {item['vehicle']}：{item['estimate']}（{item['note']}）" for item in options],
        "",
        f"建議車型：{recommended}",
        "",
        "以上為 AI 初步估價，正式價格仍需依日期、路線、車輛調度與實際需求由真人客服確認。",
    ])


def public_quote_summary(draft: dict[str, Any]) -> str:
    options = build_quote_options(draft)
    recommended = recommended_vehicle(int(draft.get("passenger_count") or 0))
    return "\n".join([
        "已收到您的包車詢價，以下為 AI 初步估價：",
        "",
        *[f"{item['vehicle']}：{item['estimate']}" for item in options],
        "",
        f"建議車型：{recommended}",
        "真人客服會再確認路線與車輛後提供正式報價。",
    ])


def parse_trip_date(text: str) -> str | None:
    value = clean_text(text, 120)
    patterns = [
        r"(?P<year>20\d{2})[-/](?P<month>\d{1,2})[-/](?P<day>\d{1,2})",
        r"(?P<month>\d{1,2})[-/](?P<day>\d{1,2})",
        r"(?P<month>\d{1,2})月(?P<day>\d{1,2})日?",
    ]
    for pattern in patterns:
        match = re.search(pattern, value)
        if not match:
            continue
        year = int(match.groupdict().get("year") or date.today().year)
        month = int(match.group("month"))
        day = int(match.group("day"))
        try:
            return date(year, month, day).isoformat()
        except ValueError:
            continue
    return None


def parse_passenger_count(text: str) -> int | None:
    value = clean_text(text, 80)
    match = re.search(r"(\d{1,3})\s*(?:人|位)?", value)
    if not match:
        return None
    count = int(match.group(1))
    if count < 1 or count > 120:
        return None
    return count


def parse_quote_seed(text: str) -> dict[str, Any]:
    value = clean_text(text, 300)
    tokens = [token for token in re.split(r"[\s,，、→]+", value) if token]
    draft: dict[str, Any] = {}

    date_index = next((i for i, token in enumerate(tokens) if parse_trip_date(token)), None)
    if date_index is not None:
        draft["trip_date"] = parse_trip_date(tokens[date_index])
        tokens.pop(date_index)
    else:
        parsed = parse_trip_date(value)
        if parsed:
            draft["trip_date"] = parsed

    passenger_index = next((i for i, token in enumerate(tokens) if parse_passenger_count(token)), None)
    if passenger_index is not None:
        draft["passenger_count"] = parse_passenger_count(tokens[passenger_index])
        tokens.pop(passenger_index)
    else:
        parsed = parse_passenger_count(value)
        if parsed:
            draft["passenger_count"] = parsed

    if tokens:
        draft["pickup"] = tokens[0]
    if len(tokens) > 1:
        draft["destination"] = tokens[1]
    if len(tokens) > 2:
        draft["remark"] = " ".join(tokens[2:])

    return draft


def determine_next_state(draft: dict[str, Any]) -> str | None:
    for state, key in QUOTE_ORDER:
        if not draft.get(key):
            return state
    return None
