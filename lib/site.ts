import type { Metadata } from "next";
import { companyConfig, getLineOaUrl } from "@/lib/config/company";

export const SITE = {
  url: companyConfig.siteUrl,
  name: companyConfig.brandName,
  defaultTitle: `${companyConfig.brandName}｜台灣包車旅遊與遊覽車服務`,
  defaultDescription:
    "浮雲輕鬆遊提供遊覽車包車、中巴包車、九人座包車、機場接送、校外教學、企業旅遊與客製化台灣行程規劃。",
  ogImage: companyConfig.ogImage,
  locale: "zh_TW",
} as const;

export const LINE_URL: string = getLineOaUrl();

// 手動維護：公司/服務資料（COMPANY、SITE.defaultDescription 等）有實質異動時更新此日期。
// 用於 JSON-LD dateModified，供 AI 爬蟲判斷內容新鮮度（AEO 稽核 2026-08-21 發現缺漏補上）。
export const CONTENT_LAST_VERIFIED = "2026-08-21";

export const COMPANY = {
  companyName: companyConfig.travelAgencyName,
  fleetCompanyName: companyConfig.transportCompanyName,
  siteName: SITE.name,
  url: SITE.url,
  agencyType: companyConfig.agencyType,
  registrationNo: companyConfig.agencyRegistrationNo,
  taxId: companyConfig.taxId,
  address: companyConfig.address,
  representative: companyConfig.founder,
  phone: companyConfig.phone,
  fax: companyConfig.fax,
  email: companyConfig.email,
  contactPerson: companyConfig.contactPerson,
  business: companyConfig.services.join("、"),
  memberVerify: `品保會員 ${companyConfig.qualityAssuranceNo}`,
  performanceBond: `${companyConfig.performanceBondProvider}履約保證保險 ${companyConfig.performanceBondAmount}`,
  liabilityInsurance: "依法投保車輛與旅客相關保險",
  facebookSource: companyConfig.facebookSource,
  facebookUrl: companyConfig.facebookUrl,
  geo: companyConfig.geo,
  fleetSize: companyConfig.fleetSize,
  driverCount: companyConfig.driverCount,
} as const;

export function absoluteUrl(path = "/") {
  return `${SITE.url}${path.startsWith("/") ? path : `/${path}`}`;
}

// 實際存在的語言入口頁（各自只有 app/<locale>/page.tsx，底下沒有巢狀路由）。
// hreflang 只能指向這份清單裡的網址；新增語言入口頁時才在這裡加一筆，
// 不要用「locale + 任意 path」拼網址，那些翻譯頁並不存在。
export const LOCALE_ENTRIES = [
  { hreflang: "zh", path: "/zh" },
  { hreflang: "zh-Hant", path: "/zh-tw" },
  { hreflang: "en", path: "/en" },
  { hreflang: "ja", path: "/ja" },
  { hreflang: "ko", path: "/ko" },
  { hreflang: "ms", path: "/ms" },
  { hreflang: "vi", path: "/vi" },
  { hreflang: "th", path: "/th" },
] as const;

export const LOCALE_ENTRY_PATHS: readonly string[] = LOCALE_ENTRIES.map((entry) => entry.path);

function normalizePath(path: string) {
  const withSlash = path.startsWith("/") ? path : `/${path}`;
  return withSlash.replace(/\/+$/, "") || "/";
}

// 首頁與語言入口頁共用同一組 alternates（8 個語言入口 + x-default 指向 /）。
// 只有中文、沒有翻譯版的頁面：不輸出 x-default，也不輸出只指向自己的 hreflang。
type LanguageAlternates = NonNullable<NonNullable<Metadata["alternates"]>["languages"]>;

export function isMultilingualEntry(path: string) {
  const normalized = normalizePath(path);
  return normalized === "/" || LOCALE_ENTRY_PATHS.includes(normalized);
}

export function languageAlternates(path: string): LanguageAlternates | undefined {
  if (!isMultilingualEntry(path)) return undefined;
  const languages: LanguageAlternates = {};
  for (const entry of LOCALE_ENTRIES) languages[entry.hreflang] = absoluteUrl(entry.path);
  languages["x-default"] = absoluteUrl("/");
  return languages;
}

export const LOCALE_ENTRY_LANGUAGES = languageAlternates("/")!;

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
  const languages = languageAlternates(path);

  return {
    title: args.title,
    description,
    alternates: languages ? { canonical: url, languages } : { canonical: url },
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
    "@type": ["TravelAgency", "Organization"],
    name: COMPANY.siteName,
    alternateName: [COMPANY.companyName, COMPANY.fleetCompanyName],
    description: SITE.defaultDescription,
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
    image: absoluteUrl(SITE.ogImage),
    dateModified: CONTENT_LAST_VERIFIED,
  };
}

export function websiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE.name,
    url: SITE.url,
    inLanguage: "zh-Hant",
    dateModified: CONTENT_LAST_VERIFIED,
  };
}
