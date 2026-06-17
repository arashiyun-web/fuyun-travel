import { NextResponse } from "next/server";
import { verifyAdminToken } from "@/lib/adminAuth";
import { parseInput } from "@/lib/content-factory/parser";
import { buildSystemPrompt, buildUserMessage } from "@/lib/content-factory/systemPrompt";
import { getLineOaUrl } from "@/lib/config/company";
import type { ContentFactoryInput, GeneratedContent } from "@/lib/content-factory/types";

export const dynamic = "force-dynamic";

function stripFences(raw: string): string {
  // Strip qwen3 <think>...</think> blocks
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

  const modelName = process.env.AI_MODEL_NAME;
  const apiBase = process.env.AI_API_BASE;
  const apiKey = process.env.AI_API_KEY || "placeholder";

  if (!modelName || !apiBase) {
    return NextResponse.json(
      { error: "AI_MODEL_NAME 或 AI_API_BASE 環境變數未設定" },
      { status: 503 },
    );
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
    const llmResponse = await fetch(`${apiBase}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: modelName,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        stream: false,
        temperature: 0.7,
        options: { num_ctx: 8192 },
      }),
      signal: AbortSignal.timeout(300_000),
    });

    if (!llmResponse.ok) {
      const errText = await llmResponse.text().catch(() => "");
      return NextResponse.json(
        { error: `LLM 回應錯誤 ${llmResponse.status}`, raw: errText },
        { status: 502 },
      );
    }

    const llmData = await llmResponse.json();
    rawText =
      llmData?.choices?.[0]?.message?.content ||
      llmData?.response ||
      "";
  } catch (err) {
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

  return NextResponse.json({ success: true, generated, input: fullInput });
}
