import { SITE, absoluteUrl } from "@/lib/site";
import { travelArticles } from "@/lib/travelContent";

export async function GET() {
  const items = travelArticles
    .map(
      (article) => `
        <item>
          <title><![CDATA[${article.title}]]></title>
          <link>${absoluteUrl(`/travel/${article.slug}`)}</link>
          <guid>${absoluteUrl(`/travel/${article.slug}`)}</guid>
          <pubDate>${new Date(article.publishDate).toUTCString()}</pubDate>
          <description><![CDATA[${article.description}]]></description>
        </item>`
    )
    .join("");

  const xml = `<?xml version="1.0" encoding="UTF-8" ?>
    <rss version="2.0">
      <channel>
        <title>${SITE.name}</title>
        <link>${SITE.url}</link>
        <description>${SITE.defaultDescription}</description>
        ${items}
      </channel>
    </rss>`;

  return new Response(xml.trim(), {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
    },
  });
}
