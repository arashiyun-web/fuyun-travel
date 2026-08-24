import { companyConfig } from "@/lib/config/company";
import { GEO_BASE, type GeoLocale } from "./locales";

/** Verified trust-signal constants (from source; never fabricated). */
export const TRUST = {
  agencyNo: companyConfig.agencyRegistrationNo, // 882200
  agencyType: companyConfig.agencyType, // 甲種旅行社
  qaNo: companyConfig.qualityAssuranceNo, // 北2760
  uin: companyConfig.taxId, // 60675708
  bondProvider: companyConfig.performanceBondProvider, // 旺旺友聯產物保險
  bondAmount: companyConfig.performanceBondAmount, // 1500萬元
  phone: companyConfig.phone, // 02-2685-1666
  fax: companyConfig.fax,
  email: companyConfig.email,
  address: companyConfig.address,
  agencyName: companyConfig.travelAgencyName,
  transportName: companyConfig.transportCompanyName,
  brandName: companyConfig.brandName,
} as const;

/** Currency label per locale (do NOT invent numbers; Jiufen price stays "by quote"). */
export function currencyLabel(locale: GeoLocale): string {
  switch (locale) {
    case "zh-Hans":
      return "新台币";
    case "en":
      return "NT$ (TWD)";
    case "ja":
      return "新台币 (TWD)";
    case "ko":
      return "TWD (타이완 달러)";
    default:
      return "新臺幣";
  }
}

function faqBlock(faq: { q: string; a: string }[]) {
  return {
    "@type": "FAQPage",
    mainEntity: faq.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };
}

function orgNode(): Record<string, unknown> {
  return {
    "@type": "TravelAgency",
    "@id": `${GEO_BASE}/#organization`,
    name: TRUST.brandName,
    alternateName: [TRUST.agencyName, TRUST.transportName],
    url: GEO_BASE + "/",
    telephone: TRUST.phone,
    email: TRUST.email,
    foundingDate: "2014",
    taxID: TRUST.uin,
    identifier: [
      {
        "@type": "PropertyValue",
        propertyID: `${TRUST.agencyType}登記證號`,
        value: TRUST.agencyNo,
      },
      {
        "@type": "PropertyValue",
        propertyID: "品保協會會員編號",
        value: TRUST.qaNo,
      },
    ],
    address: {
      "@type": "PostalAddress",
      streetAddress: TRUST.address,
      addressCountry: "TW",
    },
    areaServed: "TW",
    hasCredential: {
      "@type": "Credential",
      name: "履約保證保險",
      credentialCategory: "履約保證保險",
      description: `${TRUST.bondProvider} ${TRUST.bondAmount}`,
    },
  };
}

export interface GeoServiceSchemaInput {
  locale: GeoLocale;
  service: { name: string; description: string; url: string };
  faq: { q: string; a: string }[];
}

/**
 * Build a single JSON-LD @graph for a GEO core page:
 * TravelAgency (Organization) + Service + FAQPage.
 * Every locale ships ALL trust signals + the brand entity.
 */
export function buildGeoSchema(input: GeoServiceSchemaInput): object {
  return {
    "@context": "https://schema.org",
    "@graph": [
      orgNode(),
      {
        "@type": "Service",
        "@id": input.service.url + "#service",
        name: input.service.name,
        description: input.service.description,
        url: input.service.url,
        provider: { "@id": `${GEO_BASE}/#organization` },
        areaServed: "TW",
        availableChannel: {
          "@type": "ServiceChannel",
          servicePhone: { "@type": "ContactPoint", telephone: TRUST.phone, contactType: "customer service" },
        },
      },
      faqBlock(input.faq),
    ],
  };
}
