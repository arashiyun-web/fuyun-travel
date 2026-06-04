from __future__ import annotations

import base64
import hashlib
import hmac
import os
from typing import Any

import httpx
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse

from app import quote_engine
from app.quote_flow import (
    ASK_DATE,
    ASK_DESTINATION,
    ASK_PASSENGER,
    ASK_PICKUP,
    ASK_REMARK,
    build_quote_draft_text,
    build_quote_options,
    clean_text,
    determine_next_state,
    next_quote_question,
    parse_passenger_count,
    parse_quote_seed,
    parse_trip_date,
    recommended_vehicle,
)
from app.rag_service import rag_service
from app.storage import quote_store

LINE_REPLY_URL = "https://api.line.me/v2/bot/message/reply"
LINE_PUSH_URL = "https://api.line.me/v2/bot/message/push"

app = FastAPI(title="Fuyun Travel LINE RAG Bot")

MENU = "\n".join([
    "浮雲輕鬆遊 AI 客服選單：",
    "1. 包車詢價（輸入：包車）",
    "2. 國內旅遊（輸入：國旅）",
    "3. 校外教學（輸入：校外教學）",
    "4. 機場接送（輸入：機場接送）",
    "5. 客服人員（輸入：客服）",
])


def _required_env() -> tuple[str, str]:
    channel_secret = os.getenv("LINE_CHANNEL_SECRET")
    access_token = os.getenv("LINE_CHANNEL_ACCESS_TOKEN")
    if not channel_secret or not access_token:
        raise HTTPException(status_code=500, detail="LINE_CHANNEL_SECRET or LINE_CHANNEL_ACCESS_TOKEN is not configured")
    return channel_secret, access_token


def _verify_signature(body: bytes, signature: str | None, channel_secret: str) -> bool:
    if not signature:
        return False
    digest = hmac.new(channel_secret.encode("utf-8"), body, hashlib.sha256).digest()
    expected = base64.b64encode(digest).decode("utf-8")
    return hmac.compare_digest(expected, signature)


def _clean_draft(draft: dict[str, Any]) -> dict[str, Any]:
    return {
        "trip_date": clean_text(draft.get("trip_date"), 32) or None,
        "passenger_count": draft.get("passenger_count"),
        "pickup": clean_text(draft.get("pickup"), 120) or None,
        "destination": clean_text(draft.get("destination"), 120) or None,
        "remark": clean_text(draft.get("remark"), 120) or None,
    }


def _latest_quote_summary(user_id: str) -> str:
    quote = quote_store.latest_quote(user_id)
    if not quote:
        return "目前沒有上一筆包車估價，請先輸入「包車」開始詢價。"
    options = quote.get("quote_options") or build_quote_options(quote)
    return "\n".join([
        "以下為上一筆包車初步估價：",
        "",
        *[f"{item.get('vehicle', '車型')}：{item.get('estimate', '待確認')}" for item in options],
        "",
        f"建議車型：{quote.get('recommended_vehicle') or recommended_vehicle(int(quote.get('passenger_count') or 0))}",
        "真人客服會再確認路線與車輛後提供正式報價。",
    ])


def _general_reply(text: str, analysis: dict[str, Any]) -> str:
    if analysis.get("is_one_day_round_taiwan"):
        return "一日環島風險過高，行車時間、休息與安全都不合理，浮雲旅遊不建議也不承接一日環島行程。"
    if analysis.get("asks_legal"):
        return "浮雲旅遊是交通部觀光署甲種旅行社，註冊編號 882200，品保協會會員北2760，履約保證保險 1500 萬元"
    if analysis.get("needs_luggage_warning"):
        return "44-45座大巴遇到大行李、機場、多日或環島行程時，行李艙容量有限；若每人一件大行李，可能需要減少座位、改派行李車或調整車型。\n\n請留下：日期、人數、行李件數、路線。"
    if analysis.get("intent") == "quote":
        return "請輸入「包車」開始正式詢價流程。"
    return MENU


async def _reply_to_line(reply_token: str, user_id: str, text: str, access_token: str) -> None:
    async with httpx.AsyncClient(timeout=15) as client:
        response = await client.post(
            LINE_REPLY_URL,
            headers={"Authorization": f"Bearer {access_token}", "Content-Type": "application/json"},
            json={"replyToken": reply_token, "messages": [{"type": "text", "text": text[:4500]}]},
        )
    if response.status_code >= 400:
        error_text = response.text[:500]
        print(f"LINE reply API failed: {response.status_code} {error_text}", flush=True)
        if user_id:
            async with httpx.AsyncClient(timeout=15) as client:
                push_response = await client.post(
                    LINE_PUSH_URL,
                    headers={"Authorization": f"Bearer {access_token}", "Content-Type": "application/json"},
                    json={"to": user_id, "messages": [{"type": "text", "text": text[:4500]}]},
                )
            if push_response.status_code < 400:
                return
            push_error = push_response.text[:500]
            print(f"LINE push API failed: {push_response.status_code} {push_error}", flush=True)
            raise HTTPException(status_code=500, detail=f"LINE reply/push API failed: {response.status_code}/{push_response.status_code}")
        raise HTTPException(status_code=500, detail=f"LINE reply API failed: {response.status_code}")


@app.get("/health")
async def health() -> dict[str, object]:
    return {"ok": True, "knowledge_documents": rag_service.document_count()}


async def _start_quote(user_id: str, draft: dict[str, Any] | None = None) -> str:
    clean_draft = _clean_draft(draft or {})
    next_state = determine_next_state(clean_draft)
    if next_state is None:
        quote_store.create_quote({
            "line_user_id": user_id,
            "line_name": None,
            "trip_date": clean_draft.get("trip_date"),
            "passenger_count": clean_draft.get("passenger_count"),
            "pickup": clean_draft.get("pickup"),
            "destination": clean_draft.get("destination"),
            "remark": clean_draft.get("remark") or "無",
            "recommended_vehicle": recommended_vehicle(int(clean_draft.get("passenger_count") or 0)),
            "quote_options": build_quote_options(clean_draft),
            "quote_draft_text": build_quote_draft_text(clean_draft),
            "quote_status": "DRAFT",
            "sent_at": None,
        })
        quote_store.delete_session(user_id)
        return "已收到詢價需求，客服將盡快確認。"

    quote_store.upsert_session(user_id, next_state, clean_draft)
    return next_quote_question(next_state)


async def _continue_quote(user_id: str, text: str) -> str | None:
    session = quote_store.get_session(user_id)
    if not session:
        return None

    draft = dict(session.get("draft_json") or {})
    state = session.get("state")
    value = clean_text(text, 500)

    if state == ASK_DATE:
        parsed_date = parse_trip_date(value)
        if not parsed_date:
            return next_quote_question(ASK_DATE)
        draft["trip_date"] = parsed_date
    elif state == ASK_PASSENGER:
        passenger_count = parse_passenger_count(value)
        if passenger_count is None:
            return "請輸入正確人數，例如：8"
        draft["passenger_count"] = passenger_count
    elif state == ASK_PICKUP:
        draft["pickup"] = value
    elif state == ASK_DESTINATION:
        draft["destination"] = value
    elif state == ASK_REMARK:
        draft["remark"] = value or "無"
        quote_store.create_quote({
            "line_user_id": user_id,
            "line_name": None,
            "trip_date": draft.get("trip_date"),
            "passenger_count": draft.get("passenger_count"),
            "pickup": draft.get("pickup"),
            "destination": draft.get("destination"),
            "remark": draft.get("remark") or "無",
            "recommended_vehicle": recommended_vehicle(int(draft.get("passenger_count") or 0)),
            "quote_options": build_quote_options(draft),
            "quote_draft_text": build_quote_draft_text(draft),
            "quote_status": "DRAFT",
            "sent_at": None,
        })
        quote_store.delete_session(user_id)
        return "已收到詢價需求，客服將盡快確認。"
    else:
        quote_store.delete_session(user_id)
        return None

    next_state = determine_next_state(draft)
    if next_state is None:
        quote_store.create_quote({
            "line_user_id": user_id,
            "line_name": None,
            "trip_date": draft.get("trip_date"),
            "passenger_count": draft.get("passenger_count"),
            "pickup": draft.get("pickup"),
            "destination": draft.get("destination"),
            "remark": draft.get("remark") or "無",
            "recommended_vehicle": recommended_vehicle(int(draft.get("passenger_count") or 0)),
            "quote_options": build_quote_options(draft),
            "quote_draft_text": build_quote_draft_text(draft),
            "quote_status": "DRAFT",
            "sent_at": None,
        })
        quote_store.delete_session(user_id)
        return "已收到詢價需求，客服將盡快確認。"

    quote_store.upsert_session(user_id, next_state, draft)
    return next_quote_question(next_state)


async def handle_text(user_id: str, text: str) -> str:
    message = clean_text(text, 120).lower()

    if message in {"選單", "menu", "功能"}:
        return MENU
    if message in {"價格", "報價"}:
        return _latest_quote_summary(user_id)
    if "包車" in message or message == "1":
        return await _start_quote(user_id)

    in_progress = await _continue_quote(user_id, text)
    if in_progress is not None:
        return in_progress

    analysis = quote_engine.analyze(text)
    if analysis.get("is_one_day_round_taiwan") or analysis.get("asks_legal") or analysis.get("needs_luggage_warning"):
        return _general_reply(text, analysis)

    seed = parse_quote_seed(text)
    if len(seed) >= 2 and ("trip_date" in seed or "passenger_count" in seed):
        return await _start_quote(user_id, seed)

    return _general_reply(text, analysis)


async def handle_event(event: dict[str, Any], access_token: str):
    if event.get("type") != "message" or event.get("message", {}).get("type") != "text":
        return
    reply_token = event.get("replyToken")
    user_id = event.get("source", {}).get("userId")
    if not reply_token or not user_id:
        return
    reply = await handle_text(user_id, event.get("message", {}).get("text", ""))
    await _reply_to_line(reply_token, user_id, reply, access_token)


@app.post("/line/webhook")
async def line_webhook(request: Request) -> JSONResponse:
    channel_secret, access_token = _required_env()
    body = await request.body()
    signature = request.headers.get("X-Line-Signature")
    if not _verify_signature(body, signature, channel_secret):
        raise HTTPException(status_code=403, detail="Invalid LINE signature")

    payload = await request.json()
    for event in payload.get("events", []):
        await handle_event(event, access_token)

    return JSONResponse({"ok": True})


@app.post("/api/line/webhook")
async def api_line_webhook(request: Request) -> JSONResponse:
    return await line_webhook(request)
