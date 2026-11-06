import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { CopywriterUnavailableError, generateCopy } from "@/lib/ai/copywriter";
import { verifyAdminToken } from "@/lib/adminAuth";
import { prisma } from "@/lib/prisma";
import { createContentDraft } from "@/lib/operations/store";
import type { OperationsPlatform } from "@/lib/operations/types";
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
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON 格式錯誤" }, { status: 400 });
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
    cover_image_url: body.cover_image_url || "",
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
      { error: "無法連線到 LLM 服務", raw: String(err) },
      { status: 502 },
    );
  }

  const cleaned = stripFences(rawText);
  let generated: GeneratedContent;
  try {
    generated = JSON.parse(cleaned);
  } catch {
    return NextResponse.json(
      { error: "LLM 回傳的 JSON 解析失敗", raw: rawText },
      { status: 502 },
    );
  }

  // Normalise json_ld: model may return an object instead of a string
  if (generated.json_ld && typeof generated.json_ld !== "string") {
    generated.json_ld = JSON.stringify(generated.json_ld, null, 2);
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
  }).catch((error: unknown) => {
    console.error("content draft persist failed", error);
    return null;
  });

  let operationsContentId: string | null = null;
  let operationsError = "";
  const cover = fullInput.cover_image_url || fullInput.image_urls?.[0] || "";
  if (!cover) {
    operationsError = "沒有封面圖，尚未建立營運發布草稿。";
  } else {
    try {
      const imageDataUrl = cover.startsWith("data:") ? cover : await fetch(cover).then(async (response) => {
        if (!response.ok) throw new Error(`封面圖 HTTP ${response.status}`);
        const type = (response.headers.get("content-type") || "image/jpeg").split(";")[0].trim();
        const bytes = Buffer.from(await response.arrayBuffer());
        return `data:${type};base64,${bytes.toString("base64")}`;
      });
      const platforms: OperationsPlatform[] = ["website", "facebook_group", "facebook_page", "instagram", "x"];
      const content = await createContentDraft({
        title: fullInput.trip_title || generated.meta?.trip_title || "未命名行程",
        type: "招生",
        tripDate: new Date().toISOString().slice(0, 10),
        body: fullInput.user_notes || generated.seo_article?.body_markdown || fullInput.trip_title,
        selectedPlatforms: platforms,
        images: [{ dataUrl: imageDataUrl, originalName: "cover.jpg" }],
        captions: {
          website: generated.seo_article?.body_markdown || fullInput.user_notes,
          facebook_group: generated.facebook?.body || "",
          facebook_page: generated.facebook?.body || "",
          instagram: generated.instagram?.caption || "",
          x: (generated.facebook?.body || fullInput.user_notes || "").slice(0, 280),
        },
      });
      operationsContentId = content.id;
    } catch (error) {
      operationsError = error instanceof Error ? error.message : "建立營運發布草稿失敗";
      console.error("operations draft from content factory failed", error);
    }
  }

  return NextResponse.json({ success: true, generated, input: fullInput, draftId: draft?.id || null, operationsContentId, operationsError });
}
