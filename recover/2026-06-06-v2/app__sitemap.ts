import type { MetadataRoute } from "next";
import { SITE, absoluteUrl } from "@/lib/site";
import { fleetItems, serviceItems } from "@/lib/siteContent";
import { toursData } from "@/lib/tours";
import { travelArticles } from "@/lib/travelContent";

export default function sitemap(): MetadataRoute.Sitemap {
  const staticPaths = [
    "/",
    "/about",
    "/services",
    "/fleet",
    "/travel",
    "/reviews",
    "/contact",
    "/contact/inquiry",
    "/privacy",
    "/zh",
    "/en",
    "/ja",
    "/ko",
  ];

  const dynamicPaths = [
    ...serviceItems.map((item) => `/services/${item.slug}`),
    ...fleetItems.map((item) => `/fleet/${item.slug}`),
    ...travelArticles.map((article) => `/travel/${article.slug}`),
    ...toursData.map((tour) => `/itineraries/${tour.id}`),
  ];

  return [...staticPaths, ...dynamicPaths].map((path) => ({
    url: absoluteUrl(path),
    lastModified: new Date(),
    changeFrequency: path === SITE.url ? "daily" : "weekly",
    priority: path === "/" ? 1 : 0.7,
  }));
}
