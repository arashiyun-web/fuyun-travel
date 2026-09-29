import { createHash } from "crypto";

/**
 * Publishes an approved operations job as a public /travel article.
 *
 * - One article per content (deterministic slug), so a retried job updates the same article.
 * - The article body is the approved caption; only its leading "# title" line is dropped because the page
 *   renders the title itself.
 * - Images stay in the private bucket. Their permanent public paths /travel-media/<slug>/<n> are served
 *   only while the article is published (see publicImageRef); drafts keep using the admin-only route.
 * - The job counts as published only after the public page shows the title, the text and every image
 *   link, and every image URL returns the approved bytes.
 */

export type WebsiteImageRef = { key: string; sha256: string; contentType: string; alt: string };

export type WebsitePublishInput = {
  contentId: string;
  jobId: string;
  title: string;
  type: string;
  tripDate: string;
  caption: string;
  approvalHash: string;
  images: WebsiteImageRef[];
};

export type OperationsArticleMeta = {
  contentId: string;
  jobId: string;
  approvalHash: string;
  tripDate: string;
  images: WebsiteImageRef[];
};

export type PublishedArticleData = {
  slug: string;
  title: string;
  content: string;
  excerpt: string;
  category: string;
  tags: string[];
  location: string;
  seoJson: { description: string; operations: OperationsArticleMeta };
};

export type WebsitePublishDeps = {
  siteUrl: string;
  /** Create or update the article by slug as published; must refuse a slug owned by other content. */
  upsertPublishedArticle: (data: PublishedArticleData) => Promise<{ id: string; slug: string; status: string }>;
  fetchText: (url: string) => Promise<{ status: number; text: string }>;
  fetchBytes: (url: string) => Promise<{ status: number; body: Buffer }>;
};

export type WebsitePublishResult =
  | { ok: true; articleId: string; url: string; imageUrls: string[] }
  | { ok: false; reason: string };

export function websiteSlug(contentId: string) {
  return `trip-${contentId.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")}`;
}

export function websiteArticleBody(caption: string, title: string) {
  const lines = caption.split("\n");
  if (lines[0]?.trim() !== `# ${title}`.trim()) return caption;
  return lines.slice(lines[1]?.trim() === "" ? 2 : 1).join("\n");
}

export function publicImagePath(slug: string, index: number) {
  return `/travel-media/${slug}/${index + 1}`;
}

/** Text as React renders it into HTML, so the check compares like with like. */
function htmlText(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;");
}

function sha256Hex(buffer: Buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

export async function publishWebsiteArticle(input: WebsitePublishInput, deps: WebsitePublishDeps): Promise<WebsitePublishResult> {
  const slug = websiteSlug(input.contentId);
  const content = websiteArticleBody(input.caption, input.title);
  const firstLine = content.split("\n").find((line) => line.trim())?.trim() || "";
  let article;
  try {
    article = await deps.upsertPublishedArticle({
      slug,
      title: input.title,
      content,
      excerpt: firstLine.slice(0, 140),
      category: "旅遊攻略",
      tags: [input.type, "浮雲輕鬆遊"],
      location: "台灣",
      seoJson: {
        description: firstLine.slice(0, 140),
        operations: { contentId: input.contentId, jobId: input.jobId, approvalHash: input.approvalHash, tripDate: input.tripDate, images: input.images },
      },
    });
  } catch (error) {
    return { ok: false, reason: `官網文章寫入失敗：${error instanceof Error ? error.message : "unknown"}` };
  }

  const base = deps.siteUrl.replace(/\/$/, "");
  const url = `${base}/travel/${slug}`;
  const imageUrls = input.images.map((_, index) => `${base}${publicImagePath(slug, index)}`);
  const page = await deps.fetchText(url).catch(() => ({ status: 0, text: "" }));
  if (page.status !== 200) return { ok: false, reason: `公開頁尚未可讀（HTTP ${page.status}）` };
  if (!page.text.includes(htmlText(input.title))) return { ok: false, reason: "公開頁尚未讀到標題" };
  if (firstLine && !page.text.includes(htmlText(firstLine))) return { ok: false, reason: "公開頁尚未讀到核准內文" };
  for (let index = 0; index < input.images.length; index += 1) {
    if (!page.text.includes(publicImagePath(slug, index))) return { ok: false, reason: `公開頁缺少第 ${index + 1} 張圖片` };
    const image = await deps.fetchBytes(imageUrls[index]).catch(() => ({ status: 0, body: Buffer.alloc(0) }));
    if (image.status !== 200 || sha256Hex(image.body) !== input.images[index].sha256) {
      return { ok: false, reason: `第 ${index + 1} 張公開圖片與核准版本不符（HTTP ${image.status}）` };
    }
  }
  return { ok: true, articleId: article.id, url, imageUrls };
}

/** The approved image behind /travel-media/<slug>/<n>, only while the article is published. */
export function publicImageRef(article: { status: string; seoJson: unknown }, n: string): WebsiteImageRef | null {
  if (article.status !== "published" || !/^[1-9][0-9]?$/.test(n)) return null;
  const images = (article.seoJson as { operations?: { images?: WebsiteImageRef[] } } | null)?.operations?.images;
  if (!Array.isArray(images)) return null;
  return images[Number(n) - 1] ?? null;
}
