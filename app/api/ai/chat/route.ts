import { NextResponse } from "next/server";
import { recordAiConversation } from "@/lib/ai-conversation";

export const dynamic = "force-dynamic";

type ChatType = "customer" | "internal" | "quote" | "travel";

function clean(value: unknown, limit = 2000) {
  return String(value || "")
    .replace(/[<>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, limit);
}

function chatType(value: unknown): ChatType {
  const type = clean(value, 40);
  if (["customer", "internal", "quote", "travel"].includes(type)) return type as ChatType;
  return "customer";
}

function replyText(data: unknown) {
  if (!data || typeof data !== "object") return "";
  const record = data as Record<string, unknown>;
  const value = [record.reply, record.answer, record.message, record.content, record.text].find(
    (item) => typeof item === "string" && item.trim(),
  );
  return typeof value === "string" ? value : "";
}

export async function POST(request: Request) {
  const aiApiUrl = process.env.NEXT_PUBLIC_AI_API_URL;
  const aiApiKey = process.env.FUYUN_AI_API_KEY;

  if (!aiApiUrl || !aiApiKey) {
    return NextResponse.json({ success: false, error: "AI API is not configured" }, { status: 500 });
  }

  const body = await request.json().catch(() => ({}));
  const message = clean(body.message);

  if (!message) {
    return NextResponse.json({ success: false, error: "請輸入訊息。" }, { status: 400 });
  }

  try {
    const type = chatType(body.type);
    const response = await fetch(`${aiApiUrl.replace(/\/$/, "")}/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": aiApiKey,
      },
      body: JSON.stringify({
        message,
        type,
      }),
      signal: AbortSignal.timeout(300000),
    });

    const data = await response.json().catch(() => ({}));
    const reply = replyText(data);

    if (reply) {
      try {
        await recordAiConversation({
          sessionId: clean(body.sessionId, 160) || null,
          source: clean(body.source, 80) || `ai-chat-${type}`,
          userId: clean(body.userId, 160) || null,
          query: message,
          reply,
          status: response.ok ? "answered" : "upstream_error",
        });
      } catch (error) {
        console.error("Failed to record AI conversation", error);
      }
    }

    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("AI API request failed:", error);
    return NextResponse.json({ success: false, error: "AI 客服暫時無法回應。" }, { status: 502 });
  }
}
