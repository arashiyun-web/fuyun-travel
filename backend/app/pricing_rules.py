from __future__ import annotations


NORTHERN_ORIGINS = ["樹林", "板橋", "新北", "台北", "臺北", "雙北"]
NEAR_DESTINATIONS = ["桃園", "新竹"]
CENTRAL_DESTINATIONS = ["苗栗", "台中", "臺中", "彰化", "鹿港", "雲林", "雲林縣", "嘉義", "嘉義縣", "嘉義市", "台南", "臺南", "高雄", "屏東"]
MOUNTAIN_DESTINATIONS = ["日月潭", "清境", "合歡山", "阿里山", "山區"]


def has_large_bus(passenger_count: int | None, text: str = "") -> bool:
    return (passenger_count is not None and passenger_count >= 20) or any(term in text for term in ["43座", "44座", "45座", "大巴", "遊覽車"])


def recommended_vehicle(passenger_count: int | None, text: str = "") -> str:
    if has_large_bus(passenger_count, text):
        return "43座以上遊覽車 / 44-45座大巴"
    return ""


def _has_any(text: str, terms: list[str]) -> bool:
    return any(term in text for term in terms)


def _is_northern_origin(text: str) -> bool:
    return _has_any(text, NORTHERN_ORIGINS)


def classify_route(text: str) -> str:
    if _is_northern_origin(text) and _has_any(text, MOUNTAIN_DESTINATIONS):
        return "mountain"
    if _is_northern_origin(text) and _has_any(text, CENTRAL_DESTINATIONS):
        return "central_south"
    if _is_northern_origin(text) and _has_any(text, NEAR_DESTINATIONS):
        return "near"
    return "taipei_short"


def quote_range(passenger_count: int | None, text: str = "") -> str:
    if not has_large_bus(passenger_count, text):
        return "NT$12,000~18,000 起"

    route_class = classify_route(text)
    if route_class == "central_south":
        return "NT$16,000~22,000 起"
    if route_class == "near":
        return "NT$12,500~15,000 起"
    if route_class == "mountain":
        return "NT$16,000~22,000 起，山區另加價"
    return "NT$11,000~12,500 起"
