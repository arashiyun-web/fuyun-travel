import { SITE, absoluteUrl } from "@/lib/site";
import { listPublishedTravelArticles } from "@/lib/dynamicTravelArticles";

export const dynamic = "force-dynamic";

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function GET() {
  const travelArticles = await listPublishedTravelArticles();
  const items = travelArticles
    .map(
      (article) => `
        <item>
          <title>${escapeXml(article.title)}</title>
          <link>${absoluteUrl(`/travel/${article.slug}`)}</link>
          <guid>${absoluteUrl(`/travel/${article.slug}`)}</guid>
          <pubDate>${new Date(article.publishDate).toUTCString()}</pubDate>
          <description>${escapeXml(article.description)}</description>
        </item>`,
    )
    .join("");

  const xml = `<?xml version="1.0" encoding="UTF-8" ?>
    <rss version="2.0">
      <channel>
        <title>${escapeXml(SITE.name)}</title>
        <link>${SITE.url}</link>
        <description>${escapeXml(SITE.defaultDescription)}</description>
        ${items}
      </channel>
    </rss>`;

  return new Response(xml.trim(), {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
    },
  });
}
