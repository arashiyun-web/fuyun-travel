/**
 * Fixed content dates for sitemap lastModified (YYYY-MM-DD, Asia/Taipei).
 * Never use the request time here: crawlers and answer engines read lastmod as "this page really changed".
 * Each date is the last commit that touched the page source or its content data (git log, 2026-11-13).
 * When you change a page's visible content, update its date in the same commit.
 */
export const AEO_FIX_DATE = "2026-11-13";

export const STATIC_PAGE_DATES: Record<string, string> = {
  "/": "2026-11-13",
  "/about": "2026-08-24",
  "/services": "2026-09-15",
  "/fleet": "2026-11-11",
  "/travel": "2026-08-24",
  "/knowledge": "2026-08-24",
  "/attractions": "2026-08-24",
  "/charter-routes": "2026-08-24",
  "/travel-planner": "2026-08-24",
  "/itineraries": "2026-09-23",
  "/reviews": AEO_FIX_DATE,
  "/featured-trips": AEO_FIX_DATE,
  "/highlights": "2026-11-01",
  "/ai-trip-planner": "2026-08-24",
  "/contact": "2026-08-24",
  "/contact/inquiry": "2026-08-24",
  "/download": "2026-11-11",
  "/privacy": "2026-08-24",
  "/zh": "2026-08-24",
  "/zh-tw": "2026-11-11",
  "/en": "2026-08-24",
  "/ja": "2026-08-24",
  "/ko": "2026-08-24",
  "/ms": "2026-08-24",
  "/vi": "2026-08-24",
  "/th": "2026-08-24",
};

export const SECTION_DATES = {
  services: AEO_FIX_DATE,
  fleet: "2026-11-11",
  travelTemplate: AEO_FIX_DATE,
  schoolTrips: "2026-08-24",
  itineraries: "2026-09-23",
  charterBus: AEO_FIX_DATE,
} as const;

/** Fallback for a path missing from the table above. A fixed date, not "now". */
export const DEFAULT_CONTENT_DATE = "2026-08-24";

export function taipeiDate(date: string): Date {
  return new Date(`${date}T00:00:00+08:00`);
}

/** The later of two YYYY-MM-DD dates (string compare is safe for this format). */
export function laterDate(a: string, b: string): string {
  return a > b ? a : b;
}
