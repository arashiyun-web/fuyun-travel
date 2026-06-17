import base64
import hashlib
import hmac
import json

import pytest
from fastapi.testclient import TestClient

from app.line_webhook import _RECENT_MESSAGE_REPLIES, build_reply
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
    _RECENT_MESSAGE_REPLIES.clear()


def make_body(text: str, message_id: str | None = None, reply_token: str = "reply-token") -> bytes:
    return json.dumps(
        {
            "events": [
                {
                    "type": "message",
                    "replyToken": reply_token,
                    "source": {"userId": "U123"},
                    "message": {"id": message_id or "msg-" + hashlib.sha256(text.encode("utf-8")).hexdigest()[:12], "type": "text", "text": text},
                }
            ]
        },
        ensure_ascii=False,
        separators=(",", ":"),
    ).encode("utf-8")


def post_line(monkeypatch, text: str, path: str = "/api/line/webhook", message_id: str | None = None, reply_token: str = "reply-token"):
    calls = []

    async def fake_reply(reply_token, reply_text, access_token):
        calls.append({"reply_token": reply_token, "text": reply_text, "access_token": access_token})

    monkeypatch.setattr("app.line_webhook.reply_to_line", fake_reply)
    body = make_body(text, message_id=message_id, reply_token=reply_token)
    response = TestClient(app).post(path, content=body, headers={"X-Line-Signature": sign(body)})
    return response, calls


def test_api_line_webhook_valid_signature_routes_to_new_handler(monkeypatch):
    response, calls = post_line(monkeypatch, "你們合法嗎？")

    assert response.status_code == 200
    assert calls
    assert calls[0]["reply_token"] == "reply-token"
    assert calls[0]["access_token"] == TOKEN
    assert "[RAG-V2]" not in calls[0]["text"]
    assert "882200" in calls[0]["text"]
    assert "北2760" in calls[0]["text"]
    assert "1500萬元" in calls[0]["text"]


def test_webhook_invalid_signature_returns_403():
    body = make_body("你好")
    response = TestClient(app).post("/api/line/webhook", content=body, headers={"X-Line-Signature": "bad"})
    assert response.status_code == 403


def test_legacy_line_webhook_route_is_not_registered():
    body = make_body("你好")
    response = TestClient(app).post("/line/webhook", content=body, headers={"X-Line-Signature": sign(body)})
    assert response.status_code == 404


def test_one_day_round_taiwan_block():
    reply = build_reply("一天環島可以嗎")

    assert "依交通法規與駕駛工時規定" in reply
    assert "全台環島約950~1000公里" in reply
    assert "每日駕駛10小時" in reply
    assert "每日總工時12小時限制" in reply
    assert "無法提供合法的一日環島包車服務" in reply
    assert "- 二日環島" in reply
    assert "- 三日環島" in reply
    assert "- 四日深度環島" in reply
    assert "NT$" not in reply
    assert "選單" not in reply


def test_legal_reply_contains_required_license_data():
    reply = build_reply("你們合法嗎")

    assert "浮雲旅遊（雲驛旅行社有限公司）" in reply
    assert "交通部觀光署甲種旅行社" in reply
    assert "882200" in reply
    assert "北2760" in reply
    assert "1500萬元" in reply


def test_39_passengers_with_complete_core_fields_gets_initial_quote_only_big_bus():
    reply = build_reply("包車 39人 樹林 鹿港 10/25 無行李 來回")

    assert "您好，我是小幫手。" in reply
    assert "以下為初步行情：" in reply
    assert "建議車型：" not in reply
    assert "43座以上遊覽車 / 44-45座大巴" not in reply
    assert "初步行情：" in reply
    assert "NT$16,000～22,000 起" in reply
    assert "NT$11,000" not in reply
    assert "九人座" not in reply
    assert "中巴" not in reply
    assert "請補充" not in reply
    assert "真人客服將協助確認" in reply


def test_airport_intent_does_not_enter_charter_quote_engine():
    reply = build_reply("機場接送")

    assert "航班：" in reply
    assert "機場：" in reply
    assert "收到後立即估價。" in reply
    assert "NT$" not in reply
    assert "以下為初步行情" not in reply




def test_customer_service_intent_does_not_enter_charter_quote_engine():
    reply = build_reply("客服")

    assert "真人客服將協助您" in reply
    assert "02-2685-1666" in reply
    assert "NT$" not in reply
    assert "以下為初步行情" not in reply


def test_travel_intent_does_not_enter_charter_quote_engine():
    reply = build_reply("國旅")

    assert "想去地區：" in reply
    assert "宜蘭" in reply
    assert "日月潭" in reply
    assert "NT$" not in reply
    assert "以下為初步行情" not in reply


def test_school_intent_does_not_enter_charter_quote_engine():
    reply = build_reply("校外教學")

    assert "學校名稱：" in reply
    assert "學生人數：" in reply
    assert "老師人數：" in reply
    assert "NT$" not in reply
    assert "以下為初步行情" not in reply

def test_driver_cannot_be_tour_guide():
    reply = build_reply("司機可以兼導遊嗎")

    assert "依現行法規" in reply
    assert "司機職責為安全駕駛與行程執行" in reply
    assert "不建議安排司機兼任導覽解說" in reply
    assert "合格領隊" in reply
    assert "專業導遊" in reply


def test_missing_fields_only_asks_four_core_fields_and_no_price():
    reply = build_reply("我要租遊覽車")

    assert "請補充日期。" in reply
    assert "請補充乘車人數。" in reply
    assert "請補充出發地。" in reply
    assert "請補充目的地。" in reply
    assert "請輸入出車日期" not in reply
    assert "請輸入乘車人數" not in reply
    assert "【AI初步行情參考】" not in reply
    assert "九人座" not in reply
    assert "中巴" not in reply


def test_39_passengers_without_charter_intent_does_not_quote():
    reply = build_reply("39人")

    assert "以下為初步行情" not in reply
    assert "NT$" not in reply


def test_price_returns_last_estimate(monkeypatch):
    response, calls = post_line(monkeypatch, "包車 39人 樹林 鹿港 10/25 無行李 來回")
    assert response.status_code == 200
    assert "以下為初步行情" in calls[0]["text"]

    response, calls = post_line(monkeypatch, "價格")
    assert response.status_code == 200
    assert "以下為上一筆估價" in calls[0]["text"]
    assert "初步行情：" in calls[0]["text"]
    assert "選單" not in calls[0]["text"]


def test_menu_text_does_not_trigger_legacy_menu():
    reply = build_reply("選單")
    assert "主選單" not in reply
    assert "包車 →" not in reply
    assert "請輸入出發地" not in reply


def test_duplicate_user_message_id_replies_once_within_five_seconds(monkeypatch):
    response, calls = post_line(monkeypatch, "包車 39人 樹林 鹿港 10/25 無行李 來回", message_id="same-message", reply_token="reply-1")
    assert response.status_code == 200
    assert response.json()["replied"] == 1
    assert response.json()["skipped_duplicates"] == 0

    response, second_calls = post_line(monkeypatch, "包車 39人 樹林 鹿港 10/25 無行李 來回", message_id="same-message", reply_token="reply-2")
    assert response.status_code == 200
    assert response.json()["replied"] == 0
    assert response.json()["skipped_duplicates"] == 1
    assert len(calls) == 1
    assert second_calls == []


def test_shulin_to_yunlin_39_uses_formal_central_south_large_bus_price():
    reply = build_reply("包車 39人 樹林到雲林 10/25 無行李 來回")

    assert "43座以上遊覽車 / 44-45座大巴" not in reply
    assert "NT$16,000～22,000 起" in reply
    assert "9000" not in reply
    assert "14500" not in reply
    assert "20500" not in reply
    assert "九人座" not in reply
    assert "中巴" not in reply


@pytest.mark.parametrize("destination", ["苗栗", "台中", "彰化", "鹿港", "雲林", "嘉義", "台南", "高雄", "屏東"])
def test_required_central_south_destinations_classified_as_formal_tier(destination):
    reply = build_reply(f"包車 39人 樹林到{destination} 10/25 無行李 來回")

    assert "43座以上遊覽車 / 44-45座大巴" not in reply
    assert "NT$16,000～22,000 起" in reply
    assert "尚缺資料" not in reply


def test_complete_session_does_not_restart_quote_without_explicit_trigger():
    from app.storage import quote_store

    quote_store.reset()
    user_id = "U-complete-session"

    first = build_reply("包車 39人 樹林到雲林 10/25 無行李 來回", user_id=user_id)
    assert "以下為初步行情" in first
    assert quote_store.get_session(user_id)["state"] == "QUOTED"

    second = build_reply("39人", user_id=user_id)
    assert "感謝您的詢問" in second
    assert "以下為初步行情" not in second
    assert "請補充" not in second

    third = build_reply("包車 39人 樹林到雲林 10/25 無行李 來回", user_id=user_id)
    assert "以下為初步行情" in third
    assert quote_store.get_session(user_id)["state"] == "QUOTED"


@pytest.mark.parametrize("keyword", ["包車", "詢價", "訂車", "立即報價"])
def test_quote_entry_keywords_return_single_helper_prompt(keyword):
    reply = build_reply(keyword)

    assert "您好，我是小幫手，有什麼我能為您服務。" in reply
    assert "請直接輸入：" in reply
    assert "日期：" in reply
    assert "人數：" in reply
    assert "出發地：" in reply
    assert "目的地：" in reply
    assert "請輸入出車日期" not in reply
    assert "請輸入乘車人數" not in reply


def test_structured_one_shot_quote_is_parsed_and_priced():
    reply = build_reply("包車 日期：6/30\n人數：39\n出發地：樹林\n目的地：雲林\n備註：無")

    assert "您好，我是小幫手。" in reply
    assert "以下為初步行情：" in reply
    assert "建議車型：" not in reply
    assert "43座以上遊覽車 / 44-45座大巴" not in reply
    assert "初步行情：" in reply
    assert "NT$16,000～22,000 起" in reply
    assert "請補充" not in reply
    assert "9000" not in reply
    assert "14500" not in reply
    assert "20500" not in reply


def test_production_single_line_structured_quote_is_parsed_and_priced():
    reply = build_reply("包車 日期：2026-06-30 人數：39 出發地：樹林 目的地：雲林 備註：無")

    assert "請補充" not in reply
    assert "建議車型：" not in reply
    assert "43座以上遊覽車 / 44-45座大巴" not in reply
    assert "初步行情：" in reply
    assert "NT$16,000～22,000 起" in reply
    assert "9000" not in reply
    assert "14500" not in reply
    assert "20500" not in reply


def test_natural_language_quote_requires_charter_session_then_prices_without_note():
    from app.storage import quote_store

    quote_store.reset()
    user_id = "U-natural-charter"
    helper = build_reply("包車", user_id=user_id)
    assert "請直接輸入：" in helper

    reply = build_reply("6月30號 樹林出發 雲林 39位", user_id=user_id)

    assert "以下為初步行情" in reply
    assert "NT$16,000～22,000 起" in reply
    assert "請補充備註" not in reply
    assert "建議車型" not in reply


def test_session_defaults_note_without_requiring_it():
    from app.storage import quote_store

    quote_store.reset()
    user_id = "U-session-default-note"
    build_reply("包車", user_id=user_id)

    reply = build_reply("日期：2026-06-30\n人數：39\n出發地：樹林\n目的地：雲林", user_id=user_id)

    assert "初步行情：" in reply
    assert "NT$16,000～22,000 起" in reply
    assert "請補充備註" not in reply
    assert "建議車型" not in reply
    session = quote_store.get_session(user_id)
    assert session is not None
    assert session["state"] == "QUOTED"
    assert session["draft_json"]["date"] == "2026-06-30"
    assert session["draft_json"]["people"] == 39
    assert session["draft_json"]["origin"] == "樹林"
    assert session["draft_json"]["destination"] == "雲林"
    assert session["draft_json"]["note"] == "無"

def test_old_session_state_is_overridden_by_complete_single_input_quote():
    from app.storage import quote_store

    quote_store.reset()
    user_id = "U-old-session"
    quote_store.upsert_session(user_id, "ASK_PASSENGER", {"trip_date": "2026-06-30"})

    reply = build_reply("包車 日期：2026-06-30 人數：39 出發地：樹林 目的地：雲林 備註：無", user_id=user_id)

    assert "請輸入乘車人數" not in reply
    assert "請補充乘車人數" not in reply
    assert "43座以上遊覽車 / 44-45座大巴" not in reply
    assert "NT$16,000～22,000 起" in reply
    assert quote_store.get_session(user_id)["state"] == "QUOTED"


def test_quoted_acknowledgements_do_not_restart_quote_flow():
    from app.storage import quote_store

    quote_store.reset()
    user_id = "U-quoted-ack"
    first = build_reply("包車 日期：2026-06-30 人數：39 出發地：樹林 目的地：雲林", user_id=user_id)
    assert "以下為初步行情" in first
    assert quote_store.get_session(user_id)["state"] == "QUOTED"

    for message in ["好", "收到", "謝謝"]:
        reply = build_reply(message, user_id=user_id)
        assert "感謝您的詢問" in reply
        assert "【我要正式報價】" in reply
        assert "請補充日期" not in reply
        assert "請補充乘車人數" not in reply


def test_official_quote_request_after_quote_creates_case_with_new_status():
    from app.storage import quote_store

    quote_store.reset()
    user_id = "U-official-quote"
    quote_reply = build_reply("包車 日期：2026-06-30 人數：39 出發地：樹林 目的地：雲林", user_id=user_id)
    assert "以下為初步行情" in quote_reply

    reply = build_reply("我要正式報價", user_id=user_id)

    assert "已收到您的正式報價需求" in reply
    quote = quote_store.latest_quote(user_id)
    assert quote is not None
    assert quote["line_user_id"] == user_id
    assert quote["trip_date"] == "2026-06-30"
    assert quote["passenger_count"] == 39
    assert quote["pickup"] == "樹林"
    assert quote["destination"] == "雲林"
    assert quote["quote_status"] == "new"
    assert quote_store.get_session(user_id)["state"] == "OFFICIAL_QUOTE_FLOW"


def test_official_quote_priority_bypasses_intent_router_words():
    from app.storage import quote_store

    quote_store.reset()
    user_id = "U-official-priority"
    build_reply("包車", user_id=user_id)
    collecting = build_reply("日期：2026-06-30 人數：39 出發地：樹林 目的地：宜蘭", user_id=user_id)
    assert "初步行情" in collecting

    reply = build_reply("正式報價", user_id=user_id)

    assert "已收到您的正式報價需求" in reply
    assert "想去地區" not in reply
    quote = quote_store.latest_quote(user_id)
    assert quote is not None
    assert quote["destination"] == "宜蘭"


def test_active_collecting_session_is_not_intercepted_by_travel_intent():
    from app.storage import quote_store

    quote_store.reset()
    user_id = "U-active-session-priority"
    build_reply("包車", user_id=user_id)
    first = build_reply("日期：2026-06-30 人數：39 出發地：樹林", user_id=user_id)
    assert "請補充目的地" in first

    second = build_reply("宜蘭", user_id=user_id)

    assert "想去地區" not in second
    assert "初步行情" in second
