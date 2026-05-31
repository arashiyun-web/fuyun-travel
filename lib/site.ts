import type { Metadata } from "next";

export const SITE = {
  url: "https://fuyuntravel.com",
  name: "浮雲旅遊",
  defaultTitle: "浮雲旅遊｜專業包車旅遊服務",
  defaultDescription:
    "浮雲旅遊提供台灣包車旅遊、企業接待、機場接送與客製化行程規劃，由專人協助確認車型、日期與報價。",
  ogImage: "/hero-bus-sunny.png",
} as const;

export const LINE_URL: string =
  process.env.NEXT_PUBLIC_LINE_URL ?? "https://line.me/R/ti/p/@954fyicw";

export const COMPANY = {
  companyName: "雲驛旅行社有限公司",
  siteName: "浮雲旅遊",
  url: SITE.url,
  agencyType: "品保會員-甲種旅行社",
  registrationNo: "882200",
  taxId: "60675708",
  address: "新北市板橋區大觀路三段160巷20號6樓",
  representative: "",
  phone: "02-2685-1666",
  fax: "02-2685-1528",
  email: "yunyi6866@gmail.com",
  contactPerson: "蔡宛融",
  business: "台灣包車旅遊、企業接待、機場接送、客製化行程規劃",
  memberVerify: "品保協會會員編號：北2760",
  performanceBond: "旺旺友聯產物履約保證保險：15,000,000",
  liabilityInsurance: "",
} as const;

export function pageMeta(args: {
  title: string;
  description?: string;
  path?: string;
}): Metadata {
  const description = args.description ?? SITE.defaultDescription;
  const path = args.path ?? "/";
  const url = `${SITE.url}${path}`;
  const fullTitle = `${args.title}｜${SITE.name}`;

  return {
    title: args.title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title: fullTitle,
      description,
      url,
      type: "website",
      siteName: SITE.name,
      locale: "zh_TW",
      images: [SITE.ogImage],
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description,
      images: [SITE.ogImage],
    },
  };
}
