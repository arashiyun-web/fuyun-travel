import type { Metadata } from "next";

export const SITE = {
  url: "https://fuyuntravel.com",
  name: "浮雲輕鬆遊",
  defaultTitle: "浮雲輕鬆遊｜台灣包車旅遊與遊覽車服務",
  defaultDescription:
    "浮雲輕鬆遊提供遊覽車包車、中巴包車、九人座包車、機場接送、校外教學、企業旅遊與客製化台灣行程規劃。",
  ogImage: "/hero-bus-sunny.png",
  locale: "zh_TW",
} as const;

export const LINE_URL: string =
  process.env.NEXT_PUBLIC_LINE_URL ?? "https://line.me/R/ti/p/@954fyicw";

export const COMPANY = {
  companyName: "雲驛旅行社有限公司",
  fleetCompanyName: "雲陞通運有限公司",
  siteName: SITE.name,
  url: SITE.url,
  agencyType: "旅行社與車隊包車服務",
  registrationNo: "品保會員 北2760",
  taxId: "60675708",
  address: "新北市板橋區大觀路三段160巷20號6樓",
  representative: "雲惠民",
  phone: "02-2685-1666",
  fax: "02-2685-1528",
  email: "yunyi6866@gmail.com",
  contactPerson: "浮雲客服",
  business:
    "遊覽車包車、中巴包車、九人座包車、機場接送、校外教學、企業旅遊、國內旅遊與客製化行程",
  memberVerify: "品保會員 北2760",
  performanceBond: "旺旺友聯產險履約保證保險 1,500 萬元",
  liabilityInsurance: "依法投保車輛與旅客相關保險",
  facebookSource: "小羽旅遊趣",
  facebookUrl: "https://www.facebook.com/share/g/1NPbXN8THD/",
  geo: {
    latitude: 25.0065,
    longitude: 121.448,
    region: "TW-NWT",
  },
} as const;

export function absoluteUrl(path = "/") {
  return `${SITE.url}${path.startsWith("/") ? path : `/${path}`}`;
}

export function pageMeta(args: {
  title: string;
  description?: string;
  path?: string;
  image?: string;
  type?: "website" | "article";
}): Metadata {
  const description = args.description ?? SITE.defaultDescription;
  const path = args.path ?? "/";
  const url = absoluteUrl(path);
  const image = args.image ?? SITE.ogImage;
  const fullTitle = `${args.title}｜${SITE.name}`;

  return {
    title: args.title,
    description,
    alternates: {
      canonical: url,
      languages: {
        "zh-Hant": absoluteUrl(`/zh${path === "/" ? "" : path}`),
        en: absoluteUrl(`/en${path === "/" ? "" : path}`),
        ja: absoluteUrl(`/ja${path === "/" ? "" : path}`),
        ko: absoluteUrl(`/ko${path === "/" ? "" : path}`),
      },
    },
    openGraph: {
      title: fullTitle,
      description,
      url,
      type: args.type ?? "website",
      siteName: SITE.name,
      locale: SITE.locale,
      images: [image],
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description,
      images: [image],
    },
  };
}

export function organizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "TravelAgency",
    name: COMPANY.companyName,
    alternateName: [COMPANY.siteName, COMPANY.fleetCompanyName],
    url: SITE.url,
    telephone: COMPANY.phone,
    email: COMPANY.email,
    faxNumber: COMPANY.fax,
    address: {
      "@type": "PostalAddress",
      streetAddress: COMPANY.address,
      addressCountry: "TW",
    },
    geo: {
      "@type": "GeoCoordinates",
      latitude: COMPANY.geo.latitude,
      longitude: COMPANY.geo.longitude,
    },
    areaServed: "Taiwan",
    serviceType: COMPANY.business.split("、"),
    sameAs: [COMPANY.facebookUrl],
  };
}
