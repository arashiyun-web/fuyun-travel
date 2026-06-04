import base64
import hashlib
import hmac
import os
import json

import pytest
from fastapi.testclient import TestClient

from app.main import app

SECRET = "test-secret"
TOKEN = "test-token"


def sign(body: bytes, secret: str = SECRET) -> str:
    digest = hmac.new(secret.encode("utf-8"), body, hashlib.sha256).digest()
    return base64.b64encode(digest).decode("utf-8")


@pytest.fixture(autouse=True)
def env(monkeypatch):
    monkeypatch.setenv("LINE_CHANNEL_SECRET", SECRET)
    monkeypatch.setenv("LINE_CHANNEL_ACCESS_TOKEN", TOKEN)


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


def test_webhook_valid_signature_calls_line_reply_api(monkeypatch):
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
    assert "請留下：日期、人數、行李件數、路線" in calls[0]["text"]


def test_webhook_invalid_signature_returns_403():
    body = make_body("包車")
    response = TestClient(app).post("/line/webhook", content=body, headers={"X-Line-Signature": "bad"})
    assert response.status_code == 403


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
