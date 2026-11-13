/**
 * 服務頁「答案先行」內容與價目表（AEO 2026-11-13）。
 *
 * 價格只取 repo 內已存在、已公開或老闆已確認的真實數字，不自編：
 * - 42 人座大巴：lib/charterFaq.ts「42 人座大巴」（2026-09-15 老闆口述），與 lib/siteContent.ts fleet coach-42、
 *   app/services/page.tsx Vehicle schema 一致。
 * - 九人座（賓士）：lib/charterFaq.ts「九人座（賓士）」與 lib/fleetCatalog.ts quoteBook mercedes-van（老闆 11/7 確認）一致。
 * - TOYOTA 中巴：lib/charterFaq.ts 寫「台北到九份 9500 元」，lib/fleetCatalog.ts quoteBook 寫「台北至九份 10 小時 9000 元」，
 *   兩處不一致，且 fleetCatalog 註明台北一日遊價格未提供，所以這裡不寫中巴車資，一律「請洽 LINE 詢價，由專人報價」。
 *   中巴的取消／違約條款 fleetCatalog 註明「尚未當成已合法核可的公開條款」，這裡也不寫。
 * 沒有給金額的項目（夜間加價、兒童座椅、訂金金額）只寫規則，不寫數字。
 */
import { absoluteUrl, organizationJsonLd } from "@/lib/site";
import { AEO_FIX_DATE } from "@/lib/contentDates";

export const SERVICE_PAGES_UPDATED = AEO_FIX_DATE;
export const LINE_QUOTE_TEXT = "請洽 LINE 詢價，由專人報價";

export type VehiclePrice = {
  id: "coach-42" | "van-9" | "midibus";
  vehicle: string;
  fleetPath: string;
  /** 台北一日遊（用車 10 小時）；null = 不寫數字，請洽 LINE 詢價。 */
  taipeiDayTwd: number | null;
  hours: number | null;
  includes: string;
  excludes: string;
  overtime: string;
  night: string;
  airportSign: string;
  driverLodging: string;
  luggage: string;
  childSeat: string;
};

export const vehiclePrices: VehiclePrice[] = [
  {
    id: "coach-42",
    vehicle: "42 人座大巴",
    fleetPath: "/fleet/coach-42",
    taipeiDayTwd: 14000,
    hours: 10,
    includes: "駕駛薪資、油費、過路費、停車費",
    excludes: "景點門票、餐費",
    overtime: "超時 30 分鐘加 500 元，1 小時加 800 元",
    night: "超過晚上 11 點用車會加價",
    airportSign: "一般在航廈接機；舉牌接機另加 200 元",
    driverLodging: "可由客人幫司機訂房，或補貼司機住宿一晚 1,500 元",
    luggage: "15 個 29 吋行李箱都能容納",
    childSeat: "有安排兒童座椅",
  },
  {
    id: "van-9",
    vehicle: "九人座（賓士）",
    fleetPath: "/fleet/mercedes-van",
    taipeiDayTwd: 7000,
    hours: 10,
    includes: "油費、過路費、停車費",
    excludes: "景點門票、餐費",
    overtime: "超過約定時間半小時以上才計超時：30 分鐘加 300 元，1 小時加 500 元",
    night: "超過晚上 11 點用車會加價",
    airportSign: "一般在航廈接機；舉牌接機另加 100 元",
    driverLodging: "可由客人幫司機訂房，或補貼司機住宿一晚 1,500 元",
    luggage: "最多約 7 個 29 吋行李箱，依乘車人數確認",
    childSeat: "可安排兒童安全座椅",
  },
  {
    id: "midibus",
    vehicle: "TOYOTA 中巴（含司機 21 座，最多 20 位乘客）",
    fleetPath: "/fleet/toyota-midibus",
    taipeiDayTwd: null,
    hours: null,
    includes: "駕駛薪資、過橋過路費、油資、法定乘客意外險",
    excludes: "門票、接駁車費、停車費與過夜停車費（實報實銷）、訂車方食宿、稅金",
    overtime: "台北、新北用車超時每小時 800 元",
    night: "22:00 至 06:30 依行程加 500 至 2,000 元",
    airportSign: "免費舉牌接機；送機超過約定出發時間，每 30 分鐘加 500 元",
    driverLodging: "司機餐點由客人負責，或每餐補貼 200 元；遠程需安排司機住宿",
    luggage: "行李依人數與尺寸事先確認",
    childSeat: "兒童安全座椅請自備",
  },
];

export function vehiclePrice(id: VehiclePrice["id"]) {
  const row = vehiclePrices.find((item) => item.id === id);
  if (!row) throw new Error(`unknown vehicle ${id}`);
  return row;
}

export function formatTwd(amount: number) {
  return `${amount.toLocaleString("en-US")} 元`;
}

/** 價目表「台北一日遊」欄的文字。沒有數字時固定寫 LINE 詢價，不填 0。 */
export function dayPriceText(row: VehiclePrice) {
  return row.taipeiDayTwd === null ? LINE_QUOTE_TEXT : `${formatTwd(row.taipeiDayTwd)}／用車 ${row.hours} 小時`;
}

export type FaqItem = { question: string; answer: string };

export type ServiceAnswer = {
  slug: string;
  /** 40–60 字直接回答，放在 H1 下方。 */
  answer: string;
  /** 本頁要列出的車型價格。 */
  vehicles: VehiclePrice["id"][];
  faq: FaqItem[];
};

const coach = vehiclePrice("coach-42");
const van = vehiclePrice("van-9");
const midi = vehiclePrice("midibus");

const bookingFaq: FaqItem = {
  question: "怎麼預訂？需要先付訂金嗎？",
  answer: "提供日期、人數、上車地點與目的地即可詢價；42 人座大巴與九人座訂車需收訂金，用途是確保車輛預留、避免臨時取消或更改行程。",
};
const midiPriceFaq: FaqItem = {
  question: "中巴包車多少錢？",
  answer: `中巴車資依日期、路線與用車時間計算，${LINE_QUOTE_TEXT}。`,
};

export const serviceAnswers: ServiceAnswer[] = [
  {
    slug: "coach-charter",
    answer: "遊覽車包車派 42 人座大巴，台北一日遊 14,000 元（用車 10 小時），含駕駛薪資、油費、過路費與停車費；不含門票與餐費。",
    vehicles: ["coach-42"],
    faq: [
      { question: "42 人座遊覽車包車一天多少錢？", answer: `台北一日遊 ${formatTwd(14000)}，用車 10 小時。` },
      { question: "包車費用包含哪些？不包含哪些？", answer: `包含${coach.includes}；不包含${coach.excludes}。` },
      { question: "超時費用怎麼算？", answer: `${coach.overtime}。` },
      { question: "夜間用車有加價嗎？", answer: `${coach.night}，金額依行程報價。` },
      { question: "多日遊司機住宿怎麼安排？", answer: `${coach.driverLodging}。` },
      { question: "行李放得下嗎？", answer: `${coach.luggage}。` },
      bookingFaq,
    ],
  },
  {
    slug: "midibus-charter",
    answer: "中巴包車派 TOYOTA 中巴，含司機 21 座、最多 20 位乘客，含駕駛薪資、油資與過路費；車資請洽 LINE 詢價，由專人報價。",
    vehicles: ["midibus"],
    faq: [
      midiPriceFaq,
      { question: "中巴可以坐幾個人？", answer: "含司機 21 座，最多 20 位乘客，建議不要坐滿，讓同行旅客坐得更舒適。" },
      { question: "包車費用包含哪些？不包含哪些？", answer: `包含${midi.includes}；不包含${midi.excludes}。` },
      { question: "超時與夜間用車怎麼算？", answer: `${midi.overtime}；${midi.night}。` },
      { question: "機場接送會舉牌嗎？", answer: `${midi.airportSign}。` },
      { question: "可以提供兒童安全座椅嗎？", answer: `${midi.childSeat}。` },
    ],
  },
  {
    slug: "van-charter",
    answer: "九人座包車派賓士小車，台北一日遊 7,000 元（用車 10 小時），含油費、過路費與停車費；超時 30 分鐘加 300 元。",
    vehicles: ["van-9"],
    faq: [
      { question: "九人座包車一天多少錢？", answer: `台北一日遊 ${formatTwd(7000)}，用車 10 小時；台北到九份同價。` },
      { question: "包車費用包含哪些？", answer: `包含${van.includes}；不包含${van.excludes}。` },
      { question: "超時費用怎麼算？", answer: `${van.overtime}。` },
      { question: "機場接機會舉牌嗎？", answer: `${van.airportSign}。` },
      { question: "行李可以放幾個？", answer: `${van.luggage}，坐滿時不保證仍可放入。` },
      { question: "多日遊司機住宿怎麼安排？", answer: `${van.driverLodging}。` },
      bookingFaq,
    ],
  },
  {
    slug: "airport-transfer",
    answer: "機場接送可派九人座、中巴或 42 人座大巴；舉牌接機九人座加 100 元、大巴加 200 元、中巴免費，車資請洽 LINE 詢價。",
    vehicles: ["van-9", "midibus", "coach-42"],
    faq: [
      { question: "機場接送多少錢？", answer: `依航班時間、人數、行李量與上下車地點計算，${LINE_QUOTE_TEXT}。` },
      { question: "接機會舉牌嗎？要加錢嗎？", answer: `九人座：${van.airportSign}。42 人座大巴：${coach.airportSign}。中巴：${midi.airportSign}。` },
      { question: "行李很多怎麼選車？", answer: `九人座${van.luggage}；42 人座大巴${coach.luggage}。` },
      { question: "班機改時間怎麼辦？", answer: "請盡快通知客服調整派車；中巴班機更改可能另派車或取消，提前降落會盡量配合。" },
      bookingFaq,
    ],
  },
  {
    slug: "school-trip",
    answer: "校外教學常用 42 人座大巴，台北一日遊 14,000 元（用車 10 小時），含駕駛薪資、油費、過路費與停車費，不含門票與餐費。",
    vehicles: ["coach-42", "midibus"],
    faq: [
      { question: "校外教學包一台遊覽車多少錢？", answer: `42 人座大巴台北一日遊 ${formatTwd(14000)}，用車 10 小時；實際依年級人數、景點與集合地點報價。` },
      { question: "包車費用包含哪些？", answer: `包含${coach.includes}；不包含${coach.excludes}。` },
      { question: "超時費用怎麼算？", answer: `${coach.overtime}。` },
      { question: "人數不到一台大巴怎麼辦？", answer: `可改派 TOYOTA 中巴（最多 20 位乘客），中巴車資${LINE_QUOTE_TEXT}。` },
      { question: "學校需要準備哪些資料？", answer: "建議提供日期、人數、上車地點、目的地、停靠點與特殊需求；行前會確認緊急聯絡與保險資料。" },
      bookingFaq,
    ],
  },
  {
    slug: "business-charter",
    answer: "企業旅遊依人數派九人座、中巴或大巴；台北一日遊九人座 7,000 元、42 人座大巴 14,000 元（用車 10 小時）。",
    vehicles: ["van-9", "midibus", "coach-42"],
    faq: [
      { question: "公司員工旅遊包車多少錢？", answer: `台北一日遊（用車 10 小時）：九人座 ${formatTwd(7000)}、42 人座大巴 ${formatTwd(14000)}；中巴${LINE_QUOTE_TEXT}。` },
      { question: "要選哪一種車？", answer: "四人以上的小團體選九人座；超過一台小車、又還不用大巴，選中巴（最多 20 位乘客）；大型團體用 42 人座大巴。" },
      { question: "包車費用包含哪些？", answer: `42 人座大巴含${coach.includes}；九人座含${van.includes}；中巴含${midi.includes}。` },
      { question: "超時費用怎麼算？", answer: `42 人座大巴${coach.overtime}；九人座${van.overtime}；中巴${midi.overtime}。` },
      bookingFaq,
    ],
  },
  {
    slug: "custom-tour",
    answer: "客製化行程依季節、預算與旅客組成安排景點；台北一日遊九人座 7,000 元、42 人座大巴 14,000 元（用車 10 小時）。",
    vehicles: ["van-9", "coach-42", "midibus"],
    faq: [
      { question: "包車一日遊多少錢？", answer: `台北一日遊（用車 10 小時）：九人座 ${formatTwd(7000)}、42 人座大巴 ${formatTwd(14000)}；中巴${LINE_QUOTE_TEXT}。` },
      { question: "行程可以自己排嗎？", answer: "可以。行程由您制定，行車順序交給我們，可依景點順路性、用餐與停留時間調整。" },
      { question: "包車費用包含哪些？", answer: `42 人座大巴含${coach.includes}；九人座含${van.includes}；不含門票與餐費。` },
      { question: "多日遊司機住宿怎麼安排？", answer: `九人座與大巴${coach.driverLodging}。` },
      bookingFaq,
    ],
  },
];

export const priceAnswer =
  "包車台北一日遊（用車 10 小時）：42 人座大巴 14,000 元、九人座 7,000 元，含油費與過路費；中巴請洽 LINE 詢價。";

export const priceFaq: FaqItem[] = [
  { question: "遊覽車包車一天多少錢？", answer: `42 人座大巴台北一日遊 ${formatTwd(14000)}，用車 10 小時。` },
  { question: "九人座包車一天多少錢？", answer: `台北一日遊 ${formatTwd(7000)}，用車 10 小時。` },
  midiPriceFaq,
  { question: "超時費用怎麼算？", answer: `42 人座大巴${coach.overtime}；九人座${van.overtime}；中巴${midi.overtime}。` },
  { question: "夜間用車有加價嗎？", answer: `42 人座大巴與九人座${coach.night}，金額依行程報價；中巴${midi.night}。` },
  { question: "包車價格包含哪些？", answer: `42 人座大巴含${coach.includes}；九人座含${van.includes}；中巴含${midi.includes}。門票與餐費不含。` },
  bookingFaq,
];

export function findServiceAnswer(slug: string) {
  return serviceAnswers.find((item) => item.slug === slug) || null;
}

function offersFor(ids: VehiclePrice["id"][], pagePath: string) {
  return ids
    .map(vehiclePrice)
    .filter((row) => row.taipeiDayTwd !== null)
    .map((row) => ({
      "@type": "Offer",
      name: `${row.vehicle} 台北一日遊（用車 ${row.hours} 小時）`,
      price: row.taipeiDayTwd,
      priceCurrency: "TWD",
      url: absoluteUrl(pagePath),
      availability: "https://schema.org/InStock",
    }));
}

/** WebPage（含 dateModified）→ mainEntity Service（含 Offer）＋ FAQPage。 */
export function serviceAnswerJsonLd(args: {
  name: string;
  description: string;
  path: string;
  vehicles: VehiclePrice["id"][];
  faq: FaqItem[];
}) {
  const offers = offersFor(args.vehicles, args.path);
  return [
    {
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: args.name,
      url: absoluteUrl(args.path),
      dateModified: SERVICE_PAGES_UPDATED,
      inLanguage: "zh-Hant",
      mainEntity: {
        "@type": "Service",
        name: args.name,
        description: args.description,
        serviceType: args.name,
        areaServed: { "@type": "Country", name: "Taiwan" },
        provider: organizationJsonLd(),
        url: absoluteUrl(args.path),
        ...(offers.length ? { offers } : {}),
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      url: absoluteUrl(args.path),
      mainEntity: args.faq.map((item) => ({
        "@type": "Question",
        name: item.question,
        acceptedAnswer: { "@type": "Answer", text: item.answer },
      })),
    },
  ];
}
