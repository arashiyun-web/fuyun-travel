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
from app.rag_service import rag_service

LINE_REPLY_URL = "https://api.line.me/v2/bot/message/reply"

app = FastAPI(title="Fuyun Travel LINE RAG Bot")


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


def build_customer_reply(message: str, analysis: dict[str, Any], context: str) -> str:
    lines: list[str] = []

    if analysis.get("is_one_day_round_taiwan"):
        lines.append("一日環島風險過高，行車時間、休息與安全都不合理，浮雲旅遊不建議也不承接一日環島行程。")
    elif analysis.get("asks_legal"):
        lines.append("浮雲旅遊是交通部觀光署甲種旅行社，註冊編號 882200，品保協會會員北2760，履約保證保險 1500 萬元")
    elif analysis.get("intent") == "quote":
        lines.append("已收到您的詢價需求。以下先提供初步行情方向，正式價格需由客服依日期、路線、車型與車輛調度確認。")
    else:
        lines.append("您好，這裡是浮雲旅遊客服。請提供需求，我們會協助確認行程與車輛安排。")

    if analysis.get("needs_luggage_warning"):
        lines.append("44-45座大巴遇到大行李、機場、多日或環島行程時，行李艙容量有限；若每人一件大行李，可能需要減少座位、改派行李車或調整車型。")

    missing_fields = analysis.get("missing_fields") or []
    if missing_fields:
        lines.append("目前資訊還不完整，因此只能提供初步行情，不能當作正式報價。")
        lines.append("請補充：" + "、".join(missing_fields) + "。")

    lines.append("工時計算不包含空車回送，實際費用仍以客服確認後的正式報價為準。")
    if context:
        lines.append("\n參考規則：")
        lines.append(context)
    lines.append("\n請留下：日期、人數、行李件數、路線。")
    return "\n".join(lines)


async def _reply_to_line(reply_token: str, text: str, access_token: str) -> None:
    async with httpx.AsyncClient(timeout=15) as client:
        response = await client.post(
            LINE_REPLY_URL,
            headers={"Authorization": f"Bearer {access_token}", "Content-Type": "application/json"},
            json={"replyToken": reply_token, "messages": [{"type": "text", "text": text[:4500]}]},
        )
    if response.status_code >= 400:
        raise HTTPException(status_code=500, detail=f"LINE reply API failed: {response.status_code}")


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/line/webhook")
async def line_webhook(request: Request) -> JSONResponse:
    channel_secret, access_token = _required_env()
    body = await request.body()
    signature = request.headers.get("X-Line-Signature")
    if not _verify_signature(body, signature, channel_secret):
        raise HTTPException(status_code=403, detail="Invalid LINE signature")

    payload = await request.json()
    for event in payload.get("events", []):
        if event.get("type") != "message":
            continue
        message = event.get("message", {})
        if message.get("type") != "text":
            continue
        reply_token = event.get("replyToken")
        if not reply_token:
            continue
        text = message.get("text", "")
        analysis = quote_engine.analyze(text)
        context = rag_service.as_context(text, analysis)
        reply = build_customer_reply(text, analysis, context)
        await _reply_to_line(reply_token, reply, access_token)

    return JSONResponse({"ok": True})
