import { type NextRequest, NextResponse } from "next/server";
import { CopywriterUnavailableError, generateCopy } from "@/lib/ai/copywriter";
import { verifyAdminToken } from "@/lib/adminAuth";
import { createContentDraft } from "@/lib/operations/store";
import { uploadToR2 } from "@/lib/storage/r2";
import type { OperationsPlatform } from "@/lib/operations/types";

export const dynamic = "force-dynamic";

const PLATFORMS: OperationsPlatform[] = ["website", "facebook_group", "facebook_page", "instagram", "x"];

function isAuthorized(request: NextRequest) {
  return Boolean(verifyAdminToken(request.headers.get("authorization")));
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { text?: unknown; location?: unknown; imageBase64?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (typeof body.text !== "string" || !body.text.trim() || typeof body.imageBase64 !== "string" || !body.imageBase64.trim()) {
    return NextResponse.json({ error: "text 與 imageBase64 必填" }, { status: 400 });
  }

  let raw: string;
  try {
    raw = await generateCopy({
      system: "你是台灣旅遊社群小編。只輸出 JSON，不要說明。",
      user: `依下列原文寫五個欄位的繁體中文文案，JSON 鍵為 website, facebook_group, facebook_page, instagram, x。x 必須在 280 字以內。地點：${typeof body.location === "string" ? body.location : ""}\n原文：${body.text.trim()}`,
    });
  } catch (error) {
    const message = error instanceof CopywriterUnavailableError ? error.message : error instanceof Error ? error.message : "文案生成失敗";
    return NextResponse.json({ error: message }, { status: error instanceof CopywriterUnavailableError ? 503 : 502 });
  }

  let captions: Partial<Record<OperationsPlatform, string>> = {};
  try {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    captions = JSON.parse(raw.slice(start, end + 1));
  } catch {
    return NextResponse.json({ error: "文案不是有效 JSON", raw }, { status: 502 });
  }

  const base64 = body.imageBase64.replace(/^data:image\/\w+;base64,/, "");
  const buffer = Buffer.from(base64, "base64");
  const url = await uploadToR2(`social/${Date.now().toString(36)}/post.jpg`, buffer, "image/jpeg");
  if (!url) {
    return NextResponse.json({ error: "圖片需要 R2_PUBLIC_URL 與 R2 帳號設定，否則無法交給粉專或 Instagram 抓取。" }, { status: 503 });
  }

  try {
    const today = new Date().toISOString().slice(0, 10);
    const content = await createContentDraft({
      title: body.text.trim().slice(0, 80),
      type: "回顧",
      tripDate: today,
      body: body.text.trim(),
      selectedPlatforms: PLATFORMS,
      images: [{ dataUrl: body.imageBase64.startsWith("data:") ? body.imageBase64 : `data:image/jpeg;base64,${base64}`, originalName: "upload.jpg" }],
      captions,
    });
    return NextResponse.json({
      success: true,
      operationsContentId: content.id,
      items: PLATFORMS.map((platform) => ({
        platform,
        label: platform,
        caption: content.platforms[platform].caption,
        autoPost: platform !== "facebook_group",
        imageUrl: url,
        imageDataUrl: null,
      })),
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "建立發布草稿失敗" }, { status: 503 });
  }
}
