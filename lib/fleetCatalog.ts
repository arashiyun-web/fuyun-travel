/**
 * Structured vehicle facts the public fleet pages read.
 * This is not the LINE auto-quote engine. LINE still uses its own hardcoded ranges.
 * Amounts are null when the owner did not give a number. Never store those as 0.
 * Photos stay empty until the real vehicle files arrive. Do not point at another vehicle.
 */

export const FLEET_CATALOG_LINE_AUTO_QUOTE = false as const;

export type FleetRateId = "taipei-day-10h" | "taipei-jiufen-10h";

export type FleetRate = {
  id: FleetRateId;
  label: string;
  hours: number;
  amountTwd: number | null;
};

export type FleetSection = {
  heading: string;
  lines: string[];
};

export type PublicFleetProfile = {
  slug: string;
  title: string;
  cardSummary: string;
  detail: string;
  keywords: string[];
  /** Only this vehicle's own files. Empty means the photo area is not ready. */
  photos: string[];
  photosReady: boolean;
  /** False while this vehicle's own photos are missing. */
  readyForLaunch: boolean;
  /** Pages may display these rates. They are not sent to LINE. */
  rates: FleetRate[];
  sections: FleetSection[];
  lineAutoQuote: false;
};

const mercedesRates: FleetRate[] = [
  { id: "taipei-day-10h", label: "台北一日遊，用車 10 小時", hours: 10, amountTwd: 7000 },
  { id: "taipei-jiufen-10h", label: "台北至九份，用車 10 小時", hours: 10, amountTwd: 7000 },
];

const toyotaRates: FleetRate[] = [
  { id: "taipei-day-10h", label: "台北一日遊，用車 10 小時", hours: 10, amountTwd: null },
  { id: "taipei-jiufen-10h", label: "台北至九份，用車 10 小時", hours: 10, amountTwd: 9000 },
];

/** Staff notes. Public pages must not render these. */
const internalReviewNotes: Record<string, readonly string[]> = {
  "mercedes-van": [
    "座位數未提供，不得從照片推測，公開文案不寫座位數字。",
    "訂金金額與取消規則未定。不填 0。",
    "兒童安全座椅可安排，是否收費未知。",
    "晚上 23 點後加價，金額未定。",
    "超時已得知半小時 300 元、1 小時 500 元，且超過約定時間半小時以上才計。不足該段或跨段如何進位沒有寫死，不得自動計費。",
    "具體型號未提供。不宣稱公司自有，公開頁也不解釋車輛歸屬。",
  ],
  "toyota-midibus": [
    "內部待審原意：取消收總車資 30%，或沒收全數已付訂金。",
    "內部待審原意：不得取消、不得延期。",
    "內部待審原意：另有廣泛免責。尚未當成已合法核可的公開條款，也不改寫成法律意見。",
    "車身標示為昱境通運公司。公開頁不說明車身公司身分，也不宣稱雲陞自有。",
    "台北一日遊價格未提供，不得沿用其他車種價格，公開頁不寫這句施工說明。",
    "司機住宿補貼金額未提供，不得沿用小車每晚 1,500 元。",
    "多日遊不把參考景點當成固定保證行程。公開頁只寫依行程安排。",
    "具體型號未提供。22:00–06:30 是 500–2,000 元區間，不是單一固定價。",
  ],
};

function money(amount: number | null) {
  return amount === null ? "洽詢" : `${amount.toLocaleString("zh-Hant-TW")} 元`;
}

const mercedes: PublicFleetProfile = {
  slug: "mercedes-van",
  title: "賓士小車",
  cardSummary: "賓士小車。台北一日遊與台北至九份，用車 10 小時各 7,000 元，含油資、過路費與停車費。座位與行李配置請於預訂時確認。",
  detail: "賓士小車可安排台北一日遊與台北至九份。座位、行李、訂金與夜間用車，請於預訂時一併確認。",
  keywords: ["賓士小車", "台北九份包車", "小車包車"],
  photos: [
    "/fleet/mercedes-van-exterior.webp",
    "/fleet/mercedes-van-captain.webp",
    "/fleet/mercedes-van-rear.webp",
    "/fleet/mercedes-van-front.webp",
  ],
  photosReady: true,
  readyForLaunch: true,
  rates: mercedesRates,
  lineAutoQuote: false,
  sections: [
    {
      heading: "車型",
      lines: [
        "賓士小車，適合市區與近程一日行程。",
        "座位與行李配置請於預訂時確認。",
        "行李以最多 7 個 29 吋行李箱為參考，仍依乘車人數與當日車輛確認。",
      ],
    },
    {
      heading: "已確認費用",
      lines: [
        ...mercedesRates.map((rate) => `${rate.label}：${money(rate.amountTwd)}`),
        "上述兩種 10 小時用車含油資、過路費、停車費。",
        "機場航廈接機，舉牌加 100 元。",
        "司機住宿由客人安排，或每晚補貼 1,500 元。",
      ],
    },
    {
      heading: "超時",
      lines: [
        "超時費半小時 300 元、1 小時 500 元，超過約定時間半小時以上計收；具體計費請於預訂時確認。",
      ],
    },
    {
      heading: "預訂時確認",
      lines: [
        "訂金及取消改期規則請於預訂時確認。",
        "兒童安全座椅請預先告知需求，費用另行確認。",
        "晚上 23 點後用車，夜間加價依行程另行確認。",
      ],
    },
  ],
};

const toyota: PublicFleetProfile = {
  slug: "toyota-midibus",
  title: "TOYOTA 中巴",
  cardSummary: "TOYOTA 中巴。含司機 21 座，最多 20 位乘客，建議保留座位以維持舒適度。台北至九份 10 小時 9,000 元。",
  detail: "TOYOTA 中巴可依行程安排一日或多日用車。台北至九份 10 小時 9,000 元，台北一日遊費用請於預訂時確認。",
  keywords: ["TOYOTA 中巴", "中巴包車", "台北九份中巴"],
  photos: [
    "/fleet/toyota-midibus-side.webp",
    "/fleet/toyota-midibus-interior-front.webp",
    "/fleet/toyota-midibus-interior-rear.webp",
    "/fleet/toyota-midibus-front.webp",
  ],
  photosReady: true,
  readyForLaunch: true,
  rates: toyotaRates,
  lineAutoQuote: false,
  sections: [
    {
      heading: "車型",
      lines: [
        "TOYOTA 中巴。",
        "含司機 21 座，最多 20 位乘客，建議保留座位以維持舒適度；行李依實際人數及尺寸確認。",
      ],
    },
    {
      heading: "已確認費用",
      lines: [
        "台北至九份，用車 10 小時：9,000 元。",
        "台北一日遊費用請於預訂時確認。",
        "含駕駛薪資、過橋過路費、油資、法定乘客意外險。",
        "不含門票、接駁車費、停車費與過夜停車費（實報實銷）、訂車方食宿、稅金。",
        "司機餐點由客人負責，或每餐補貼 200 元。",
        "22:00–06:30 依行程加收 500–2,000 元。",
        "台北、新北超時每小時 800 元。不足 1 小時以 1 小時計。時間包含報到、行駛、等待待命。",
        "接機舉牌免費。",
        "送機若超過約定出發時間，每 30 分鐘加 500 元。",
        "接送機等待超過 45 分鐘，可以終止。",
        "班機更改請盡快通知，可能另派車或取消。提前降落會盡量配合。",
      ],
    },
    {
      heading: "行程與其他條件",
      lines: [
        "多日遊依客人行程安排。",
        "兒童座椅請客人自備。",
        "遠程無法當天往返時，請於預訂時確認司機住宿安排。",
      ],
    },
  ],
};

const profiles = [mercedes, toyota];

export function publicFleetProfiles(): PublicFleetProfile[] {
  return profiles.map((profile) => ({
    ...profile,
    photos: [...profile.photos],
    rates: profile.rates.map((rate) => ({ ...rate })),
    sections: profile.sections.map((section) => ({ ...section, lines: [...section.lines] })),
  }));
}

export function publicFleetProfile(slug: string) {
  return publicFleetProfiles().find((profile) => profile.slug === slug) || null;
}

/** Confirmed amount only. Unknown routes and unknown vehicles return null, never 0. */
export function confirmedVehicleRate(slug: string, rateId: FleetRateId): number | null {
  const rate = publicFleetProfile(slug)?.rates.find((item) => item.id === rateId);
  return rate?.amountTwd ?? null;
}

export function fleetLaunchBlocked(slug: string) {
  const profile = publicFleetProfile(slug);
  if (!profile) return false;
  return profile.photos.length === 0 || profile.photosReady === false || profile.readyForLaunch === false;
}

/** Internal pending notes. Public pages must not render this. */
export function internalFleetReviewNotes(slug: string): readonly string[] {
  return internalReviewNotes[slug] || [];
}
