import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/site";
import { fleetItems, serviceItems } from "@/lib/siteContent";
import { locationPages, moneyPages } from "@/lib/growthPages";
import { toursData } from "@/lib/tours";
import { listPublishedTravelArticles } from "@/lib/dynamicTravelArticles";
import { schoolTrips } from "@/lib/travelExplore";
import { knowledgeEntries } from "@/src/data/knowledge";
import { attractionEntries } from "@/src/data/attractions";
import { charterRouteEntries } from "@/src/data/charterRoutes";

export const dynamic = "force-dynamic";

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
    // ── GEO multilingual core pages (5 locales: zh-Hant default + en/ja/zh-cn/ko) ──
    "/zh-cn",
    "/en/about",
    "/ja/about",
    "/zh-cn/about",
    "/airport-transfer",
    "/en/airport-transfer",
    "/ja/airport-transfer",
    "/zh-cn/airport-transfer",
    "/ko/airport-transfer",
    "/charter-bus",
    "/en/charter-bus",
    "/ja/charter-bus",
    "/zh-cn/charter-bus",
    "/ko/charter-bus",
    "/blog/taipei-jiufen-charter",
    "/en/blog/taipei-to-jiufen-charter-bus-price",
    "/ja/blog/taipei-jiufen-charter-rates",
    "/zh-cn/blog/taipei-jiufen-charter",
  ];

  const dynamicPaths = [
    ...serviceItems.map((item) => `/services/${item.slug}`),
    ...fleetItems.map((item) => `/fleet/${item.slug}`),
    ...articles.map((article) => `/travel/${article.slug}`),
    ...schoolTrips.map((item) => `/school-trips/${item.slug}`),
    ...toursData.map((tour) => `/itineraries/${tour.id}`),
    ...locationPages.map((page) => `/charter-bus/${page.slug}`),
    ...moneyPages.map((page) => `/service/${page.slug}`),
  ];

  const standardEntries: MetadataRoute.Sitemap = [...staticPaths, ...dynamicPaths].map((path) => ({
    url: absoluteUrl(path),
    lastModified: new Date(),
    changeFrequency: path === "/" ? "daily" : "weekly",
    priority: path === "/" ? 1 : path.includes("/service/") || path.includes("/charter-bus/") ? 0.85 : 0.7,
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

  return [...standardEntries, ...knowledgeSitemapEntries, ...attractionSitemapEntries, ...routeSitemapEntries];
}
