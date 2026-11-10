import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { CopywriterUnavailableError, generateCopy } from "@/lib/ai/copywriter";
import { verifyAdminToken } from "@/lib/adminAuth";
import { prisma } from "@/lib/prisma";
import { normalizeGeneratedContent } from "@/lib/content-factory/output";
import { featuredSpotSource, isPublicDraftImage } from "@/lib/content-factory/sources";
import { parseInput } from "@/lib/content-factory/parser";
import { buildSystemPrompt, buildUserMessage } from "@/lib/content-factory/systemPrompt";
import { getLineOaUrl } from "@/lib/config/company";
import type { ContentFactoryInput, GeneratedContent } from "@/lib/content-factory/types";

export const dynamic = "force-dynamic";

function stripFences(raw: string): string {
  // Strip <think>...</think> blocks some models leave in plain text
  let text = raw.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
  // Strip markdown code fences
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) return fenceMatch[1].trim();
  // Extract JSON object if surrounded by prose
  const jsonStart = text.indexOf("{");
  const jsonEnd = text.lastIndexOf("}");
  if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
    return text.slice(jsonStart, jsonEnd + 1).trim();
  }
  return text;
}

export async function POST(request: Request) {
  const authResult = verifyAdminToken(request.headers.get("authorization"));
  if (!authResult) {
    return NextResponse.json({ error: "未授權" }, { status: 401 });
  }

  let body: ContentFactoryInput;
  try {
    const input = await request.json();
    if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Invalid input");
    body = input;
  } catch {
    return NextResponse.json({ error: "JSON 格式錯誤" }, { status: 400 });
  }

  const rawBody = body as ContentFactoryInput & { featured_spot_id?: unknown };
  if ("featured_spot_id" in rawBody) {
    if (typeof rawBody.featured_spot_id !== "string" || !rawBody.featured_spot_id.trim()) {
      return NextResponse.json({ error: "請選擇已發布素材。" }, { status: 400 });
    }
    try {
      const spot = await prisma.featuredSpot.findFirst({ where: { id: rawBody.featured_spot_id, status: "published" } });
      if (!spot) return NextResponse.json({ error: "素材不存在或已取消發布，請重新選擇。" }, { status: 404 });
      const source = featuredSpotSource(spot);
      // Resolve again at generation time. Client edits cannot impersonate published material.
      body = { trip_title: source.title, user_notes: source.description, days: "", season: "", price: "", spots: [], target_audience: "", additional_info: "", image_urls: source.image_urls, cover_image_url: source.cover_image_url, featured_spot_id: source.id };
    } catch {
      return NextResponse.json({ error: "素材暫時無法讀取，請稍後重試。" }, { status: 503 });
    }
  }
  for (const key of ["trip_title", "user_notes", "days", "season", "price", "target_audience", "additional_info", "cover_image_url"] as const) {
    if (body[key] !== undefined && typeof body[key] !== "string") return NextResponse.json({ error: "素材欄位格式錯誤。" }, { status: 400 });
  }
  if (!body.user_notes?.trim() || (body.spots !== undefined && (!Array.isArray(body.spots) || body.spots.some((spot) => typeof spot !== "string")))) {
    return NextResponse.json({ error: "請提供行程描述或已發布素材。" }, { status: 400 });
  }
  if ((body.image_urls !== undefined && (!Array.isArray(body.image_urls) || body.image_urls.some((url) => !isPublicDraftImage(url)))) || (body.cover_image_url && !isPublicDraftImage(body.cover_image_url))) {
    return NextResponse.json({ error: "圖片須為既有 HTTPS 公開網址或 /images/ 站內素材。新圖片公開空間尚待核准。" }, { status: 400 });
  }

  const parsed = parseInput(body.user_notes || "", {
    trip_title: body.trip_title,
    days: body.days,
    season: body.season,
    price: body.price,
    spots: body.spots,
    target_audience: body.target_audience,
    additional_info: body.additional_info,
  });

  const fullInput: ContentFactoryInput = {
    ...parsed,
    image_urls: Array.isArray(body.image_urls) ? body.image_urls : [],
    cover_image_url: body.cover_image_url || body.image_urls?.[0] || "",
    ...(body.featured_spot_id ? { featured_spot_id: body.featured_spot_id } : {}),
  };

  const lineOaUrl = getLineOaUrl() || "https://line.me/R/ti/p/@954fyicw";
  const systemPrompt = buildSystemPrompt(lineOaUrl);
  const userMessage = buildUserMessage(fullInput);

  let rawText = "";
  try {
    rawText = await generateCopy({ system: systemPrompt, user: userMessage });
  } catch (err) {
    if (err instanceof CopywriterUnavailableError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    return NextResponse.json(
      { error: "無法連線到文案供應商，未建立草稿。" },
      { status: 502 },
    );
  }

  const cleaned = stripFences(rawText);
  let generated: GeneratedContent;
  try {
    generated = normalizeGeneratedContent(JSON.parse(cleaned));
  } catch {
    return NextResponse.json(
      { error: "文案供應商回傳格式錯誤，未建立草稿。" },
      { status: 502 },
    );
  }

  // Price safety lock: strip offers from json_ld when price is empty
  if (!fullInput.price && generated.json_ld) {
    try {
      const ld = JSON.parse(generated.json_ld);
      // Remove offers at top level or inside @graph items
      delete ld.offers;
      if (Array.isArray(ld["@graph"])) {
        ld["@graph"] = ld["@graph"].map((item: Record<string, unknown>) => {
          const copy = { ...item };
          delete copy.offers;
          return copy;
        });
      }
      generated.json_ld = JSON.stringify(ld, null, 2);
    } catch {
      // leave as-is if not parseable
    }
  }

  const draft = await prisma.contentDraft.create({
    data: {
      tripTitle: fullInput.trip_title || "未命名行程",
      inputJson: fullInput as unknown as Prisma.InputJsonValue,
      outputJson: generated as unknown as Prisma.InputJsonValue,
      imageUrls: fullInput.image_urls || [],
      coverImageUrl: fullInput.cover_image_url || null,
      status: "draft",
    },
  }).catch(() => null);
  if (!draft) return NextResponse.json({ error: "草稿儲存失敗，請稍後重試。" }, { status: 503 });

  // Generation stops here: no approval, image fetch, operations job, or publication.
  return NextResponse.json({ success: true, generated, input: fullInput, draftId: draft.id });
}
