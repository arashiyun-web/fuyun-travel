import type { Article } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { travelArticles, type TravelArticle, type TravelCategory } from "@/lib/travelContent";

type StoredSeo = {
  description?: string;
  faq?: Array<{ question: string; answer: string }>;
};

function category(value: string): TravelCategory {
  const allowed: TravelCategory[] = [
    "賞花", "美食", "景點", "包車旅遊", "校外教學",
    "企業旅遊", "銀髮旅遊", "機場接送", "旅遊攻略",
  ];
  return allowed.includes(value as TravelCategory) ? (value as TravelCategory) : "旅遊攻略";
}

export function storedArticleToTravelArticle(article: Article): TravelArticle {
  const seo = (article.seoJson || {}) as StoredSeo;
  return {
    slug: article.slug,
    title: article.title,
    description: article.excerpt || seo.description || article.content.slice(0, 140),
    publishDate: (article.publishedAt || article.createdAt).toISOString().slice(0, 10),
    category: category(article.category),
    tags: article.tags,
    location: article.location || "台灣",
    image: "/hero-bus-sunny.png",
    sections: [{ heading: "旅遊內容", body: article.content }],
    faq: Array.isArray(seo.faq) ? seo.faq : [],
  };
}

export async function listPublishedTravelArticles(): Promise<TravelArticle[]> {
  try {
    const stored = await prisma.article.findMany({
      where: { status: "published" },
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    });
    const dynamic = stored.map(storedArticleToTravelArticle);
    const dynamicSlugs = new Set(dynamic.map((article) => article.slug));
    return [...dynamic, ...travelArticles.filter((article) => !dynamicSlugs.has(article.slug))];
  } catch (error) {
    console.error("Unable to load dynamic travel articles", error);
    return travelArticles;
  }
}

export async function findPublishedTravelArticle(slug: string): Promise<TravelArticle | undefined> {
  const staticArticle = travelArticles.find((article) => article.slug === slug);
  try {
    const stored = await prisma.article.findFirst({ where: { slug, status: "published" } });
    return stored ? storedArticleToTravelArticle(stored) : staticArticle;
  } catch (error) {
    console.error("Unable to load dynamic travel article", error);
    return staticArticle;
  }
}
