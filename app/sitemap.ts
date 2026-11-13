import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/site";
import { fleetItems, serviceItems } from "@/lib/siteContent";
import { locationPages } from "@/lib/growthPages";
import { DEFAULT_CONTENT_DATE, SECTION_DATES, STATIC_PAGE_DATES, laterDate, taipeiDate } from "@/lib/contentDates";
import { toursData } from "@/lib/tours";
import { listPublishedTravelArticles } from "@/lib/dynamicTravelArticles";
import { schoolTrips } from "@/lib/travelExplore";
import { knowledgeEntries } from "@/src/data/knowledge";
import { attractionEntries } from "@/src/data/attractions";
import { charterRouteEntries } from "@/src/data/charterRoutes";

export const dynamic = "force-dynamic";

// Test and debug pages. Kept reachable, but never listed for crawlers.
const unindexedPaths = new Set(["/ai-test"]);

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const articles = await listPublishedTravelArticles();
  const staticPaths = [
    "/",
    "/about",
    "/services",
    "/fleet",
    "/travel",
    "/knowledge",
    "/attractions",
    "/charter-routes",
    "/travel-planner",
    "/itineraries",
    "/reviews",
    "/featured-trips",
    "/highlights",
    "/ai-trip-planner",
    "/contact",
    "/contact/inquiry",
    "/download",
    "/privacy",
    "/zh",
    "/zh-tw",
    "/en",
    "/ja",
    "/ko",
    "/ms",
    "/vi",
    "/th",
  ];

  // /service/* 已 301 到 /services/*（正本），sitemap 只列正本。
  const dynamicPaths: Array<[string, string]> = [
    ...serviceItems.map((item): [string, string] => [`/services/${item.slug}`, SECTION_DATES.services]),
    ["/services/price", SECTION_DATES.services],
    ...fleetItems.map((item): [string, string] => [`/fleet/${item.slug}`, SECTION_DATES.fleet]),
    ...articles.map((article): [string, string] => [`/travel/${article.slug}`, laterDate(article.publishDate || DEFAULT_CONTENT_DATE, SECTION_DATES.travelTemplate)]),
    ...schoolTrips.map((item): [string, string] => [`/school-trips/${item.slug}`, SECTION_DATES.schoolTrips]),
    ...toursData.map((tour): [string, string] => [`/itineraries/${tour.id}`, SECTION_DATES.itineraries]),
    ...locationPages.map((page): [string, string] => [`/charter-bus/${page.slug}`, SECTION_DATES.charterBus]),
  ];

  const datedPaths: Array<[string, string]> = [
    ...staticPaths.map((path): [string, string] => [path, STATIC_PAGE_DATES[path] || DEFAULT_CONTENT_DATE]),
    ...dynamicPaths,
  ];

  const standardEntries: MetadataRoute.Sitemap = datedPaths.filter(([path]) => !unindexedPaths.has(path)).map(([path, date]) => ({
    url: absoluteUrl(path),
    lastModified: taipeiDate(date),
    changeFrequency: path === "/" ? "daily" : "weekly",
    priority: path === "/" ? 1 : path.startsWith("/services/") || path.includes("/charter-bus/") ? 0.85 : 0.7,
  }));

  const knowledgeSitemapEntries: MetadataRoute.Sitemap = knowledgeEntries.map((entry) => ({
    url: absoluteUrl(`/knowledge/${entry.slug}`),
    lastModified: new Date(`${entry.updatedAt}T00:00:00+08:00`),
    changeFrequency: "monthly",
    priority: 0.72,
  }));

  const attractionSitemapEntries: MetadataRoute.Sitemap = attractionEntries.map((entry) => ({
    url: absoluteUrl(`/attractions/${entry.slug}`),
    lastModified: new Date(`${entry.updatedAt}T00:00:00+08:00`),
    changeFrequency: "monthly",
    priority: 0.78,
  }));

  const routeSitemapEntries: MetadataRoute.Sitemap = charterRouteEntries.map((entry) => ({
    url: absoluteUrl(`/charter-routes/${entry.slug}`),
    lastModified: new Date(`${entry.updatedAt}T00:00:00+08:00`),
    changeFrequency: "monthly",
    priority: 0.8,
  }));

  return [...standardEntries, ...knowledgeSitemapEntries, ...attractionSitemapEntries, ...routeSitemapEntries].filter((entry) => {
    const path = new URL(entry.url).pathname.replace(/\/$/, "") || "/";
    return !unindexedPaths.has(path);
  });
}
