// GEO content — about page, all 5 locales. (Korean about intentionally NOT translated;
// bidirectional hreflang rule excludes it.)

import type { GeoSectionContent } from "./home";

const zhHant: GeoSectionContent = {
  lang: "zh-Hant",
  h1: "關於浮雲輕鬆遊｜雲驛旅行社 ＆ 雲陞通運",
  lead: "浮雲輕鬆遊是合法旅行社「雲驛旅行社」的旅遊品牌，結合「雲陞通運」自有車隊，自 2014 年起提供全台包車、機場接送、校外教學、企業差旅與國際旅客接待。",
  sections: [
    {
      heading: "我們的身份",
      bullets: [
        "浮雲輕鬆遊（Fuyun Travel）是雲驛旅行社有限公司的旅遊品牌。",
        "由雲陞通運有限公司自有遊覽車隊提供運營支持。",
        "2014 年成立以來，持續服務台灣各地團體與個人。",
      ],
    },
    {
      heading: "理念",
      body: [
        "我們相信，旅行不只是抵達目的地，更是一段值得細細體驗的過程。",
        "秉持「如浮雲般自在」的理念，透過專業規劃、安全車隊與貼心服務，讓每位旅客輕鬆享受旅程中的美好時光。",
      ],
    },
    {
      heading: "車隊與運營",
      bullets: [
        "15 輛遊覽車 ＋ 多元接駁資源，可依人數與行程彈性安排。",
        "車內配備舒適座椅、空調系統及寬敞行李空間。",
        "在職專業駕駛約 20 位，皆持職業駕照、具豐富載客經驗。",
        "所有車輛定期保養與檢驗。",
      ],
    },
    {
      heading: "服務範圍",
      bullets: [
        "涵蓋全台灣，熱門路線：北海岸、野柳、九份、十分、宜蘭、日月潭、阿里山及花東。",
        "依旅客需求安排客製化包車（專屬路線與停留時間）。",
        "針對海外旅客，提供外語導覽與客製化行程規劃。",
      ],
    },
  ],
  faq: [
    {
      q: "浮雲輕鬆遊是哪間公司的品牌？",
      a: "浮雲輕鬆遊是雲驛旅行社有限公司旗下的旅遊品牌，由雲陞通運有限公司自有車隊提供運營支持。",
    },
    {
      q: "車隊多大、駕駛幾位？",
      a: "自有車隊 15 輛、在職專業駕駛約 20 位，皆具職業駕照與載客經驗，車輛定期保養與檢驗。",
    },
    {
      q: "品質與保障怎麼看？",
      a: "甲種旅行社 882200、品保會員北 2760、統一編號 60675708、履約保證保險旺旺友聯產物保險 新臺幣 1,500 萬元。",
    },
  ],
};

const en: GeoSectionContent = {
  lang: "en",
  h1: "About Fuyun Travel (浮雲輕鬆遊) | Yunyi Travel Agency & Yunsheng Express",
  lead: "Fuyun Travel, a brand of licensed agency Yunyi Travel Agency, combines the own-coach fleet of Yunsheng Express to deliver island-wide charter, airport transfer, school trips, corporate travel and international-visitor reception — since 2014.",
  sections: [
    {
      heading: "Who we are",
      bullets: [
        "Fuyun Travel (浮雲輕鬆遊) is the travel brand of Yunyi Travel Agency (雲驛旅行社有限公司).",
        "Backed by the own-coach fleet of Yunsheng Express (雲陞通運有限公司).",
        "Serving groups and individuals across Taiwan since 2014.",
      ],
    },
    {
      heading: "Our philosophy",
      body: [
        "Travel is not just reaching a destination — it is a process worth experiencing in depth.",
        "Guided by “as free as a drifting cloud”, we pair professional planning, a safe fleet and attentive service so every traveller enjoys the ride.",
      ],
    },
    {
      heading: "Fleet & operations",
      bullets: [
        "15 coaches + flexible shuttle resources, matched to headcount and itinerary.",
        "Comfortable seats, air-conditioning and spacious luggage space onboard.",
        "About 20 professional drivers, all commercial-licensed with passenger-carrying experience.",
        "All vehicles maintained and inspected regularly.",
      ],
    },
    {
      heading: "Coverage",
      bullets: [
        "All of Taiwan — popular routes on the Northern Coast, Yehliu, Jiufen, Shifen, Yilan, Sun Moon Lake, Ali Mountain and Hualien-Taitung.",
        "Customised charter (dedicated routes and flexible stops).",
        "For international visitors: foreign-language guidance and customised itineraries.",
      ],
    },
  ],
  faq: [
    {
      q: "Who owns Fuyun Travel?",
      a: "Fuyun Travel is the brand of Yunyi Travel Agency, operated with the own-coach fleet of Yunsheng Express.",
    },
    {
      q: "How big is the fleet and the driver team?",
      a: "15 coaches and about 20 commercial-licensed drivers; vehicles are maintained and inspected regularly.",
    },
    {
      q: "What are the trust & quality credentials?",
      a: "甲種旅行社 882200, QA member 北2760, UIN 60675708, and a TWD 15,000,000 performance bond (Wangwang Youlian P&C).",
    },
  ],
};

const ja: GeoSectionContent = {
  lang: "ja",
  h1: "会社概要｜浮雲輕鬆遊（Fuyun Travel）／雲驛旅行社／雲陞通運",
  lead: "浮雲輕鬆遊は合法旅行業・雲驛旅行社のブランドで、自社車隊・雲陞通運と連携し、2014年以降、台湾全土の貸切バス・空港送迎・修学旅行・企業研修・外国人観光客のご案内に継続的に対応しています。",
  sections: [
    {
      heading: "私たちのこと",
      bullets: [
        "浮雲輕鬆遊（フユン軽鬆遊 / Fuyun Travel）は雲驛旅行社有限公司の旅行ブランド。",
        "雲陞通運有限公司的の自社観光バス隊によって運営。",
        "2014年以降、台湾全土の団体・個人に対応。",
      ],
    },
    {
      heading: "考え方",
      body: [
        "旅行は目的地への到着ではなく、そのプロセスそのもの。",
        "「浮雲のように自在に」（如浮雲般自在）という想いのもと、専門的なプランニング・安全な車隊・心遣いのあるサービスで、旅の時間を大切にしています。",
      ],
    },
    {
      heading: "車隊と運営",
      bullets: [
        "観光バス15台 ＋ Flexible な送迎リソース（人数・旅程に応じて）。",
        "座席・エアコン・広い荷物スペース。",
        "ドライバー約20名、全員が職業免許・豊富な乗客対応経験。",
        "車輌は定期点検・整備。",
      ],
    },
    {
      heading: "対応エリア",
      bullets: [
        "台湾全土。人気路線：北海岸・野柳・九份・十分・宜蘭・日月潭・阿里山・花蓮・台東。",
        "ご要望に合わせた専用路線・停留時刻のカスタマイズ。",
        "外国人参客向け：外語ガイドとカスタム旅程。",
      ],
    },
  ],
  faq: [
    {
      q: "浮雲輕鬆遊はどの会社のブランドですか？",
      a: "雲驛旅行社有限公司の旅行ブランドで、雲陞通運有限公司の自社車隊が運営を支えています。",
    },
    {
      q: "車隊とドライバーは何名ですか？",
      a: "観光バス15台、ドライバー約20名。全員が職業免許と乗客対応経験を保持し、車輌は定期点検・整備されています。",
    },
    {
      q: "品質・保証はどのような内容ですか？",
      a: "甲種旅行社 882200、品保 北 2760、統一番号 60675708、保証保険 新台币1,500万（旺旺友聯産物保険）。",
    },
  ],
};

const zhcn: GeoSectionContent = {
  lang: "zh-Hans",
  h1: "关于浮云轻松游｜云驿旅行社 ＆ 云昇通运",
  lead: "浮云轻松游是合法旅行社「云驿旅行社」的旅行品牌，结合「云昇通运」自有车队，自 2014 年起提供全台包车、机场接送、研学旅行（校外教学）、企业差旅与外籍旅客接待。",
  sections: [
    {
      heading: "我们的身份",
      bullets: [
        "浮云轻松游（Fuyun Travel）是云驿旅行社有限公司的旅行品牌。",
        "由云昇通运有限公司自有游览车队提供运营支持。",
        "自 2014 年起，在台湾各地持续服务团体与个人。",
      ],
    },
    {
      heading: "理念",
      body: [
        "我们相信，旅行不只是抵达目的地，更是一段值得细细体验的过程。",
        "秉持「如浮云般自在」的理念，通过专业规划、安全车队与贴心服务，让每位旅客轻松享受旅程中的美好时光。",
      ],
    },
    {
      heading: "车队与运营",
      bullets: [
        "15 辆游览车 ＋ 多元接驳资源，可依人数与行程弹性安排。",
        "车内配备舒适座椅、空调系统及宽敞行李空间。",
        "在职专业驾驶约 20 位，均持职业驾照、具丰富载客经验。",
        "所有车辆定期保养与检验。",
      ],
    },
    {
      heading: "服务范围",
      bullets: [
        "涵盖全台湾，热门路线：北海岸、野柳、九份、十分、宜兰、日月潭、阿里山及花东。",
        "依需求安排定制化包车（专属路线与停留时间）。",
        "针对外籍旅客，提供外语导览与定制化行程规划。",
      ],
    },
  ],
  faq: [
    {
      q: "浮云轻松游是哪间公司的品牌？",
      a: "浮云轻松游是云驿旅行社有限公司旗下的旅行品牌，由云昇通运有限公司自有车队提供运营支持。",
    },
    {
      q: "车队多大、驾驶几位？",
      a: "自有车队 15 辆、在职专业驾驶约 20 位，均持职业驾照与载客经验，车辆定期保养与检验。",
    },
    {
      q: "品质与保障怎么看？",
      a: "甲种旅行社 882200、品保会员北 2760、统一社会信用代码 60675708、履约保证保险 旺旺友联产险 新台币 1,500 万元。",
    },
  ],
};

export const ABOUT = { zhHant, en, ja, zhcn }; // ko intentionally omitted (bidirectional rule)
