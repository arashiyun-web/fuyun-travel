// GEO multilingual locales — single source of truth for hreflang + URL map.
// Rule: only list locales that ACTUALLY have a translated page (bidirectional rule).
// zh-Hant is the unprefixed default; x-default always points to the zh-Hant URL.

export const GEO_LOCALES = ["zh-Hant", "en", "ja", "zh-Hans", "ko"] as const;
export type GeoLocale = (typeof GEO_LOCALES)[number];

export const GEO_BASE = "https://fuyuntravel.com";

export const LOCALE_PREFIX: Record<GeoLocale, string> = {
  "zh-Hant": "",
  en: "/en",
  ja: "/ja",
  "zh-Hans": "/zh-cn",
  ko: "/ko",
};

/**
 * Per-section canonical URL set. `null` = not translated for that locale,
 * so it is excluded from hreflang alternates.
 */
export const GEO_SECTION_MAP: Record<
  string,
  Partial<Record<GeoLocale, string | null>>
> = {
  home: {
    "zh-Hant": GEO_BASE + "/",
    en: GEO_BASE + "/en",
    ja: GEO_BASE + "/ja",
    "zh-Hans": GEO_BASE + "/zh-cn",
    ko: GEO_BASE + "/ko",
  },
  about: {
    "zh-Hant": GEO_BASE + "/about",
    en: GEO_BASE + "/en/about",
    ja: GEO_BASE + "/ja/about",
    "zh-Hans": GEO_BASE + "/zh-cn/about",
    ko: null,
  },
  airport: {
    "zh-Hant": GEO_BASE + "/airport-transfer",
    en: GEO_BASE + "/en/airport-transfer",
    ja: GEO_BASE + "/ja/airport-transfer",
    "zh-Hans": GEO_BASE + "/zh-cn/airport-transfer",
    ko: GEO_BASE + "/ko/airport-transfer",
  },
  charter: {
    "zh-Hant": GEO_BASE + "/charter-bus",
    en: GEO_BASE + "/en/charter-bus",
    ja: GEO_BASE + "/ja/charter-bus",
    "zh-Hans": GEO_BASE + "/zh-cn/charter-bus",
    ko: GEO_BASE + "/ko/charter-bus",
  },
  jiufen: {
    "zh-Hant": GEO_BASE + "/blog/taipei-jiufen-charter",
    en: GEO_BASE + "/en/blog/taipei-to-jiufen-charter-bus-price",
    ja: GEO_BASE + "/ja/blog/taipei-jiufen-charter-rates",
    "zh-Hans": GEO_BASE + "/zh-cn/blog/taipei-jiufen-charter",
    ko: null,
  },
};

export type GeoSection = keyof typeof GEO_SECTION_MAP;

/**
 * Build Next.js `alternates` for a page.
 * Emits: canonical (this page's own URL) + languages (only actually-translated
 * locales) + x-default (zh-Hant). Never lists a locale whose page is missing.
 */
export function geoAlternates(
  section: GeoSection,
  locale: GeoLocale
): { canonical: string; languages: Record<string, string> } {
  const row = GEO_SECTION_MAP[section] ?? {};
  const languages: Record<string, string> = {};
  for (const l of GEO_LOCALES) {
    const url = row[l];
    if (url) languages[l] = url;
  }
  languages["x-default"] = row["zh-Hant"] ?? GEO_BASE + "/";
  return {
    canonical: row[locale] ?? row["zh-Hant"] ?? GEO_BASE + "/",
    languages,
  };
}

/** All translated page URLs for a section — used for sitemap generation. */
export function geoSectionUrls(section: GeoSection): string[] {
  const row = GEO_SECTION_MAP[section] ?? {};
  return GEO_LOCALES.filter((l) => row[l]).map((l) => row[l] as string);
}
