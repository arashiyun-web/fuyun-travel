import { NextResponse } from "next/server";
import { travelCategories, type TravelCategory } from "@/lib/travelContent";

export const dynamic = "force-dynamic";

type ImportedTravelPost = {
  id: string;
  title: string;
  content: string;
  images: string[];
  publishDate: string;
  tags: string[];
  location: string;
  seo: {
    title: string;
    description: string;
    h1: string;
    outline: string[];
    faq: Array<{ question: string; answer: string }>;
    schemaTypes: string[];
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
    outline: ["行程亮點", "適合族群", "推薦車型", "包車安排建議", "FAQ"],
    faq: [
      {
        question: `${title} 適合包車旅遊嗎？`,
        answer: "適合。可依人數選擇九人座、中巴或遊覽車，並依停靠點調整行程節奏。",
      },
      {
        question: "詢價時需要提供哪些資料？",
        answer: "建議提供日期、人數、上車地點、目的地、停靠點、行李與特殊需求。",
      },
    ],
    schemaTypes: ["Article", "FAQPage", "BreadcrumbList", "TouristAttraction", "LocalBusiness"],
  };
}

export async function GET() {
  return NextResponse.json({
    success: true,
    source: "小羽旅遊趣 / Facebook Graph API ready",
    flow: ["Facebook", "Graph API", "n8n", "GX10 AI", "SEO文章生成", "網站發布", "Google Index", "LINE推播", "詢價", "成交"],
    imports,
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const title = clean(body.title, 180);
    const content = clean(body.content, 5000);
    const tags = cleanArray(body.tags);
    const location = clean(body.location, 120);

    if (!title || !content) {
      return NextResponse.json(
        { success: false, message: "title 與 content 為必填。" },
        { status: 400 },
      );
    }

    const post: ImportedTravelPost = {
      id: clean(body.id, 80) || `fb-${Date.now()}`,
      title,
      content,
      images: cleanArray(body.images),
      publishDate: clean(body.publishDate, 40) || new Date().toISOString(),
      tags,
      location,
      seo: buildSeo(title, content, tags, location),
    };

    imports.unshift(post);
    imports.splice(50);

    return NextResponse.json({
      success: true,
      message: "Travel post imported and SEO/AEO/GEO draft generated.",
      post,
    });
  } catch {
    return NextResponse.json({ success: false, message: "資料解析失敗。" }, { status: 500 });
  }
}
