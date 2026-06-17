import type { ParsedTrip } from "./types";

const PRICE_RE = /(?:[$＄NT＄]|新台幣|台幣|NT\$)?\s*(\d{1,3}(?:[,，]\d{3})*)\s*(?:元|円|TWD|NTD|\/人|元\/人)?/g;
const DAYS_RE = /(\d+)\s*天\s*(\d+)?\s*夜?|一日遊|半日遊|兩日一夜|三日兩夜/;
const SEASON_RE = /([1-9]|1[0-2])\s*月(?:上旬|中旬|下旬)?|春季?|夏季?|秋季?|冬季?|桐花季|賞楓季?|賞花季?|賞螢季?|梅花季?|油桐花/g;
const AUDIENCE_RE = /適合([^，,。\n]{2,20})|推薦給([^，,。\n]{2,20})|(?:長輩|銀髮|親子|家庭|情侶|朋友|企業|公司|員工|學生|團體)/g;

function extractPrice(text: string): string {
  const matches: string[] = [];
  let m: RegExpExecArray | null;
  PRICE_RE.lastIndex = 0;
  while ((m = PRICE_RE.exec(text)) !== null) {
    const raw = m[1].replace(/[,，]/g, "");
    const n = parseInt(raw, 10);
    if (n >= 100 && n <= 999999) {
      matches.push(raw);
    }
  }
  return matches.length ? matches[0] : "";
}

function extractDays(text: string): string {
  const m = text.match(DAYS_RE);
  return m ? m[0] : "";
}

function extractSeason(text: string): string {
  const found: string[] = [];
  let m: RegExpExecArray | null;
  const re = new RegExp(SEASON_RE.source, "g");
  while ((m = re.exec(text)) !== null) {
    if (!found.includes(m[0])) found.push(m[0]);
  }
  return found.slice(0, 3).join("、");
}

function extractSpots(text: string): string[] {
  const spotRe =
    /「([^」]{2,15})」|【([^】]{2,15})】|(\S{2,10}(?:步道|老街|景點|瀑布|湖|山|園|廟|橋|森林|海岸|公園|農場|溫泉|市場))/g;
  const spots: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = spotRe.exec(text)) !== null) {
    const s = (m[1] || m[2] || m[3] || "").trim();
    if (s && !spots.includes(s)) spots.push(s);
    if (spots.length >= 10) break;
  }
  return spots;
}

function extractAudience(text: string): string {
  const found: string[] = [];
  let m: RegExpExecArray | null;
  const re = new RegExp(AUDIENCE_RE.source, "g");
  while ((m = re.exec(text)) !== null) {
    const a = (m[1] || m[2] || m[0] || "").trim();
    if (a && !found.includes(a)) found.push(a);
    if (found.length >= 3) break;
  }
  return found.join("、");
}

function extractTitle(text: string): string {
  const firstLine = text.split(/[\n\r]/)[0].trim();
  return firstLine.slice(0, 60) || text.slice(0, 40).trim();
}

export function parseInput(
  text: string,
  formOverrides: Partial<ParsedTrip> = {},
): ParsedTrip {
  const price = formOverrides.price !== undefined
    ? formOverrides.price
    : extractPrice(text);

  const days = formOverrides.days !== undefined && formOverrides.days !== ""
    ? formOverrides.days
    : extractDays(text);

  const season = formOverrides.season !== undefined && formOverrides.season !== ""
    ? formOverrides.season
    : extractSeason(text);

  const spots = formOverrides.spots && formOverrides.spots.length > 0
    ? formOverrides.spots
    : extractSpots(text);

  const target_audience =
    formOverrides.target_audience !== undefined && formOverrides.target_audience !== ""
      ? formOverrides.target_audience
      : extractAudience(text);

  return {
    trip_title: formOverrides.trip_title || extractTitle(text),
    days,
    season,
    price,
    spots,
    user_notes: text,
    target_audience,
    additional_info: formOverrides.additional_info || "",
  };
}
