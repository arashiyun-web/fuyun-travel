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

/** Owner text kept off the public site until it is reviewed. Not a legal opinion. */
const internalReviewNotes: Record<string, readonly string[]> = {
  "toyota-midibus": [
    "內部待審原意：取消收總車資 30%，或沒收全數已付訂金。",
    "內部待審原意：不得取消、不得延期。",
    "內部待審原意：另有廣泛免責。尚未當成已合法核可的公開條款，也不改寫成法律意見。",
  ],
};

function money(amount: number | null) {
  return amount === null ? "洽詢" : `${amount.toLocaleString("zh-Hant-TW")} 元`;
}

const mercedes: PublicFleetProfile = {
  slug: "mercedes-van",
  title: "賓士小車",
  cardSummary: "賓士小車。台北一日遊與台北至九份，用車 10 小時各 7,000 元，含油資、過路費與停車費。座位數尚未提供。",
  detail: "賓士小車可安排台北一日遊與台北至九份。座位數、訂金金額與夜間加價金額都還沒有資料，頁面標成洽詢，不填 0，也不把這台車寫成公司自有。",
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
        "實車照片四張：外觀、獨立乘客座、後座、前座。只用於這台小車。",
        "品牌：賓士。具體型號未提供。",
        "座位數：尚未提供，洽詢。",
        "頁面不把這台車標成公司自有車輛。",
        "行李：最多 7 個 29 吋行李箱，仍要依乘車人數與實車確認。",
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
      heading: "超時，不自動計費",
      lines: [
        "超過約定時間半小時以上才計超時。",
        "已得知：半小時 300 元、1 小時 500 元。",
        "未滿該段、或跨段要怎麼進位，資料沒有寫死。這裡不自動算出超時費，請人工確認。",
      ],
    },
    {
      heading: "須人工確認",
      lines: [
        "需要訂金。訂金金額洽詢。取消規則未定，洽詢。",
        "可安排兒童安全座椅。是否收費未知，洽詢。",
        "晚上 23 點後加價。加價金額未定，洽詢。",
      ],
    },
  ],
};

const toyota: PublicFleetProfile = {
  slug: "toyota-midibus",
  title: "TOYOTA 中巴",
  cardSummary: "TOYOTA 中巴，含司機 21 座、最多 20 位乘客，建議不要坐滿。台北至九份 10 小時 9,000 元。",
  detail: "TOYOTA 中巴依客人的行程安排，不把參考景點當成固定保證行程。台北一日遊價格未提供，頁面不沿用其他車種的價格。",
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
        "實車照片四張：側面全車、正面、內裝往前、內裝往後。只用於這台中巴。",
        "車身標示為昱境通運公司。本頁不把它說成雲陞自有車輛。",
        "車種：TOYOTA 中巴。具體型號未提供。",
        "含司機共 21 座，最多 20 位乘客。建議不要坐滿。",
        "行李容量依實際情況確認。",
      ],
    },
    {
      heading: "已確認費用",
      lines: [
        "台北至九份，用車 10 小時：9,000 元。",
        "台北一日遊價格未提供，洽詢。",
        "含駕駛薪資、過橋過路費、油資、法定乘客意外險。",
        "不含門票、接駁車費、停車費與過夜停車費（實報實銷）、訂車方食宿、稅金。",
        "司機餐點由客人負責，或每餐補貼 200 元。",
        "22:00–06:30 依行程加 500–2,000 元，不是單一固定價，出車前人工確認。",
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
        "多日遊依客人行程安排，不把原先提到的參考景點當成固定保證行程。",
        "兒童座椅須由客人自備。",
        "遠程無法當天往返時，要安排司機住宿。住宿補貼金額未提供，洽詢。",
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
