import { NextResponse } from "next/server";
import { envConfig } from "@/lib/config/company";
import { generateFaq } from "@/lib/seo/generateFaq";
import { generateGeo } from "@/lib/seo/generateGeo";
import { generateSlug } from "@/lib/seo/generateSlug";
import { travelCategories, type TravelCategory } from "@/lib/travelContent";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type ImportedTravelPost = {
  id: string;
  title: string;
  content: string;
  excerpt: string;
  images: string[];
  publishDate: string;
  slug: string;
  category: TravelCategory;
  fbPostId: string;
  tags: string[];
  location: string;
  seo: {
    title: string;
    description: string;
    h1: string;
    outline: string[];
    faq: Array<{ question: string; answer: string }>;
    schemaTypes: string[];
    geo: ReturnType<typeof generateGeo>;
  };
};

const globalTravelStore = globalThis as typeof globalThis & {
  __fuyunTravelImports?: ImportedTravelPost[];
};

const imports =
  globalTravelStore.__fuyunTravelImports ||
  (globalTravelStore.__fuyunTravelImports = []);

function clean(value: unknown, limit = 2000) {
  return String(value || "")
    .replace(/[<>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, limit);
}

function cleanArray(value: unknown) {
  return Array.isArray(value) ? value.map((item) => clean(item, 180)).filter(Boolean) : [];
}

function inferCategory(tags: string[]): TravelCategory {
  return travelCategories.find((category) => tags.includes(category)) || "旅遊攻略";
}

function buildSeo(title: string, content: string, tags: string[], location: string) {
  const category = inferCategory(tags);
  const seoTitle = `${location || "台灣"}${category}｜${title}`;
  const description = clean(content, 110) || `${title} 包車旅遊攻略，包含車型、行程、FAQ 與旅遊建議。`;

  return {
    title: seoTitle,
    description,
    h1: title,
    outline: ["行程亮點", "適合族群", "推薦景點", "推薦車型", "FAQ"],
    faq: generateFaq(title, category),
    schemaTypes: ["Article", "FAQPage", "BreadcrumbList", "TouristAttraction", "LocalBusiness"],
    geo: generateGeo(title),
  };
}

export async function GET() {
  const persisted = await prisma.article.findMany({ orderBy: { createdAt: "desc" }, take: 50 }).catch(() => []);
  return NextResponse.json({
    success: true,
    source: "小羽旅遊趣 / Facebook Graph API ready",
    auth: envConfig.travelImportApiKey ? "x-api-key required" : "development mode; TRAVEL_IMPORT_API_KEY not configured",
    flow: ["Facebook", "Graph API", "n8n", "GX10 AI", "SEO改寫", "網站發布", "Google收錄", "LINE推播", "詢價", "成交"],
    imports: persisted.length ? persisted : imports,
  });
}

export async function POST(request: Request) {
  try {
    if (envConfig.travelImportApiKey) {
      const apiKey = request.headers.get("x-api-key");
      if (apiKey !== envConfig.travelImportApiKey) {
        return NextResponse.json({ success: false, message: "Invalid x-api-key." }, { status: 401 });
      }
    }

    const body = await request.json();
    const title = clean(body.title, 180);
    const content = clean(body.content, 5000);
    const tags = cleanArray(body.tags);
    const category = clean(body.category, 80);
    const location = clean(body.location, 120);

    if (!title || !content) {
      return NextResponse.json(
        { success: false, message: "title 與 content 為必填。" },
        { status: 400 },
      );
    }

    const allTags = category ? Array.from(new Set([category, ...tags])) : tags;
    const fbPostId = clean(body.fbPostId, 120);
    const slug = generateSlug(fbPostId || title);
    const post: ImportedTravelPost = {
      id: clean(body.id, 80) || `fb-${Date.now()}`,
      title,
      content,
      excerpt: clean(body.excerpt, 300) || clean(content, 140),
      images: cleanArray(body.images),
      publishDate: clean(body.publishDate, 40) || new Date().toISOString(),
      slug,
      category: inferCategory(allTags),
      fbPostId,
      tags: allTags,
      location,
      seo: buildSeo(title, content, allTags, location),
    };

    imports.unshift(post);
    imports.splice(50);
    const requestedStatus = clean(body.status, 20);
    const status = requestedStatus === "published" ? "published" : "draft";
    const persisted = await prisma.article.upsert({
      where: { slug },
      create: {
        slug, title, content, excerpt: post.excerpt, category: post.category, tags: allTags, location,
        seoJson: post.seo, fbPostId: fbPostId || null, status,
        publishedAt: status === "published" ? new Date(post.publishDate) : null,
      },
      update: {
        title, content, excerpt: post.excerpt, category: post.category, tags: allTags, location,
        seoJson: post.seo, status,
        publishedAt: status === "published" ? new Date(post.publishDate) : null,
      },
    });

    return NextResponse.json({
      success: true,
      message: status === "published" ? "Travel post published." : "Travel post draft saved.",
      post: { ...post, status: persisted.status },
      sideEffects: {
        sitemap: "Published articles are included from the Article table.",
        rss: "Published articles are included in RSS.",
        indexNow: envConfig.indexNowKey ? "IndexNow key configured" : "IndexNow disabled until INDEXNOW_KEY is set.",
        linePush: "Reserved for LINE Messaging API after credentials are configured.",
      },
    });
  } catch (error) {
    console.error("Travel import failed", error);
    return NextResponse.json({ success: false, message: "資料解析失敗。" }, { status: 500 });
  }
}
