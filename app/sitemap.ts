import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/site";
import { fleetItems, serviceItems } from "@/lib/siteContent";
import { locationPages, moneyPages } from "@/lib/growthPages";
import { toursData } from "@/lib/tours";
import { listPublishedTravelArticles } from "@/lib/dynamicTravelArticles";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const articles = await listPublishedTravelArticles();
  const staticPaths = [
    "/",
    "/about",
    "/services",
    "/fleet",
    "/travel",
    "/reviews",
    "/featured-trips",
    "/ai-trip-planner",
    "/contact",
    "/contact/inquiry",
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

  const dynamicPaths = [
    ...serviceItems.map((item) => `/services/${item.slug}`),
    ...fleetItems.map((item) => `/fleet/${item.slug}`),
    ...articles.map((article) => `/travel/${article.slug}`),
    ...toursData.map((tour) => `/itineraries/${tour.id}`),
    ...locationPages.map((page) => `/charter-bus/${page.slug}`),
    ...moneyPages.map((page) => `/service/${page.slug}`),
  ];

  return [...staticPaths, ...dynamicPaths].map((path) => ({
    url: absoluteUrl(path),
    lastModified: new Date(),
    changeFrequency: path === "/" ? "daily" : "weekly",
    priority: path === "/" ? 1 : path.includes("/service/") || path.includes("/charter-bus/") ? 0.85 : 0.7,
  }));
}
