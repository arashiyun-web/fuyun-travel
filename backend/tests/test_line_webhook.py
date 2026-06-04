import base64
import hashlib
import hmac
import json

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.storage import quote_store

SECRET = "test-secret"
TOKEN = "test-token"


def sign(body: bytes, secret: str = SECRET) -> str:
    digest = hmac.new(secret.encode("utf-8"), body, hashlib.sha256).digest()
    return base64.b64encode(digest).decode("utf-8")


@pytest.fixture(autouse=True)
def env(monkeypatch):
    monkeypatch.setenv("LINE_CHANNEL_SECRET", SECRET)
    monkeypatch.setenv("LINE_CHANNEL_ACCESS_TOKEN", TOKEN)
    quote_store.reset()


def make_body(text: str) -> bytes:
    return json.dumps(
        {
            "events": [
                {
                    "type": "message",
                    "replyToken": "reply-token",
                    "source": {"userId": "U123"},
                    "message": {"type": "text", "text": text},
                }
            ]
        },
        ensure_ascii=False,
        separators=(",", ":"),
    ).encode("utf-8")


def test_webhook_valid_signature_starts_quote_flow(monkeypatch):
    calls = []

    async def fake_reply(reply_token, text, access_token):
        calls.append({"reply_token": reply_token, "text": text, "access_token": access_token})

    monkeypatch.setattr("app.main._reply_to_line", fake_reply)
    body = make_body("包車")
    response = TestClient(app).post("/line/webhook", content=body, headers={"X-Line-Signature": sign(body)})

    assert response.status_code == 200
    assert calls
    assert calls[0]["reply_token"] == "reply-token"
    assert calls[0]["access_token"] == TOKEN
    assert calls[0]["text"] == "請輸入出車日期（YYYY-MM-DD）"
    assert quote_store.get_session("U123")["state"] == "ASK_DATE"


def test_webhook_invalid_signature_returns_403():
    body = make_body("包車")
    response = TestClient(app).post("/line/webhook", content=body, headers={"X-Line-Signature": "bad"})
    assert response.status_code == 403


def test_quote_flow_writes_charter_quotes(monkeypatch):
    calls = []

    async def fake_reply(reply_token, text, access_token):
        calls.append(text)

    monkeypatch.setattr("app.main._reply_to_line", fake_reply)
    client = TestClient(app)

    for text in ["包車", "2026-06-28", "41人", "樹林", "新竹", "無"]:
        body = make_body(text)
        response = client.post("/line/webhook", content=body, headers={"X-Line-Signature": sign(body)})
        assert response.status_code == 200

    assert calls[-1] == "已收到詢價需求，客服將盡快確認。"
    assert quote_store.get_session("U123") is None
    quote = quote_store.latest_quote("U123")
    assert quote is not None
    assert quote["trip_date"] == "2026-06-28"
    assert quote["passenger_count"] == 41
    assert quote["pickup"] == "樹林"
    assert quote["destination"] == "新竹"
    assert quote["remark"] == "無"
    assert quote["recommended_vehicle"] == "43座"
    assert len(quote["quote_options"]) == 4
    assert "浮雲輕鬆遊正式報價草稿" in quote["quote_draft_text"]


def test_price_returns_last_quote_summary(monkeypatch):
    calls = []

    async def fake_reply(reply_token, text, access_token):
        calls.append(text)

    monkeypatch.setattr("app.main._reply_to_line", fake_reply)
    client = TestClient(app)

    for text in ["包車", "2026-06-28", "41人", "樹林", "新竹", "無"]:
        body = make_body(text)
        client.post("/line/webhook", content=body, headers={"X-Line-Signature": sign(body)})

    body = make_body("價格")
    response = client.post("/line/webhook", content=body, headers={"X-Line-Signature": sign(body)})
    assert response.status_code == 200
    assert "以下為上一筆包車初步估價" in calls[-1]
    assert "43座" in calls[-1]
    assert "遊覽車" in calls[-1]


def test_one_day_round_taiwan_block(monkeypatch):
    calls = []

    async def fake_reply(reply_token, text, access_token):
        calls.append(text)

    monkeypatch.setattr("app.main._reply_to_line", fake_reply)
    body = make_body("一天環島可以嗎？")
    response = TestClient(app).post("/line/webhook", content=body, headers={"X-Line-Signature": sign(body)})

    assert response.status_code == 200
    assert "一日環島" in calls[0]
    assert "不建議也不承接" in calls[0]


def test_45_seat_airport_big_luggage_warning(monkeypatch):
    calls = []

    async def fake_reply(reply_token, text, access_token):
        calls.append(text)

    monkeypatch.setattr("app.main._reply_to_line", fake_reply)
    body = make_body("42人，45座大巴，桃園機場接送，每人一個大行李")
    response = TestClient(app).post("/line/webhook", content=body, headers={"X-Line-Signature": sign(body)})

    assert response.status_code == 200
    assert "行李艙容量有限" in calls[0]
    assert "每人一件大行李" in calls[0]


def test_api_line_webhook_alias_valid_signature(monkeypatch):
    calls = []

    async def fake_reply(reply_token, text, access_token):
        calls.append({"reply_token": reply_token, "text": text, "access_token": access_token})

    monkeypatch.setattr("app.main._reply_to_line", fake_reply)
    body = make_body("包車")
    response = TestClient(app).post("/api/line/webhook", content=body, headers={"X-Line-Signature": sign(body)})

    assert response.status_code == 200
    assert calls
    assert calls[0]["reply_token"] == "reply-token"
