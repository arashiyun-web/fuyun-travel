// GEO content — home page, all 5 locales. Facts faithful to source; no invented figures.

export interface GeoSectionContent {
  lang: string;
  h1: string;
  lead: string; // answer-first (BLUF), 40–80 chars
  sections: { heading: string; bullets?: string[]; body?: string[]; steps?: string[] }[];
  faq: { q: string; a: string }[];
}

const zhHant: GeoSectionContent = {
  lang: "zh-Hant",
  h1: "浮雲輕鬆遊｜台灣包車旅遊與遊覽車服務",
  lead: "浮雲輕鬆遊是合法旅行社「雲驛旅行社」旗下品牌，結合自有車隊「雲陞通運」，提供全台包車、機場接送、校外教學與企業旅遊，30 分鐘內回覆。",
  sections: [
    {
      heading: "我們提供什麼",
      bullets: [
        "遊覽車包車：校外教學、企業旅遊、進香團、大型團體。",
        "機場接送：桃園、松山航班接送、多點上下車、團體行李安排。",
        "旅遊攻略：最新內容、熱門行程與包車建議。",
        "立即詢價：日期、人數、路線快速評估。",
        "這裡真好玩：真實走過的行程分享與照片。",
      ],
    },
    {
      heading: "適合誰",
      bullets: [
        "家族旅遊、學校校外教學、企業團體。",
        "進香團、大型團體。",
        "不便轉乘大眾運輸的同行者與海外旅客。",
      ],
    },
    {
      heading: "為什麼選擇浮雲輕鬆遊",
      bullets: [
        "30 分鐘內回覆。",
        "合法旅行社與遊覽車公司（自有車隊 15 輛）。",
        "在職專業駕駛約 20 位，皆具職業駕照與載客經驗。",
        "履約保證保險：旺旺友聯產物保險 新臺幣 1,500 萬元。",
        "熱門路線：北海岸、野柳、九份、十分、宜蘭、日月潭、阿里山、花東。",
      ],
    },
  ],
  faq: [
    {
      q: "浮雲輕鬆遊是合法公司嗎？",
      a: "是。雲驛旅行社（甲種旅行社 882200）為合法旅行社，雲陞通運為自有車隊，統一編號 60675708，品保會員北 2760。",
    },
    {
      q: "可以安排機場接送與多點上下車嗎？",
      a: "可以。支援桃園、松山與各大機場接送，團體行李與多點上下車皆可安排。",
    },
    {
      q: "車隊有多大？安全嗎？",
      a: "自有車隊 15 輛、在職駕駛約 20 位，車輛定期保養與檢驗，以安全、準時、舒適為最高原則。",
    },
  ],
};

const en: GeoSectionContent = {
  lang: "en",
  h1: "Fuyun Travel | Taiwan Charter Bus, Airport Transfer & Coach Tours",
  lead: "Fuyun Travel (浮雲輕鬆遊), a brand of licensed agency Yunyi Travel Agency with fleet Yunsheng Express, offers island-wide charter, airport transfer, school trips and corporate travel — reply within 30 minutes.",
  sections: [
    {
      heading: "What we offer",
      bullets: [
        "Charter bus (Private Coach Taiwan): school field trips, corporate travel, pilgrimage groups, large groups.",
        "Airport transfer: Taoyuan & Songshan, flight-based pickup, multi-stop boarding, group luggage.",
        "Travel guides: latest itineraries, popular routes and charter-bus advice.",
        "Fast quote: date, headcount and route for a quick estimate.",
        "Real trips: itineraries and photos we have actually driven.",
      ],
    },
    {
      heading: "Who it's for",
      bullets: [
        "Families, schools and companies.",
        "Pilgrimage groups and large groups.",
        "Travellers who prefer a private vehicle over public transport, and international visitors.",
      ],
    },
    {
      heading: "Why book with Fuyun Travel",
      bullets: [
        "Reply within 30 minutes.",
        "Legal travel agency + licensed coach operator (own fleet of 15 coaches).",
        "About 20 professional, commercial-licensed drivers with passenger-carrying experience.",
        "Performance bond insurance: Wangwang Youlian P&C, TWD 15,000,000.",
        "Popular routes: Northern Coast, Yehliu, Jiufen, Shifen, Yilan, Sun Moon Lake, Ali Mountain, Hualien-Taitung.",
      ],
    },
  ],
  faq: [
    {
      q: "Is Fuyun Travel a legal company?",
      a: "Yes. Yunyi Travel Agency (甲種旅行社 882200) is a licensed agency and Yunsheng Express the fleet; UIN 60675708, QA member 北2760.",
    },
    {
      q: "Can you do airport transfers and multi-stop pickup?",
      a: "Yes — Taoyuan, Songshan and major airports, with group luggage and multi-stop boarding/drop-off.",
    },
    {
      q: "How big is the fleet and is it safe?",
      a: "15 coaches, about 20 licensed drivers, vehicles regularly maintained and inspected; safety, punctuality and comfort first.",
    },
  ],
};

const ja: GeoSectionContent = {
  lang: "ja",
  h1: "浮雲輕鬆遊｜台湾 貸切バス・空港送迎・観光バス",
  lead: "浮雲輕鬆遊（フユン軽鬆遊 / Fuyun Travel）は合法旅行業・雲驛旅行社のブランドで、自社バス隊・雲陞通運による台湾全土の貸切バス、空港送迎、修学旅行、企業研修に対応。30分以内にお返事いたします。",
  sections: [
    {
      heading: "サービス内容",
      bullets: [
        "貸切バス：修学旅行、企業研修、進香団、大人数グループ。",
        "空港送迎：桃園・松山、フライト対応、複数箇所の乗降、団体のお荷物。",
        "旅行ガイド：最新のツアー情報、人気路線、貸切バスの選び方。",
        "素早い見積：日付・人数・路線で迅速に確認。",
        "実際の運行記録：実際に走ったツアーの写真と記録。",
      ],
    },
    {
      heading: "こんな方へ",
      bullets: [
        "ご家族、学校、企業。",
        "進香団・大人数グループ。",
        "公共交通機関の乗り継ぎを避けたい方、外国人観光客。",
      ],
    },
    {
      heading: "選ばれる理由",
      bullets: [
        "30分以内の返信。",
        "合法旅行業 + 合法バス運行会社（自社観光バス15台）。",
        "職業免許の経験豊富なドライバー約20名。",
        "保証保険：旺旺友聯産物保険 新台币1,500万。",
        "人気路線：北海岸、野柳、九份、十分、宜蘭、日月潭、阿里山、花蓮・台東。",
      ],
    },
  ],
  faq: [
    {
      q: "浮雲輕鬆遊は合法会社ですか？",
      a: "はい。雲驛旅行社（甲種旅行社 882200）が合法旅行業、雲陞通運が自社車隊、統一番号 60675708、品保 北 2760 です。",
    },
    {
      q: "空港送迎と複数箇所の乗降は可能ですか？",
      a: "可能です。桃園・松山と主要空港、団体のお荷物と複数箇所の乗降に対応します。",
    },
    {
      q: "車隊はどのくらいですか？安全ですか？",
      a: "自社観光バス15台、ドライバー約20名。車輌は定期点検・整備、安全・定時・快適を最優先しています。",
    },
  ],
};

const zhcn: GeoSectionContent = {
  lang: "zh-Hans",
  h1: "浮云轻松游｜台湾包车旅游与游览车服务",
  lead: "浮云轻松游是合法旅行社「云驿旅行社」旗下品牌，结合自有车队「云昇通运」，提供全台包车、机场接送、研学旅行（校外教学）与企业差旅，30 分钟内回复。",
  sections: [
    {
      heading: "我们提供什么",
      bullets: [
        "包车／游览车（大巴包车）：研学旅行、企业旅游、进香团、大型团体。",
        "机场接送：桃园、松山航班接送、多点上下车、团体行李安排。",
        "旅游攻略：最新内容、热门路线与包车建议。",
        "快速报价：日期、人数、路线快速评估。",
        "真实走过的行程分享与照片。",
      ],
    },
    {
      heading: "适合谁",
      bullets: [
        "家庭、学校、企业。",
        "进香团、大型团体。",
        "不便转乘大众运输的同行者与海外旅客。",
      ],
    },
    {
      heading: "为什么选择浮云轻松游",
      bullets: [
        "30 分钟内回复。",
        "合法旅行社与游览车公司（自有车队 15 辆）。",
        "在职专业驾驶约 20 位，皆具职业驾照与载客经验。",
        "履约保证保险：旺旺友联产险 新台币 1,500 万元。",
        "热门路线：北海岸、野柳、九份、十分、宜兰、日月潭、阿里山、花东。",
      ],
    },
  ],
  faq: [
    {
      q: "浮云轻松游是合法公司吗？",
      a: "是。云驿旅行社（甲种旅行社 882200）为合法旅行社，云昇通运为自有车队，统一社会信用代码 60675708，品保会员北 2760。",
    },
    {
      q: "可以安排机场接送与多点上下车吗？",
      a: "可以。支援桃园、松山与各大机场接送，团体行李与多点上下车皆可安排。",
    },
    {
      q: "车队多大？安全吗？",
      a: "自有车队 15 辆、在职驾驶约 20 位，车辆定期保养与检验，以安全、准时、舒适为最高原则。",
    },
  ],
};

const ko: GeoSectionContent = {
  lang: "ko",
  h1: "浮雲輕鬆遊（Fuyun Travel）｜대만 차터버스 · 공항 송영 · 관광버스",
  lead: "浮雲輕鬆遊 Fuyun Travel는 합법 여행업체인 雲驛旅行社 Yunyi(云驿旅行社)의 브랜드로, 자체 차터버스 팀 雲陞通運 Yunsheng(云昇通运)과 함께 대만 전역 차터버스, 공항 송영, 학교 현장학습(修学旅行), 기업 연수를 제공합니다. 30분 이내 답변합니다.",
  sections: [
    {
      heading: "제공 서비스",
      bullets: [
        "차터버스: 학교 현장학습, 기업 연수, 진향단, 대규모 단체.",
        "공항 송영: 타오위안·송산, 항공편 기준 픽업, 다점 승하차, 단체 짐.",
        "여행 가이드: 최신 투어 정보, 인기 노선, 차터버스 선택 팁.",
        "빠른 견적: 날짜·인원·노선으로 신속 확인.",
        "실제 운행한 투어의 사진과 기록.",
      ],
    },
    {
      heading: "대상",
      bullets: [
        "가족, 학교, 기업.",
        "진향단·대규모 단체.",
        "대중교통 환승을 피하고 싶은 분, 외국인 여행객.",
      ],
    },
    {
      heading: "선택하는 이유",
      bullets: [
        "30분 이내 회신.",
        "합법 여행사 + 합법 버스 운영사(자체 차터버스 15대).",
        "전문 면허를 보유한 숙련 운전자 약 20명.",
        "보증보험: 왕왕우롄산물보험 TWD 1,500만.",
        "인기 노선: 북해안, 옌류(野柳), 지우펀(九份), 시뎬(十分), 이랑(宜蘭), 일월담, 아리산, 화롄·타이둥.",
      ],
    },
  ],
  faq: [
    {
      q: "浮雲輕鬆遊 Fuyun Travel는 합법 회사인가요?",
      a: "네. 雲驛旅行社 Yunyi(갑종 여행사 882200)가 합법 여행업, 雲陞通運 Yunsheng이 자체 차터버스, 통일번호 60675708, 품보 北 2760 입니다.",
    },
    {
      q: "공항 송영과 다점 승하차가 가능한가요?",
      a: "가능합니다. 타오위안·송산과 주요 공항, 단체 짐과 다점 승하차를 지원합니다.",
    },
    {
      q: "차량은 얼마나 되나요? 안전하나요?",
      a: "자체 차터버스 15대, 운전자 약 20명. 차량은 정기 검사·정비, 안전·정시·편의를 최우선합니다.",
    },
  ],
};

export const HOME = { zhHant, en, ja, zhcn, ko };
