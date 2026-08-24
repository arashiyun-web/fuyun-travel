// GEO content — charter bus page, all 5 locales.
// Source: 適合校外教學、企業旅遊、進香團與大型團體，安排安全舒適的台灣包車動線。
//         浮雲輕鬆遊協助團體確認人數、上車地點、停靠點與行李需求，安排合適車型與司機服務，
//         降低團體移動時的溝通成本。

import type { GeoSectionContent } from "./home";

const zhHant: GeoSectionContent = {
  lang: "zh-Hant",
  h1: "遊覽車包車｜台灣團體包車、校外教學、企業旅遊",
  lead: "浮雲輕鬆遊提供台灣遊覽車包車，適合校外教學、企業旅遊、進香團與大型團體，依人數、上車地點、停靠點與行李量安排車型與司機服務。",
  sections: [
    {
      heading: "怎麼安排",
      steps: [
        "確認人數與上車地點。",
        "確認停靠點與行李需求。",
        "安排合適車型（九人座／中巴／遊覽車）與司機服務。",
        "依行程調整路線與停留時間。",
      ],
    },
    {
      heading: "適合哪些場景",
      bullets: [
        "校外教學、畢旅、社團活動。",
        "企業員工旅遊、會議接駁、客戶參訪。",
        "進香團、大型團體的長天數行程。",
        "需要多點停靠的客製化行程。",
      ],
    },
    {
      heading: "為什麼選擇浮雲輕鬆遊",
      bullets: [
        "合法旅行社（甲種旅行社 882200）與遊覽車公司。",
        "自有車隊 15 輛、在職專業駕駛約 20 位。",
        "車輛定期保養與檢驗，安全、準時、舒適為最高原則。",
        "履約保證保險：旺旺友聯產物保險 新臺幣 1,500 萬元。",
      ],
    },
  ],
  faq: [
    {
      q: "可以安排校外教學與企業旅遊嗎？",
      a: "可以。校外教學、企業旅遊、進香團與大型團體皆為主要服務範圍。",
    },
    {
      q: "人數很多時會分車嗎？",
      a: "可依人數安排多輛車，配合集合時間、分車名單與單一聯絡窗口。",
    },
    {
      q: "可以客製化路線與停靠點嗎？",
      a: "可以。可依需求安排專屬路線與停留時間。",
    },
    {
      q: "安全與保險怎麼保障？",
      a: "車輛定期保養與檢驗，在職駕駛皆具職業駕照，公司投保履約保證保險新臺幣 1,500 萬元。",
    },
  ],
};

const en: GeoSectionContent = {
  lang: "en",
  h1: "Taiwan Charter Bus | Private Coach for School Trips, Corporate & Large Groups",
  lead: "Fuyun Travel provides island-wide charter coaches for school field trips, corporate travel, pilgrimage groups and large groups — vehicles matched to headcount, on-boarding points, stops and luggage.",
  sections: [
    {
      heading: "How it works",
      steps: [
        "Confirm headcount and on-boarding points.",
        "Confirm stops and luggage needs.",
        "We match the vehicle (9-seater / minibus / coach) with driver service.",
        "Route and stop times are adjusted to the itinerary.",
      ],
    },
    {
      heading: "Good for",
      bullets: [
        "School field trips, graduation tours and club activities.",
        "Corporate staff travel, meeting shuttles and client visits.",
        "Pilgrimage groups and large, multi-day groups.",
        "Customised itineraries with multiple stops.",
      ],
    },
    {
      heading: "Why book with Fuyun Travel",
      bullets: [
        "Licensed travel agency (甲種旅行社 882200) and coach operator.",
        "Own fleet of 15 coaches, about 20 professional drivers.",
        "Vehicles maintained and inspected regularly; safety, punctuality and comfort first.",
        "TWD 15,000,000 performance bond (Wangwang Youlian P&C).",
      ],
    },
  ],
  faq: [
    {
      q: "Do you handle school trips and corporate travel?",
      a: "Yes — school field trips, corporate travel, pilgrimage groups and large groups are core services.",
    },
    {
      q: "Do you split large groups across multiple coaches?",
      a: "Yes — multiple coaches can be matched to headcount, with set meeting times, group rosters and one contact window.",
    },
    {
      q: "Can the route and stops be customised?",
      a: "Yes — dedicated routes and stop times are arranged to your needs.",
    },
    {
      q: "How is safety and insurance covered?",
      a: "Vehicles are maintained and inspected on schedule, drivers are commercial-licensed, and a TWD 15,000,000 bond is in place.",
    },
  ],
};

const ja: GeoSectionContent = {
  lang: "ja",
  h1: "台湾 貸切バス｜修学旅行・企業研修・大集団のための貸切",
  lead: "浮雲輕鬆遊（Fuyun Travel）は、修学旅行・企業研修・進香団・大集団を対象に台湾全土の貸切バスを提供します。人数・乗車場所・経由地・お荷物の量に合わせて車両とドライバーを手配します。",
  sections: [
    {
      heading: "ご利用の流れ",
      steps: [
        "人数と乗車場所を確認。",
        "経由地と荷物量を確認。",
        "9人乗り・中バス・大型バスのいずれかとドライバーを手配。",
        "旅程に合わせて路線と停留時刻を調整。",
      ],
    },
    {
      heading: "こんな場合に",
      bullets: [
        "修学旅行、卒業旅行、サークル活動。",
        "企業研修、会議送迎、お客様のご案内。",
        "進香団・大集団の長期間の旅程。",
        "複数箇所の停留を伴うカスタマイズ旅程。",
      ],
    },
    {
      heading: "選ばれる理由",
      bullets: [
        "合法旅行業（甲種旅行社 882200）と観光バス運行会社。",
        "自社観光バス15台、ドライバー約20名。",
        "車輌は定期点検・整備、安全・定時・快適を最優先。",
        "保証保険：新台币1,500万（旺旺友聯産物保険）。",
      ],
    },
  ],
  faq: [
    {
      q: "修学旅行や企業研修に対応していますか？",
      a: "はい。修学旅行、企業研修、進香団、大集団が主要な対応範囲です。",
    },
    {
      q: "大人数で複数のバスに分けることは可能ですか？",
      a: "はい。人数に合わせて複数台を手配し、集合時刻・分車名簿・窓口一元化をします。",
    },
    {
      q: "路線と経由地のカスタマイズは可能ですか？",
      a: "はい。ご要望に合わせて専用路線と停留時刻を調整します。",
    },
    {
      q: "安全と保険はどのように確保されていますか？",
      a: "車輌は定期点検・整備、ドライバーは全員職業免許、保証保険 新台币1,500万（旺旺友聯産物保険）を確保しています。",
    },
  ],
};

const zhcn: GeoSectionContent = {
  lang: "zh-Hans",
  h1: "游览车包车｜团体包车、研学旅行、企业旅游",
  lead: "浮云轻松游提供台湾游览车包车，适合研学旅行、企业旅游、进香团与大型团体，依人数、上车点、停靠点与行李量安排车型与司机服务。",
  sections: [
    {
      heading: "怎么安排",
      steps: [
        "确认人数与上车地点。",
        "确认停靠点与行李需求。",
        "安排合适车型（九人座／中巴／游览车）与司机服务。",
        "依行程调整路线与停留时间。",
      ],
    },
    {
      heading: "适合哪些场景",
      bullets: [
        "研学旅行、毕业旅行、社团活动。",
        "企业员工旅游、会议接驳、客户参观。",
        "进香团、大型团体的多日行程。",
        "需要多点停靠的定制化行程。",
      ],
    },
    {
      heading: "为什么选择浮云轻松游",
      bullets: [
        "合法旅行社（甲种旅行社 882200）与游览车公司。",
        "自有车队 15 辆、在职专业驾驶约 20 位。",
        "车辆定期保养与检验，安全、准时、舒适为最高原则。",
        "履约保证保险：旺旺友联产险 新台币 1,500 万元。",
      ],
    },
  ],
  faq: [
    {
      q: "可以安排研学旅行与企业旅游吗？",
      a: "可以。研学旅行、企业旅游、进香团与大型团体皆是主要服务范围。",
    },
    {
      q: "人数很多时会分车吗？",
      a: "可依人数安排多辆车，配合集合时间、分组名单与单一联络窗口。",
    },
    {
      q: "可以定制化路线与停靠点吗？",
      a: "可以。可依需求安排专属路线与停留时间。",
    },
    {
      q: "安全与保险怎么保障？",
      a: "车辆定期保养与检验，在职驾驶均持职业驾照，公司投保履约保证保险 新台币 1,500 万元。",
    },
  ],
};

const ko: GeoSectionContent = {
  lang: "ko",
  h1: "대만 차터버스｜학교 현장학습·기업 연수·대규모 단체용 차터",
  lead: "浮雲輕鬆遊（Fuyun Travel）는 대만 전역 차터버스를 제공합니다. 학교 현장학습, 기업 연수, 진향단, 대규모 단체를 대상으로 인원·승차장소·경유지·짐 양에 따라 차량과 운전자를 배정합니다.",
  sections: [
    {
      heading: "진행 절차",
      steps: [
        "인원과 승차장소 확인.",
        "경유지와 짐 양 확인.",
        "9인승·중형버스·대형버스와 운전자 배정.",
        "일정에 따라 노선과 대기 시간 조정.",
      ],
    },
    {
      heading: "이런 경우에 적합",
      bullets: [
        "학교 현장학습, 졸업 여행, 동아리 활동.",
        "기업 연수, 회의 송영, 고객 응대.",
        "진향단·대규모 단체의 장기 일정.",
        "여러 곳 경유가 필요한 맞춤형 일정.",
      ],
    },
    {
      heading: "선택하는 이유",
      bullets: [
        "합법 여행사(갑종 여행사 882200)와 버스 운영권 보유.",
        "자체 차터버스 15대, 숙련 운전자 약 20명.",
        "차량 정기 검사·정비, 안전·정시·편의를 최우선.",
        "보증보험: TWD 1,500만 (왕왕우롄산물보험).",
      ],
    },
  ],
  faq: [
    {
      q: "학교 현장학습과 기업 연수를 지원하나요?",
      a: "네. 학교 현장학습, 기업 연수, 진향단, 대규모 단체가 핵심 지원 범위입니다.",
    },
    {
      q: "인원이 많으면 여러 대를 나누나?",
      a: "네. 인원 기준으로 여러 대를 배치하고,집결 시간·분류 명단·연락창구 일원화로 운영합니다.",
    },
    {
      q: "노선과 경유지를 원하는 대로 지정할 수 있나요?",
      a: "네. 요청에 맞춘 전용 노선과 대기 시간을 조정합니다.",
    },
    {
      q: "안전과 보험은 어떻게 확보되나요?",
      a: "차량은 정기 검사·정비, 운전자는 전문 면허 보유, 보증보험 TWD 1,500만(왕왕우롄산물보험) 확보.",
    },
  ],
};

export const CHARTER = { zhHant, en, ja, zhcn, ko };
