import { NextResponse } from "next/server";
import { verifyAdminToken } from "@/lib/adminAuth";
import { prisma } from "@/lib/prisma";
import { absoluteUrl } from "@/lib/site";
import type { ContentFactoryInput } from "@/lib/content-factory/types";

export const dynamic = "force-dynamic";

type SelectBody = { itemIds: string[] };

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  const authResult = verifyAdminToken(authHeader);
  if (!authResult) return NextResponse.json({ error: "未授權" }, { status: 401 });

  let body: SelectBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON 格式錯誤" }, { status: 400 });
  }

  if (!Array.isArray(body.itemIds) || body.itemIds.length === 0) {
    return NextResponse.json({ error: "缺少 itemIds" }, { status: 400 });
  }

  const results: Array<{ id: string; success: boolean; error?: string }> = [];

  for (const id of body.itemIds) {
    const item = await prisma.contentSyncItem.findUnique({ where: { id } });
    if (!item) {
      results.push({ id, success: false, error: "找不到這個項目" });
      continue;
    }

    const raw = (item.rawPayload as { message?: string; full_picture?: string } | null) || {};
    const sourceLabel =
      item.sourceType === "page_official" ? "粉專官方貼文"
      : item.sourceType === "group_official" ? "社團官方帳號貼文"
      : item.sourceType === "group_whitelist" ? "社團已授權成員貼文"
      : item.sourceType === "group_other" ? "社團其他成員貼文（僅供選題參考，需重新撰寫）"
      : "手動提交";

    const genInput: ContentFactoryInput = {
      trip_title: item.summary,
      days: "",
      season: "",
      price: "",
      spots: [],
      user_notes: raw.message || item.summary,
      target_audience: "",
      additional_info: `素材來源：${sourceLabel}${item.authorName ? `（${item.authorName}）` : ""}。${
        item.sourceType === "group_other"
          ? "注意：此則來自未授權成員，草稿只能取用地點/主題等事實資訊，內容必須重新撰寫，不得照抄原文或使用原始照片。"
          : ""
      }`,
      image_urls: raw.full_picture ? [raw.full_picture] : [],
      cover_image_url: item.sourceType === "group_other" ? "" : raw.full_picture || "",
    };

    try {
      const generateResponse = await fetch(absoluteUrl("/api/content-factory/generate"), {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: authHeader || "" },
        body: JSON.stringify(genInput),
      });
      const generated = await generateResponse.json();

      if (!generateResponse.ok) {
        results.push({ id, success: false, error: generated.error || "草稿生成失敗" });
        continue;
      }

      const saveResponse = await fetch(absoluteUrl("/api/content-factory/save"), {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: authHeader || "" },
        body: JSON.stringify({ input: genInput, output: generated }),
      });
      const saved = await saveResponse.json();

      if (!saveResponse.ok) {
        results.push({ id, success: false, error: saved.error || "存入審核佇列失敗" });
        continue;
      }

      await prisma.contentSyncItem.update({
        where: { id },
        data: { selected: true, status: "draft_generated", contentDraftId: saved.draft?.id },
      });
      results.push({ id, success: true });
    } catch (error) {
      results.push({ id, success: false, error: String(error) });
    }
  }

  return NextResponse.json({ success: true, results });
}
