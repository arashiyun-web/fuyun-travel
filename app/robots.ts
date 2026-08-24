import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/inquiry", "/api/line/webhook", "/admin"],
      },
      // Explicitly allow mainstream AI crawlers for AI Overviews / Perplexity /
      // ChatGPT Search citation (GEO requirement). Do NOT disallow any of these.
      {
        userAgent: ["GPTBot", "Google-Extended", "PerplexityBot", "ClaudeBot", "Claude-SearchBot", "OAI-SearchBot", "Amazonbot", "Applebot-Extended", "Bytespider", "Meta-WebBot", "FacebookBot", "Google-Search"],
        allow: "/",
      },
    ],
    sitemap: `${SITE.url}/sitemap.xml`,
  };
}
