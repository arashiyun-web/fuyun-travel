import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { SITE } from "@/lib/site";
import { getObject } from "./objectStore";
import { publicImageRef, type OperationsArticleMeta, type PublishedArticleData, type WebsitePublishDeps } from "./websitePublisher";

/** Database/network side of the website publisher (lib/operations/websitePublisher.ts). */

const READBACK_TIMEOUT_MS = 20_000;

function operationsMeta(seoJson: unknown): OperationsArticleMeta | null {
  const meta = (seoJson as { operations?: OperationsArticleMeta } | null)?.operations;
  return meta && typeof meta.contentId === "string" ? meta : null;
}

async function upsertPublishedArticle(data: PublishedArticleData) {
  const existing = await prisma.article.findUnique({ where: { slug: data.slug } });
  if (existing && operationsMeta(existing.seoJson)?.contentId !== data.seoJson.operations.contentId) {
    // Never overwrite an article that belongs to other content (or was written by hand).
    throw new Error(`slug ${data.slug} 已被其他文章使用`);
  }
  const fields = {
    title: data.title,
    content: data.content,
    excerpt: data.excerpt,
    category: data.category,
    tags: data.tags,
    location: data.location,
    seoJson: data.seoJson as unknown as Prisma.InputJsonValue,
    status: "published",
  };
  const row = existing
    ? await prisma.article.update({ where: { slug: data.slug }, data: { ...fields, publishedAt: existing.publishedAt ?? new Date() } })
    : await prisma.article.create({ data: { slug: data.slug, ...fields, publishedAt: new Date() } });
  return { id: row.id, slug: row.slug, status: row.status };
}

export function websitePublishDeps(): WebsitePublishDeps {
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL?.trim() || SITE.url).replace(/\/$/, "");
  const get = (url: string) => fetch(url, { cache: "no-store", redirect: "follow", headers: { "cache-control": "no-cache" }, signal: AbortSignal.timeout(READBACK_TIMEOUT_MS) });
  return {
    siteUrl,
    upsertPublishedArticle,
    fetchText: async (url) => {
      const response = await get(url);
      return { status: response.status, text: await response.text() };
    },
    fetchBytes: async (url) => {
      const response = await get(url);
      return { status: response.status, body: Buffer.from(await response.arrayBuffer()) };
    },
  };
}

/** Take a published operations article off the site; its page and image URLs stop serving. */
export async function unpublishOperationsArticle(articleId: string, contentId: string) {
  const article = await prisma.article.findUnique({ where: { id: articleId } });
  if (!article || operationsMeta(article.seoJson)?.contentId !== contentId) throw new Error("找不到這個工作建立的官網文章");
  await prisma.article.update({ where: { id: articleId }, data: { status: "unpublished" } });
  return { slug: article.slug };
}

/** Bytes behind /travel-media/<slug>/<n>: only images listed on a published article, checksum verified. */
export async function readPublicTravelImage(slug: string, n: string) {
  const article = await prisma.article.findFirst({ where: { slug, status: "published" }, select: { status: true, seoJson: true } });
  const ref = article ? publicImageRef(article, n) : null;
  if (!ref) return null;
  const object = await getObject(ref.key);
  if (object.sha256 !== ref.sha256) return null;
  return { buffer: object.buffer, contentType: ref.contentType };
}
