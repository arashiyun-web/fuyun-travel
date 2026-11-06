import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { verifyAdminToken } from "@/lib/adminAuth";
import { prisma } from "@/lib/prisma";
import type { ContentFactoryInput, GeneratedContent } from "@/lib/content-factory/types";

export const dynamic = "force-dynamic";

function toDraft(row: { id: string; inputJson: unknown; outputJson: unknown; status: string; createdAt: Date }) {
  return {
    id: row.id,
    input: row.inputJson as ContentFactoryInput,
    output: row.outputJson as GeneratedContent,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function GET(request: Request) {
  if (!verifyAdminToken(request.headers.get("authorization"))) return NextResponse.json({ error: "未授權" }, { status: 401 });
  const rows = await prisma.contentDraft.findMany({ orderBy: { createdAt: "desc" }, take: 100 });
  return NextResponse.json({ success: true, drafts: rows.map(toDraft) });
}

export async function POST(request: Request) {
  if (!verifyAdminToken(request.headers.get("authorization"))) return NextResponse.json({ error: "未授權" }, { status: 401 });

  let body: { input: ContentFactoryInput; output: GeneratedContent };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON 格式錯誤" }, { status: 400 });
  }
  if (!body.input || !body.output) {
    return NextResponse.json({ error: "缺少 input 或 output 欄位" }, { status: 400 });
  }

  const draft = await prisma.contentDraft.create({
    data: {
      tripTitle: body.input.trip_title || "未命名行程",
      inputJson: body.input as unknown as Prisma.InputJsonValue,
      outputJson: body.output as unknown as Prisma.InputJsonValue,
      imageUrls: Array.isArray(body.input.image_urls) ? body.input.image_urls : [],
      coverImageUrl: body.input.cover_image_url || null,
      status: "draft",
    },
  });

  return NextResponse.json({
    success: true,
    draft: toDraft(draft),
    warning: body.input.cover_image_url ? undefined : "未上傳封面圖片。文案已存入 content_drafts，發布草稿仍需要圖片。",
  });
}

export async function PATCH(request: Request) {
  if (!verifyAdminToken(request.headers.get("authorization"))) return NextResponse.json({ error: "未授權" }, { status: 401 });
  let body: { id: string; status: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON 格式錯誤" }, { status: 400 });
  }
  const draft = await prisma.contentDraft.findUnique({ where: { id: body.id } });
  if (!draft) return NextResponse.json({ error: "找不到草稿" }, { status: 404 });
  if (body.status !== "draft" && body.status !== "reviewing") {
    return NextResponse.json({ error: "草稿不能標成已核准或已發布。請到 /admin/operations 核准。" }, { status: 409 });
  }
  if (body.status === "reviewing" && !draft.coverImageUrl) {
    return NextResponse.json({ error: "封面圖片未上傳，不可進入審核狀態" }, { status: 422 });
  }
  const updated = await prisma.contentDraft.update({ where: { id: body.id }, data: { status: body.status } });
  return NextResponse.json({ success: true, draft: toDraft(updated) });
}
