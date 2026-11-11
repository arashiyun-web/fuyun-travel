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
  /** Optional Traditional Chinese alt text per photo path. Missing paths use the page default. */
  photoAlts?: Record<string, string>;
  /** Optional /fleet card main photo. Defaults to photos[0]. */
  cardPhoto?: string;
  /** Optional /fleet card thumbnails. Defaults to photos.slice(1, 3). */
  cardThumbs?: string[];
  photosReady: boolean;
  /** False while this vehicle's own photos are missing. */
  readyForLaunch: boolean;
  sections: FleetSection[];
  faqs: { question: string; answer: string }[];
  lineAutoQuote: false;
};

export type CatalogFee = {
  id: string;
  label: string;
  /** included is already inside the package fare. payment is a deposit, not part of the fare. term is not a price. */
  role: "included" | "surcharge" | "payment" | "term";
  /** Null when no unit rate was given. Never invent one. */
  unitAmountTwd: number | null;
  quantityLabel: "晚" | "餐" | "小時" | "次" | null;
  /** Inclusive checked range. Absent when the catalog did not give one. */
  minAmountTwd?: number | null;
  maxAmountTwd?: number | null;
  source: string;
};

export type FleetQuoteRecord = {
  slug: string;
  lineAutoQuote: false;
  rates: FleetRate[];
  /** Verified commercial conditions. Not rendered on /fleet. */
  conditions: string[];
  fees: CatalogFee[];
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
    "九人座（老闆 11/7 確認）；可載乘客數含不含司機待確認，不自行推算。",
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

const mercedes: PublicFleetProfile = {
  slug: "mercedes-van",
  title: "九人座賓士小車",
  cardSummary: "九人座賓士小車，適合四人以上的家庭、朋友小團體。車內有獨立乘客座與後座，行李依人數與行李箱尺寸確認。",
  detail: "適合四人以上的家庭與朋友小團體同行，車內設有獨立乘客座與後座；可依同行人數與行李需求確認座位配置。",
  keywords: ["九人座賓士", "家庭包車", "小團體包車"],
  photos: [
    "/fleet/mercedes-van-exterior.webp",
    "/fleet/mercedes-van-captain.webp",
    "/fleet/mercedes-van-rear.webp",
    "/fleet/mercedes-van-front.webp",
  ],
  photosReady: true,
  readyForLaunch: true,
  lineAutoQuote: false,
  sections: [
    {
      heading: "適合誰",
      lines: [
        "九人座賓士小車，適合四人以上的家庭、朋友小團體。",
        "適合同一趟行程、人數還不需要中巴的客人。",
      ],
    },
    {
      heading: "乘坐與行李",
      lines: [
        "車內有獨立乘客座，後方另有後座。",
        "行李依乘車人數與行李箱尺寸確認。",
      ],
    },
  ],
  faqs: [
    {
      question: "九人座賓士小車適合幾人？",
      answer: "適合四人以上的家庭、朋友小團體。實際怎麼坐、行李怎麼放，預訂時依人數確認。",
    },
    {
      question: "和小巴、大巴怎麼選？",
      answer: "四人以上、想坐同一台小車，選九人座賓士。人數已經接近二十人的親友或公司小團，看中巴。大型團體用 42 人座遊覽車。",
    },
    {
      question: "行李怎麼算？",
      answer: "依乘車人數與行李箱尺寸確認，不另保證坐滿時可放幾個大箱。",
    },
  ],
};

const toyota: PublicFleetProfile = {
  slug: "toyota-midibus",
  title: "TOYOTA 中巴",
  cardSummary: "TOYOTA 中巴，含司機 21 座、最多 20 位乘客。適合親友同行、公司小型團體與團體出遊，建議不要坐滿。",
  detail: "中巴給已經坐不進一台小車、又還不需要 42 人座大巴的團體。含司機 21 座，最多 20 位乘客。建議保留座位，讓同行旅客坐得更舒適；行李依人數與尺寸事先確認。適合親友同行、公司小型團體與團體出遊。",
  keywords: ["TOYOTA 中巴", "中巴包車", "台北九份中巴"],
  photos: [
    "/fleet/toyota-midibus-exterior-front.webp",
    "/fleet/toyota-midibus-exterior-side-door.webp",
    "/fleet/toyota-midibus-exterior-side-left.webp",
    "/fleet/toyota-midibus-side.webp",
    "/fleet/toyota-midibus-interior-front.webp",
    "/fleet/toyota-midibus-interior-rear.webp",
    "/fleet/toyota-midibus-front.webp",
  ],
  photoAlts: {
    "/fleet/toyota-midibus-exterior-front.webp": "TOYOTA 中巴正面外觀，白色車身與大片前擋風玻璃",
    "/fleet/toyota-midibus-exterior-side-door.webp": "TOYOTA 中巴右側外觀，白色車身與中段乘客車門",
    "/fleet/toyota-midibus-exterior-side-left.webp": "TOYOTA 中巴左側外觀，白色車身與整排側窗",
  },
  cardPhoto: "/fleet/toyota-midibus-exterior-side-door.webp",
  cardThumbs: [
    "/fleet/toyota-midibus-interior-front.webp",
    "/fleet/toyota-midibus-interior-rear.webp",
  ],
  photosReady: true,
  readyForLaunch: true,
  lineAutoQuote: false,
  sections: [
    {
      heading: "適合誰",
      lines: [
        "含司機 21 座，最多 20 位乘客，建議不要坐滿。",
        "適合親友同行、公司小型團體與團體出遊。",
      ],
    },
    {
      heading: "乘坐與行李",
      lines: [
        "建議保留座位，讓同行旅客坐得更舒適；行李依人數與尺寸事先確認。",
        "多日遊依客人自己的行程安排。",
      ],
    },
  ],
  faqs: [
    {
      question: "TOYOTA 中巴適合什麼團體？",
      answer: "適合親友同行、公司小型團體與團體出遊。含司機 21 座，最多 20 位乘客，建議不要坐滿。",
    },
    {
      question: "和九人座小車怎麼分？",
      answer: "四人以上的家庭、朋友坐九人座賓士小車。人數已經超過一台小車、又還不用 42 人座大巴，選這台中巴。",
    },
  ],
};

const quoteBook: FleetQuoteRecord[] = [
  {
    slug: "mercedes-van",
    lineAutoQuote: false,
    rates: mercedesRates,
    conditions: [
      "台北一日遊與台北至九份，用車 10 小時各 7000 元。",
      "含油資、過路費、停車費。",
      "機場航廈接機，舉牌加 100 元。",
      "司機住宿由客人安排，或每晚補貼 1500 元。",
      "超過約定時間半小時以上才計超時；半小時 300 元、1 小時 500 元。不足該段或跨段如何進位未寫死，不得自動計費。",
      "需要訂金。金額與取消規則未定。",
      "可安排兒童安全座椅，是否收費未知。",
      "晚上 23 點後加價，金額未定。",
      "行李最多 7 個 29 吋箱，依乘車人數與實車確認，坐滿時不保證仍可放入。",
      "九人座（老闆 11/7 確認）；可載乘客數含不含司機待確認，不自行推算。",
    ],
    fees: [
      { id: "running", label: "油資、過路費、停車費", role: "included", unitAmountTwd: null, quantityLabel: null, source: "含油資、過路費、停車費。" },
      { id: "sign", label: "機場航廈接機舉牌", role: "surcharge", unitAmountTwd: 100, quantityLabel: "次", source: "機場航廈接機，舉牌加 100 元。" },
      { id: "lodging", label: "司機住宿", role: "surcharge", unitAmountTwd: 1500, quantityLabel: "晚", source: "司機住宿由客人安排，或每晚補貼 1500 元。" },
      { id: "overtime", label: "超時", role: "surcharge", unitAmountTwd: null, quantityLabel: null, source: "超過約定時間半小時以上才計超時；半小時 300 元、1 小時 500 元。不足該段或跨段如何進位未寫死，不得自動計費。" },
      { id: "deposit", label: "訂金", role: "payment", unitAmountTwd: null, quantityLabel: null, source: "需要訂金。金額與取消規則未定。" },
      { id: "cancellation", label: "取消規則", role: "term", unitAmountTwd: null, quantityLabel: null, source: "需要訂金。金額與取消規則未定。" },
      { id: "child-seat", label: "兒童安全座椅", role: "surcharge", unitAmountTwd: null, quantityLabel: null, source: "可安排兒童安全座椅，是否收費未知。" },
      { id: "night", label: "晚上 23 點後加價", role: "surcharge", unitAmountTwd: null, quantityLabel: null, source: "晚上 23 點後加價，金額未定。" },
    ],
  },
  {
    slug: "toyota-midibus",
    lineAutoQuote: false,
    rates: toyotaRates,
    conditions: [
      "台北至九份，用車 10 小時 9000 元。",
      "台北一日遊價格未提供。",
      "含駕駛薪資、過橋過路費、油資、法定乘客意外險。",
      "不含門票、接駁車費、停車費與過夜停車費（實報實銷）、訂車方食宿、稅金。",
      "司機餐點由客人負責，或每餐補貼 200 元。",
      "22:00–06:30 依行程加 500–2000 元，不是單一固定價。",
      "台北、新北超時每小時 800 元。不足 1 小時以 1 小時計。時間包含報到、行駛、等待待命。",
      "接機舉牌免費。送機超過約定出發時間，每 30 分鐘加 500 元。接送機等待超過 45 分鐘可以終止。",
      "班機更改請盡快通知，可能另派車或取消。提前降落盡量配合。",
      "兒童座椅須由客人自備。",
      "遠程無法當天往返需安排司機住宿。住宿補貼金額未提供，不得沿用小車每晚 1500 元。",
      "含司機 21 座，最多 20 位乘客，建議不要坐滿。",
    ],
    fees: [
      { id: "running", label: "駕駛薪資、過橋過路費、油資、法定乘客意外險", role: "included", unitAmountTwd: null, quantityLabel: null, source: "含駕駛薪資、過橋過路費、油資、法定乘客意外險。" },
      { id: "tickets", label: "門票", role: "surcharge", unitAmountTwd: null, quantityLabel: null, source: "不含門票、接駁車費、停車費與過夜停車費（實報實銷）、訂車方食宿、稅金。" },
      { id: "shuttle", label: "接駁車費", role: "surcharge", unitAmountTwd: null, quantityLabel: null, source: "不含門票、接駁車費、停車費與過夜停車費（實報實銷）、訂車方食宿、稅金。" },
      { id: "parking", label: "停車費", role: "surcharge", unitAmountTwd: null, quantityLabel: null, source: "不含門票、接駁車費、停車費與過夜停車費（實報實銷）、訂車方食宿、稅金。" },
      { id: "overnight-parking", label: "過夜停車費", role: "surcharge", unitAmountTwd: null, quantityLabel: null, source: "不含門票、接駁車費、停車費與過夜停車費（實報實銷）、訂車方食宿、稅金。" },
      { id: "guest-lodging", label: "訂車方食宿", role: "surcharge", unitAmountTwd: null, quantityLabel: null, source: "不含門票、接駁車費、停車費與過夜停車費（實報實銷）、訂車方食宿、稅金。" },
      { id: "tax", label: "稅金", role: "surcharge", unitAmountTwd: null, quantityLabel: null, source: "不含門票、接駁車費、停車費與過夜停車費（實報實銷）、訂車方食宿、稅金。" },
      { id: "meals", label: "司機餐點", role: "surcharge", unitAmountTwd: 200, quantityLabel: "餐", source: "司機餐點由客人負責，或每餐補貼 200 元。" },
      { id: "driver-lodging", label: "司機住宿補貼", role: "surcharge", unitAmountTwd: null, quantityLabel: null, source: "遠程無法當天往返需安排司機住宿。住宿補貼金額未提供，不得沿用小車每晚 1500 元。" },
      { id: "night", label: "22:00–06:30 加價", role: "surcharge", unitAmountTwd: null, quantityLabel: null, minAmountTwd: 500, maxAmountTwd: 2000, source: "22:00–06:30 依行程加 500–2000 元，不是單一固定價。" },
      { id: "overtime", label: "超時", role: "surcharge", unitAmountTwd: 800, quantityLabel: "小時", source: "台北、新北超時每小時 800 元。不足 1 小時以 1 小時計。時間包含報到、行駛、等待待命。" },
      { id: "pickup-sign", label: "接機舉牌", role: "included", unitAmountTwd: null, quantityLabel: null, source: "接機舉牌免費。送機超過約定出發時間，每 30 分鐘加 500 元。接送機等待超過 45 分鐘可以終止。" },
      { id: "dropoff-wait", label: "送機超過約定出發時間", role: "surcharge", unitAmountTwd: 500, quantityLabel: "次", source: "接機舉牌免費。送機超過約定出發時間，每 30 分鐘加 500 元。接送機等待超過 45 分鐘可以終止。" },
      { id: "child-seat", label: "兒童座椅", role: "term", unitAmountTwd: null, quantityLabel: null, source: "兒童座椅須由客人自備。" },
      { id: "flight-change", label: "班機更改", role: "term", unitAmountTwd: null, quantityLabel: null, source: "班機更改請盡快通知，可能另派車或取消。提前降落盡量配合。" },
    ],
  },
];

const profiles = [mercedes, toyota];

export function publicFleetProfiles(): PublicFleetProfile[] {
  return profiles.map((profile) => ({
    ...profile,
    photos: [...profile.photos],
    ...(profile.photoAlts ? { photoAlts: { ...profile.photoAlts } } : {}),
    ...(profile.cardThumbs ? { cardThumbs: [...profile.cardThumbs] } : {}),
    sections: profile.sections.map((section) => ({ ...section, lines: [...section.lines] })),
    faqs: profile.faqs.map((item) => ({ ...item })),
  }));
}

export function fleetQuoteRecord(slug: string) {
  const record = quoteBook.find((item) => item.slug === slug);
  if (!record) return null;
  return { ...record, rates: record.rates.map((rate) => ({ ...rate })), conditions: [...record.conditions], fees: record.fees.map((fee) => ({ ...fee })) };
}

export function publicFleetProfile(slug: string) {
  return publicFleetProfiles().find((profile) => profile.slug === slug) || null;
}

/** Confirmed amount only. Unknown routes and unknown vehicles return null, never 0. */
export function confirmedVehicleRate(slug: string, rateId: FleetRateId): number | null {
  const rate = fleetQuoteRecord(slug)?.rates.find((item) => item.id === rateId);
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
