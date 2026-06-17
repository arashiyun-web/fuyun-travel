from __future__ import annotations


INFO_REQUEST = "請協助補充缺少項目。"

DRIVER_TIP_LINE = "司機小費 NT$1,000~2,000/天"
DRIVER_MEAL_LINE = "司機誤餐費 NT$250/餐"


def recommended_vehicle(passenger_count: int | None, text: str = "") -> str:
    from app.pricing_rules import recommended_vehicle as _recommended_vehicle

    return _recommended_vehicle(passenger_count, text)


def _is_large_bus(passenger_count: int | None, text: str = "") -> bool:
    return (passenger_count is not None and passenger_count >= 39) or any(term in text for term in ["43座", "44座", "45座", "大巴", "遊覽車"])


def _has_round_trip(text: str) -> bool:
    return any(term in text for term in ["來回", "往返", "回程", "雙程", "⇄"])


def _has_all(text: str, terms: list[str]) -> bool:
    return all(term in text for term in terms)


def quote_range(passenger_count: int | None, text: str = "") -> str:
    from app.pricing_rules import quote_range as _quote_range

    return _quote_range(passenger_count, text)


def format_initial_quote(passenger_count: int | None = None, text: str = "") -> str:
    price = quote_range(passenger_count, text).replace("~", "～")

    return "\n".join(
        [
            "您好，我是小幫手。",
            "",
            "以下為初步行情：",
            "",
            "初步行情：",
            price,
            "",
            "實際價格仍需依日期、",
            "停靠點、",
            "行李量、",
            "車輛調度確認。",
            "",
            "如需正式報價，",
            "真人客服將協助確認。",
            "",
            "如需正式報價請回覆：",
            "",
            "【我要正式報價】",
        ]
    )
