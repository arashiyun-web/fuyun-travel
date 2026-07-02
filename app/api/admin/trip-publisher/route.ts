import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { verifyAdminToken } from "@/lib/adminAuth";
import { prisma } from "@/lib/prisma";
import {
  articleTypeToCategory,
  evaluatePublisherChecks,
  schoolPhotoBlocked,
  type TripPublisherInput,
} from "@/lib/tripPublisher";

export const dynamic = "force-dynamic";

function authorized(request: Request) {
  return verifyAdminToken(request.headers.get("authorization"));
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ success: false, error: "未授權" }, { status: 401 });
  }

  const slug = new URL(request.url).searchParams.get("slug")?.trim() || "";
  if (!slug) {
    return NextResponse.json({ success: true, slugState: "available" });
  }

  const article = await prisma.article.findUnique({
    where: { slug },
    select: { status: true },
  });
  const slugState = !article ? "available" : article.status === "published" ? "published" : "draft";
  return NextResponse.json({ success: true, slugState });
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ success: false, error: "未授權" }, { status: 401 });
  }

  let body: { action?: "draft" | "publish"; article?: TripPublisherInput };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "JSON 格式錯誤" }, { status: 400 });
  }

  const input = body.article;
  const action = body.action === "publish" ? "publish" : "draft";
  if (!input?.title?.trim() || !input.slug?.trim() || !input.contentMarkdown?.trim()) {
    return NextResponse.json(
      { success: false, error: "標題、slug 與文章內容為必填。" },
      { status: 400 },
    );
  }

  const existing = await prisma.article.findUnique({
    where: { slug: input.slug },
    select: { status: true },
  });
  const slugState = !existing ? "available" : existing.status === "published" ? "published" : "draft";
  const checks = evaluatePublisherChecks(input, slugState);
  const photoBlocked = schoolPhotoBlocked(input);
  const publishBlocked = checks.some((check) => !check.passed) || photoBlocked;

  if (action === "publish" && publishBlocked) {
    return NextResponse.json(
      {
        success: false,
        error: photoBlocked
          ? "校外教學照片授權尚未確認，禁止發布。不得公開學生正臉照片。"
          : "自動檢查尚未全部通過，禁止發布。",
        checks,
        photoBlocked,
      },
      { status: 422 },
    );
  }

  const publishedAt = action === "publish"
    ? new Date(input.date || Date.now())
    : null;
  const seoJson = {
    seoTitle: input.seoTitle,
    description: input.seoDescription || input.summary,
    coverImage: input.coverImage,
    departure: input.departure,
    destination: input.destination,
    relatedCharterRoute: input.relatedCharterRoute,
    articleType: input.articleType,
    lineUrl: input.lineUrl,
    photoPermissionStatus: input.photoPermissionStatus,
    faq: input.faq,
    socialCopy: input.socialCopy,
    publisherChecks: checks,
  };
  const schemaJson = {
    faq: input.faq,
    relatedCharterRoute: input.relatedCharterRoute,
  };

  const article = await prisma.article.upsert({
    where: { slug: input.slug },
    create: {
      slug: input.slug,
      title: input.title.trim(),
      content: input.contentMarkdown.trim(),
      excerpt: input.summary.trim(),
      category: articleTypeToCategory(input.articleType),
      tags: input.keywords,
      location: input.destination.trim() || "台灣",
      seoJson: seoJson as Prisma.InputJsonValue,
      schemaJson: schemaJson as Prisma.InputJsonValue,
      status: action === "publish" ? "published" : "draft",
      publishedAt,
    },
    update: {
      title: input.title.trim(),
      content: input.contentMarkdown.trim(),
      excerpt: input.summary.trim(),
      category: articleTypeToCategory(input.articleType),
      tags: input.keywords,
      location: input.destination.trim() || "台灣",
      seoJson: seoJson as Prisma.InputJsonValue,
      schemaJson: schemaJson as Prisma.InputJsonValue,
      status: action === "publish" ? "published" : "draft",
      publishedAt,
    },
  });

  return NextResponse.json({
    success: true,
    article: { id: article.id, slug: article.slug, status: article.status },
    checks,
    photoBlocked,
    message: action === "publish" ? "人工審核完成，文章已發布到 /travel。" : "草稿已儲存。",
  });
}
