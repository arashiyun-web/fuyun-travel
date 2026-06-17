from __future__ import annotations

import base64
import hashlib
import hmac
import os
import re
import time
from typing import Any

import httpx
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse

from app import quote_engine
from app.quote_formatter import INFO_REQUEST, format_initial_quote
from app.storage import quote_store
from app.rag_service import rag_service

LINE_REPLY_URL = "https://api.line.me/v2/bot/message/reply"

router = APIRouter()
_LAST_ESTIMATES: dict[str, str] = {}
_REPLY_DEDUPE_SECONDS = 5.0
_RECENT_MESSAGE_REPLIES: dict[tuple[str, str], float] = {}

LEGAL_REPLY = (
    "浮雲旅遊（雲驛旅行社有限公司）\n\n"
    "交通部觀光署甲種旅行社\n"
    "註冊編號：882200\n\n"
    "旅行業品質保障協會\n"
    "會員編號：北2760\n\n"
    "旺旺友聯履約保證保險\n"
    "保額：1500萬元"
)
ONE_DAY_ROUND_TAIWAN_REPLY = (
    "依交通法規與駕駛工時規定，\n\n"
    "全台環島約950~1000公里，\n"
    "已超過每日駕駛10小時與每日總工時12小時限制。\n\n"
    "因此無法提供合法的一日環島包車服務。\n\n"
    "建議安排：\n"
    "- 二日環島\n"
    "- 三日環島\n"
    "- 四日深度環島"
)
DRIVER_GUIDE_REPLY = (
    "依現行法規，\n\n"
    "司機職責為安全駕駛與行程執行，\n"
    "不建議安排司機兼任導覽解說。\n\n"
    "建議另派：\n\n"
    "- 合格領隊\n"
    "- 專業導遊"
)
LUGGAGE_WARNING = (
    "⚠ 行李空間提醒\n\n"
    "44~45座大巴約可放置35件左右28吋行李。\n\n"
    "若42位旅客每人攜帶1件28吋行李，\n\n"
    "可能無法全部裝載。\n\n"
    "建議：\n\n"
    "- 增派行李車\n"
    "- 增派接駁車\n"
    "- 升級大型車輛"
)
STAFF_SERVICE_REPLY = "領隊：\n2500~3500元/天\n\n專業導遊：\n3500~4500元/天\n\n外語導遊：\n4500~6000元起/天\n\n導遊領隊小費通常依人數計算。"

ONE_DAY_KEYWORDS = ["一天環島", "一日環島", "單日環島"]
LEGAL_KEYWORDS = ["合法", "是否合法", "旅行社", "執照", "牌照", "有牌照", "保障", "保險"]
DRIVER_GUIDE_KEYWORDS = ["司機導覽", "司機介紹", "司機邊開邊講", "不用導遊", "司機拿麥克風", "邊開邊介紹", "邊開車邊介紹", "兼導遊", "司機可以兼導遊"]
STAFF_SERVICE_KEYWORDS = ["領隊", "導遊", "隨車人員"]
BUS_KEYWORDS = ["44座", "45座", "大巴", "遊覽車"]
LUGGAGE_KEYWORDS = ["機場", "桃園機場", "出國", "大行李", "行李箱", "24吋", "28吋", "多日遊", "多日", "環島"]
PLACES = ["樹林", "鹿港", "台北", "新北", "板橋", "桃園", "桃園機場", "松山機場", "苗栗", "台中", "臺中", "彰化", "雲林", "雲林縣", "嘉義", "嘉義縣", "嘉義市", "台南", "臺南", "高雄", "屏東", "宜蘭", "花蓮"]
QUOTE_ENTRY_KEYWORDS = ["包車", "租車", "遊覽車", "訂車", "詢價", "立即報價", "?", "？"]
QUOTE_HELPER_REPLY = """您好，我是小幫手，有什麼我能為您服務。

請直接輸入：
日期：
人數：
出發地：
目的地："""



INTENT_KEYWORDS = {
    "airport": ["機場接送", "桃園機場", "松山機場", "高鐵接送", "接機", "送機"],
    "travel": ["國旅", "國內旅遊", "一日遊", "二日遊", "三日遊", "旅遊"],
    "school": ["校外教學", "畢業旅行", "戶外教學", "學校包車"],
    "customer_service": ["客服", "真人客服", "聯絡客服", "找人"],
    "charter": ["包車", "租車", "遊覽車", "報價", "訂車"],
}

CUSTOMER_SERVICE_REPLY = """您好，真人客服將協助您。

公司電話：
02-2685-1666

LINE客服將儘速與您聯繫。"""
AIRPORT_REPLY = """您好，請提供：

日期：
航班：
人數：
上車地點：
機場：

收到後立即估價。"""
TRAVEL_REPLY = """您好，請提供：

日期：
人數：
想去地區：

例如：

宜蘭
花蓮
台中
阿里山
日月潭"""
SCHOOL_REPLY = """您好，請提供：

學校名稱：
日期：
學生人數：
老師人數：
目的地："""
OFFICIAL_QUOTE_KEYWORDS = ["我要正式報價", "正式報價", "報價", "給我正式報價", "客服報價"]
ACKNOWLEDGEMENT_KEYWORDS = ["好", "收到", "謝謝"]
QUOTED_ACK_REPLY = """感謝您的詢問。

如需正式報價：

請回覆：

【我要正式報價】"""
OFFICIAL_QUOTE_CREATED_REPLY = """已收到您的正式報價需求。

真人客服將依日期、路線、人數與車輛調度確認正式報價，並儘速與您聯繫。"""
OFFICIAL_QUOTE_MISSING_REPLY = """請先提供完整包車資訊：

日期：
人數：
出發地：
目的地：

完成初步行情後，即可建立正式報價。"""

def classify_intent(text: str) -> str:
    stripped = text.strip()
    for intent in ["airport", "travel", "school", "customer_service", "charter"]:
        if _has_any(stripped, INTENT_KEYWORDS[intent]):
            return intent
    return "general"

def _is_official_quote_request(text: str) -> bool:
    stripped = text.strip()
    return stripped in OFFICIAL_QUOTE_KEYWORDS


def _is_acknowledgement(text: str) -> bool:
    return text.strip() in ACKNOWLEDGEMENT_KEYWORDS


def _intent_reply(intent: str) -> str | None:
    return {
        "airport": AIRPORT_REPLY,
        "travel": TRAVEL_REPLY,
        "school": SCHOOL_REPLY,
        "customer_service": CUSTOMER_SERVICE_REPLY,
    }.get(intent)


def _required_env() -> tuple[str, str]:
    channel_secret = os.getenv("LINE_CHANNEL_SECRET")
    access_token = os.getenv("LINE_CHANNEL_ACCESS_TOKEN")
    if not channel_secret or not access_token:
        raise HTTPException(status_code=500, detail="LINE_CHANNEL_SECRET or LINE_CHANNEL_ACCESS_TOKEN is not configured")
    return channel_secret, access_token


def verify_line_signature(body: bytes, signature: str | None, channel_secret: str) -> None:
    if not signature:
        raise HTTPException(status_code=403, detail="Invalid LINE signature")
    digest = hmac.new(channel_secret.encode("utf-8"), body, hashlib.sha256).digest()
    expected = base64.b64encode(digest).decode("utf-8")
    if not hmac.compare_digest(expected, signature):
        raise HTTPException(status_code=403, detail="Invalid LINE signature")


def parse_line_events(payload: dict[str, Any]) -> list[dict[str, str]]:
    events: list[dict[str, str]] = []
    for event in payload.get("events", []):
        if event.get("type") != "message":
            continue
        message = event.get("message") or {}
        if message.get("type") != "text":
            continue
        reply_token = event.get("replyToken")
        text = message.get("text")
        if reply_token and isinstance(text, str):
            events.append({
                "reply_token": reply_token,
                "text": text,
                "user_id": str((event.get("source") or {}).get("userId") or ""),
                "message_id": str(message.get("id") or ""),
            })
    return events


def _should_reply_once(user_id: str, message_id: str, now: float | None = None) -> bool:
    if not user_id or not message_id:
        return True

    current = time.monotonic() if now is None else now
    expires_before = current - _REPLY_DEDUPE_SECONDS
    for key, seen_at in list(_RECENT_MESSAGE_REPLIES.items()):
        if seen_at < expires_before:
            del _RECENT_MESSAGE_REPLIES[key]

    key = (user_id, message_id)
    if key in _RECENT_MESSAGE_REPLIES:
        return False

    _RECENT_MESSAGE_REPLIES[key] = current
    return True


def _clean_text(text: str, limit: int = 500) -> str:
    return (text or "").strip()[:limit]


def _has_any(text: str, keywords: list[str]) -> bool:
    return any(keyword in text for keyword in keywords)


def _passenger_count(text: str) -> int | None:
    labeled = re.search(r"人數\s*[:：]\s*(\d{1,3})", text)
    if labeled:
        return int(labeled.group(1))
    match = re.search(r"(\d{1,3})\s*(人|位)", text)
    return int(match.group(1)) if match else None


def _has_date(text: str) -> bool:
    return bool(re.search(r"\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}/\d{1,2}|\d{1,2}月\d{1,2}[日號]?", text))


def _has_route(text: str) -> bool:
    if re.search(r"\S+\s*(到|至|→|->)\s*\S+", text):
        return True
    if _has_any(text, ["出發", "上車", "接送地", "接車", "從"]) and _has_any(text, ["目的地", "下車", "送到", "到"]):
        return True
    return sum(1 for place in PLACES if place in text) >= 2


def _field_value(text: str, label: str) -> str:
    labels = "日期|人數|出發地|目的地|備註"
    match = re.search(rf"{label}\s*[:：]\s*(.*?)(?=\s*(?:{labels})\s*[:：]|$)", text, re.S)
    return match.group(1).strip() if match else ""


def _quote_payload(text: str, analysis: dict[str, Any]) -> dict[str, Any]:
    date = _field_value(text, "日期")
    people_text = _field_value(text, "人數")
    origin = _field_value(text, "出發地")
    destination = _field_value(text, "目的地")
    note = _field_value(text, "備註")

    passenger_count = int(people_text) if people_text.isdigit() else (analysis.get("passenger_count") or _passenger_count(text))

    if not date:
        date_match = re.search(r"\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}/\d{1,2}|\d{1,2}月\d{1,2}[日號]?", text)
        date = date_match.group(0) if date_match else ""

    if not origin or not destination:
        route_match = re.search(r"([^\s，,。]+?)\s*(到|至|→|->)\s*([^\s，,。]+)", text)
        if route_match:
            origin = origin or route_match.group(1).strip()
            destination = destination or route_match.group(3).strip()

    if not origin or not destination:
        matched_places = sorted(
            ((text.find(place), place) for place in PLACES if place in text),
            key=lambda item: item[0],
        )
        unique_places: list[str] = []
        for _, place in matched_places:
            if place not in unique_places:
                unique_places.append(place)
        if len(unique_places) >= 2:
            origin = origin or unique_places[0]
            destination = destination or unique_places[1]
        elif len(unique_places) == 1:
            if origin and unique_places[0] != origin:
                destination = destination or unique_places[0]
            elif not origin and not destination:
                destination = unique_places[0]

    if not note and _has_any(text, ["無行李", "無", "行李", "行李箱", "背包", "24吋", "28吋"]):
        if "無行李" in text:
            note = "無行李"
        elif text.strip() == "無":
            note = "無"
        else:
            note = "已提供"

    return {
        "date": date,
        "people": passenger_count,
        "origin": origin,
        "destination": destination,
        "note": note,
    }


def _is_quote_entry(text: str) -> bool:
    stripped = text.strip()
    return stripped in QUOTE_ENTRY_KEYWORDS or stripped in [f"我要{keyword}" for keyword in QUOTE_ENTRY_KEYWORDS]


def _quote_text_from_payload(payload: dict[str, Any]) -> str:
    return " ".join(
        str(value)
        for value in [payload.get("date"), payload.get("people"), payload.get("origin"), payload.get("destination"), payload.get("note")]
        if value
    )


def _missing_quote_payload_fields(payload: dict[str, Any]) -> list[str]:
    missing: list[str] = []
    if not payload.get("date"):
        missing.append("日期")
    if not payload.get("people"):
        missing.append("乘車人數")
    if not payload.get("origin"):
        missing.append("出發地")
    if not payload.get("destination"):
        missing.append("目的地")
    return missing


def _missing_quote_reply(missing: list[str]) -> str:
    messages = {
        "日期": "請補充日期。",
        "乘車人數": "請補充乘車人數。",
        "出發地": "請補充出發地。",
        "目的地": "請補充目的地。",
        "備註": "請補充備註，例如：無、行李多、需要兒童座椅。",
    }
    return "\n".join(messages.get(field, f"請補充{field}。") for field in missing)


def _missing_required_fields(text: str, analysis: dict[str, Any]) -> list[str]:
    checks = [
        ("日期", _has_date(text)),
        ("人數", analysis.get("passenger_count") is not None or _passenger_count(text) is not None),
        ("出發地", _has_origin_destination(text)[0]),
        ("目的地", _has_origin_destination(text)[1]),
        ("行李件數", _has_any(text, ["行李", "行李箱", "背包", "24吋", "28吋", "無行李"])),
        ("單程或來回", _has_any(text, ["單程", "來回", "往返", "回程", "雙程", "⇄"])),
    ]
    return [field for field, present in checks if not present]


def _has_origin_destination(text: str) -> tuple[bool, bool]:
    if re.search(r"\S+\s*(到|至|→|->|⇄)\s*\S+", text):
        return True, True
    matched_places = [place for place in PLACES if place in text]
    if len(matched_places) >= 2:
        return True, True
    has_origin = _has_any(text, ["出發", "上車", "接送地", "接車", "從"])
    has_destination = _has_any(text, ["目的地", "下車", "送到", "到"])
    return has_origin, has_destination


def _needs_luggage_warning(text: str) -> bool:
    passenger_count = _passenger_count(text)
    mentions_large_bus = _has_any(text, BUS_KEYWORDS) or (passenger_count is not None and passenger_count >= 42)
    mentions_28_inch = _has_any(text, ["28吋", "28寸"])
    each_person_has_luggage = _has_any(text, ["每人", "一人一件", "每位"])
    return mentions_large_bus and mentions_28_inch and each_person_has_luggage


def _context_lines(context: str) -> list[str]:
    return [line.strip().lstrip("- ").strip() for line in (context or "").splitlines() if line.strip()]


def _has_quote_trigger(text: str) -> bool:
    return _has_any(text, ["包車", "詢價", "訂車", "立即報價", "報價"])


def _is_quote_like(text: str, analysis: dict[str, Any]) -> bool:
    return classify_intent(text) == "charter"


def _is_quoted_session(user_id: str | None) -> bool:
    if not user_id:
        return False
    session = quote_store.get_session(user_id)
    return bool(session and session.get("state") == "QUOTED")


def _is_complete_session(user_id: str | None) -> bool:
    return _is_quoted_session(user_id)


def _is_collecting_session(user_id: str | None) -> bool:
    if not user_id:
        return False
    session = quote_store.get_session(user_id)
    return bool(session and session.get("state") == "COLLECTING")


def _merge_quote_session(user_id: str | None, parsed: dict[str, Any]) -> dict[str, Any]:
    if not user_id:
        return {key: value for key, value in parsed.items() if value}

    session = quote_store.get_session(user_id) or {}
    draft = dict(session.get("draft_json") or {})

    if parsed.get("date"):
        draft["date"] = parsed["date"]
    if parsed.get("people"):
        draft["people"] = parsed["people"]
    if parsed.get("origin"):
        draft["origin"] = parsed["origin"]
    if parsed.get("destination"):
        draft["destination"] = parsed["destination"]
    if parsed.get("note"):
        draft["note"] = parsed["note"]

    quote_store.upsert_session(user_id, "COLLECTING", draft)
    return draft


def _mark_complete_session(user_id: str | None, text: str, analysis: dict[str, Any], reply: str, draft: dict[str, Any] | None = None) -> None:
    if not user_id:
        return
    quote_store.upsert_session(
        user_id,
        "QUOTED",
        {
            **(dict(draft or {})),
            "last_message": text,
            "passenger_count": analysis.get("passenger_count") or _passenger_count(text) or (draft or {}).get("people"),
            "last_reply": reply,
        },
    )


def _estimate_summary(text: str, passenger_count: int | None) -> str:
    return format_initial_quote(passenger_count, text)


def _create_official_quote(user_id: str | None) -> dict[str, Any] | None:
    if not user_id:
        return None
    session = quote_store.get_session(user_id)
    draft = dict((session or {}).get("draft_json") or {})
    missing = _missing_quote_payload_fields(draft)
    if missing:
        return None

    quote = quote_store.create_quote(
        {
            "line_user_id": user_id,
            "line_name": None,
            "trip_date": draft.get("date"),
            "passenger_count": draft.get("people"),
            "pickup": draft.get("origin"),
            "destination": draft.get("destination"),
            "remark": draft.get("note") or "無",
            "recommended_vehicle": "",
            "quote_status": "new",
            "quote_options": [],
            "quote_draft_text": "",
        }
    )
    quote_store.upsert_session(user_id, "OFFICIAL_QUOTE_FLOW", {**draft, "official_quote_id": quote.get("id")})
    return quote


def _official_quote_reply(user_id: str | None) -> str:
    quote = _create_official_quote(user_id)
    if not quote:
        return OFFICIAL_QUOTE_MISSING_REPLY
    return OFFICIAL_QUOTE_CREATED_REPLY


def customer_reply_builder(user_text: str, analysis: dict[str, Any], context: str, user_id: str | None = None) -> str:
    text = _clean_text(user_text)

    if _is_quote_like(text, analysis) or _is_collecting_session(user_id):
        payload = _quote_payload(text, analysis)
        merged = _merge_quote_session(user_id, payload)
        missing = _missing_quote_payload_fields(merged)
        if missing:
            return _missing_quote_reply(missing)

        merged.setdefault("note", "無")
        quote_text = f"{text} {_quote_text_from_payload(merged)}"
        reply = _estimate_summary(quote_text, merged.get("people"))
        _mark_complete_session(user_id, text, analysis, reply, merged)
        if user_id:
            _LAST_ESTIMATES[user_id] = reply
        return reply

    if _needs_luggage_warning(text):
        return LUGGAGE_WARNING

    parts: list[str] = []
    lines = _context_lines(context)
    if lines:
        parts.extend(lines[:3])
        parts.append(INFO_REQUEST)
        return "\n\n".join(parts)

    return "目前知識庫沒有命中正式資料，我不會猜測。\n\n" + INFO_REQUEST


def build_reply(user_text: str, user_id: str | None = None) -> str:
    text = _clean_text(user_text)
    normalized = text.lower()
    analysis = quote_engine.analyze(text)
    context = rag_service.as_context(text, analysis)
    if _is_official_quote_request(text):
        return _official_quote_reply(user_id)

    if _is_quote_entry(text):
        if user_id:
            quote_store.upsert_session(user_id, "COLLECTING", {})
        return QUOTE_HELPER_REPLY

    if _is_collecting_session(user_id):
        return customer_reply_builder(text, analysis, context, user_id)

    intent = classify_intent(text)
    if _is_quoted_session(user_id) and intent != "charter" and normalized != "價格":
        return QUOTED_ACK_REPLY

    payload = _quote_payload(text, analysis)
    has_complete_quote_payload = not _missing_quote_payload_fields(payload)

    intent_reply = _intent_reply(intent)
    if intent_reply:
        if user_id:
            quote_store.delete_session(user_id)
        return intent_reply

    if normalized == "價格":
        if user_id and user_id in _LAST_ESTIMATES:
            return "以下為上一筆估價：\n\n" + _LAST_ESTIMATES[user_id]
        return "目前沒有上一筆估價紀錄。\n\n" + INFO_REQUEST
    if _has_any(text, ONE_DAY_KEYWORDS):
        return ONE_DAY_ROUND_TAIWAN_REPLY
    if _has_any(text, LEGAL_KEYWORDS):
        return LEGAL_REPLY
    if _has_any(text, DRIVER_GUIDE_KEYWORDS):
        return DRIVER_GUIDE_REPLY
    if _has_any(text, STAFF_SERVICE_KEYWORDS):
        return STAFF_SERVICE_REPLY

    reply = customer_reply_builder(text, analysis, context, user_id)
    if user_id and _is_quote_like(text, analysis):
        _LAST_ESTIMATES[user_id] = reply
    return reply


async def reply_to_line(reply_token: str, reply_text: str, access_token: str) -> None:
    async with httpx.AsyncClient(timeout=15) as client:
        response = await client.post(
            LINE_REPLY_URL,
            headers={"Authorization": f"Bearer {access_token}", "Content-Type": "application/json"},
            json={"replyToken": reply_token, "messages": [{"type": "text", "text": reply_text[:4500]}]},
        )
    if response.status_code >= 400:
        raise HTTPException(status_code=500, detail=f"LINE reply API failed: {response.status_code}")


@router.post("/api/line/webhook")
async def line_webhook(request: Request) -> JSONResponse:
    channel_secret, access_token = _required_env()
    body = await request.body()
    verify_line_signature(body, request.headers.get("X-Line-Signature"), channel_secret)

    payload = await request.json()
    replied = 0
    skipped_duplicates = 0
    for event in parse_line_events(payload):
        if not _should_reply_once(event.get("user_id", ""), event.get("message_id", "")):
            skipped_duplicates += 1
            continue
        reply_text = build_reply(event["text"], event.get("user_id"))
        await reply_to_line(event["reply_token"], reply_text, access_token)
        replied += 1

    return JSONResponse({"ok": True, "replied": replied, "skipped_duplicates": skipped_duplicates})
