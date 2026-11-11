/**
 * 大巴範圍報價資料表（單一來源，可整張替換）。每列一個來源註解。金額是「車資範圍」，
 * 司機服務費永遠另列一行（BUS_DRIVER_FEE），不併入範圍。只給範圍，不是確定金額。
 */

export type BusRouteClass =
  | "taipei_city_day" // 雙北／台北市區一日（10 小時）
  | "taipei_half_day" // 雙北半日（4 小時）
  | "taipei_to_taoyuan_hsinchu"
  | "taipei_to_taichung_changhua_lukang_round_trip"
  | "taipei_to_south_long"
  | "mountain";

export type BusSeat = "43" | "33";
export type Band = { low: number; high: number };
export type BusRangeRow = {
  route: BusRouteClass;
  /** null = any seat layout. */
  seat: BusSeat | null;
  seatLabel: string | null;
  label: string;
  weekday: Band;
  /** null = same band any day (no separate holiday data). */
  holiday: Band | null;
  note?: string;
  source: string;
};

export const BUS_RANGE_TABLE: ReadonlyArray<BusRangeRow> = [
  // 老闆 2026-11-11 15:05 大巴參考表：雙北／台北市區一日 10h，43座四排，三家來源交叉確認
  { route: "taipei_city_day", seat: "43", seatLabel: "43 座四排", label: "雙北／台北市區一日（10 小時）", weekday: { low: 9500, high: 11000 }, holiday: { low: 10500, high: 12000 }, source: "老闆 2026-11-11 15:05 大巴參考表（3 家交叉確認）" },
  // 老闆 2026-11-11 15:05 大巴參考表：33/34 座三排，三排椅較寬、可能較高
  { route: "taipei_city_day", seat: "33", seatLabel: "33／34 座三排", label: "雙北／台北市區一日（10 小時）", weekday: { low: 10000, high: 13000 }, holiday: null, note: "三排椅較寬，價格可能較高。", source: "老闆 2026-11-11 15:05 大巴參考表" },
  // 老闆 2026-11-11 15:05 大巴參考表：半日 4h，43 座
  { route: "taipei_half_day", seat: "43", seatLabel: "43 座四排", label: "雙北半日（4 小時）", weekday: { low: 7500, high: 9000 }, holiday: { low: 8500, high: 10000 }, source: "老闆 2026-11-11 15:05 大巴參考表" },
  // backend/knowledge_base/pricing_matrix.yaml taipei_to_taoyuan_hsinchu "12500~15000元"（單一來源，不覆蓋）
  { route: "taipei_to_taoyuan_hsinchu", seat: null, seatLabel: null, label: "台北到桃園、新竹", weekday: { low: 12500, high: 15000 }, holiday: null, source: "pricing_matrix.yaml taipei_to_taoyuan_hsinchu" },
  // pricing_matrix.yaml taipei_to_taichung_changhua_lukang_round_trip "16000~22000元"
  { route: "taipei_to_taichung_changhua_lukang_round_trip", seat: null, seatLabel: null, label: "台北到台中、彰化、鹿港來回", weekday: { low: 16000, high: 22000 }, holiday: null, source: "pricing_matrix.yaml taipei_to_taichung_changhua_lukang_round_trip" },
  // pricing_matrix.yaml taipei_to_south_long "24000~35000元"
  { route: "taipei_to_south_long", seat: null, seatLabel: null, label: "台北到南部長程", weekday: { low: 24000, high: 35000 }, holiday: null, source: "pricing_matrix.yaml taipei_to_south_long" },
  // pricing_rules.py quote_range mountain 分支 "NT$16,000~22,000 起，山區另加價"
  { route: "mountain", seat: null, seatLabel: null, label: "台北到山區", weekday: { low: 16000, high: 22000 }, holiday: null, note: "日月潭、清境、山區另加價", source: "pricing_rules.py quote_range mountain + pricing_matrix.yaml mountain_addon" },
];

/** 老闆 2026-11-11 15:04：大巴司機服務費，平日 2,500、假日 3,500。永遠另列，不併入車資範圍。 */
export const BUS_DRIVER_FEE = { weekday: 2500, holiday: 3500, source: "老闆 2026-11-11 15:04" } as const;

export function busRangeRow(route: BusRouteClass, seat: BusSeat = "43") {
  return BUS_RANGE_TABLE.find((row) => row.route === route && row.seat === seat)
    || BUS_RANGE_TABLE.find((row) => row.route === route && row.seat === null)
    || BUS_RANGE_TABLE.find((row) => row.route === route)
    || null;
}
