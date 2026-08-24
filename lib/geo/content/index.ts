import { HOME } from "./home";
import { ABOUT } from "./about";
import { AIRPORT } from "./airport";
import { CHARTER } from "./charter";
import { JIUFIN } from "./jiufen";
import type { GeoSectionContent } from "./home";

export const GEO_PAGES = {
  home: HOME,
  about: ABOUT,
  airport: AIRPORT,
  charter: CHARTER,
  jiufen: JIUFIN,
} as const;

export type GeoPageKey = keyof typeof GEO_PAGES;
export type { GeoSectionContent };

type LocaleKey = "zhHant" | "en" | "ja" | "zhcn" | "ko";

/** Return content for a locale; falls back to zhHant safely (never undefined). */
export function geoContent(
  key: GeoPageKey,
  locale: string
): GeoSectionContent {
  const page = GEO_PAGES[key] as Record<string, GeoSectionContent> | undefined;
  if (!page) throw new Error(`unknown geo page: ${key}`);
  const k =
    locale === "en" ? "en"
    : locale === "ja" ? "ja"
    : locale === "zh-Hans" || locale === "zh-cn" ? "zhcn"
    : locale === "ko" ? "ko"
    : "zhHant";
  return page[k] ?? page.zhHant;
}
