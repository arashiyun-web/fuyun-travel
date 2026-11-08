import Anthropic from "@anthropic-ai/sdk";

export class CopywriterUnavailableError extends Error {
  constructor() {
    super("尚未設定文案供應商：請設定 GEMINI_API_KEY 與 GEMINI_MODEL，或 ANTHROPIC_API_KEY 與 AI_MODEL_NAME，或 OPENAI_API_KEY 與 OPENAI_MODEL。免費額度與是否永久免費都不保證。");
    this.name = "CopywriterUnavailableError";
  }
}

export type CopyProvider = "gemini" | "anthropic" | "openai";

/** Gemini wins when its pair is set, so the owner can switch to it. Otherwise Anthropic, then OpenAI. */
export function selectedCopyProvider(): CopyProvider {
  if (process.env.GEMINI_API_KEY?.trim() && process.env.GEMINI_MODEL?.trim()) return "gemini";
  if (process.env.ANTHROPIC_API_KEY?.trim() && process.env.AI_MODEL_NAME?.trim()) return "anthropic";
  if (process.env.OPENAI_API_KEY?.trim() && process.env.OPENAI_MODEL?.trim()) return "openai";
  throw new CopywriterUnavailableError();
}

const GEMINI_TIMEOUT_MS = 20_000;

export async function generateCopy(
  input: { system?: string; user: string },
  options?: { fetchImpl?: typeof fetch; timeoutMs?: number },
): Promise<string> {
  const provider = selectedCopyProvider();
  if (provider === "gemini") {
    const model = process.env.GEMINI_MODEL!.trim();
    const apiKey = process.env.GEMINI_API_KEY!.trim();
    const fetchImpl = options?.fetchImpl || fetch;
    const controller = new AbortController();
    const timeoutMs = options?.timeoutMs ?? GEMINI_TIMEOUT_MS;
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          systemInstruction: input.system ? { parts: [{ text: input.system }] } : undefined,
          contents: [{ role: "user", parts: [{ text: input.user }] }],
        }),
        signal: controller.signal,
      });
      const data = (await response.json().catch(() => ({}))) as { candidates?: { content?: { parts?: { text?: string }[] } }[]; error?: { message?: string } };
      if (!response.ok) {
        const message = data.error?.message || `Gemini 回應 ${response.status}`;
        throw new Error(message.includes(apiKey) ? `Gemini 回應 ${response.status}` : message);
      }
      const text = data.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("").trim() || "";
      if (!text) throw new Error("文案供應商沒有回傳內容");
      return text;
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") throw new Error("Gemini 逾時，沒有取得文案");
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }
  if (provider === "anthropic") {
    const client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
      baseURL: process.env.AI_API_BASE || undefined,
      timeout: 300_000,
    });
    const response = await client.messages.create({
      model: process.env.AI_MODEL_NAME!,
      max_tokens: 16000,
      system: input.system,
      messages: [{ role: "user", content: input.user }],
    });
    const text = response.content.find((block): block is Anthropic.TextBlock => block.type === "text")?.text || "";
    if (!text.trim()) throw new Error("文案供應商沒有回傳內容");
    return text.trim();
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL,
      messages: [
        ...(input.system ? [{ role: "system", content: input.system }] : []),
        { role: "user", content: input.user },
      ],
    }),
  });
  const data = (await response.json().catch(() => ({}))) as { choices?: { message?: { content?: string } }[]; error?: { message?: string } };
  if (!response.ok) throw new Error(data.error?.message || `OpenAI 回應 ${response.status}`);
  const text = data.choices?.[0]?.message?.content?.trim() || "";
  if (!text) throw new Error("文案供應商沒有回傳內容");
  return text;
}
