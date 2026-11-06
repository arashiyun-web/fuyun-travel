import Anthropic from "@anthropic-ai/sdk";

export class CopywriterUnavailableError extends Error {
  constructor() {
    super("尚未設定文案供應商：請設定 ANTHROPIC_API_KEY 與 AI_MODEL_NAME，或 OPENAI_API_KEY 與 OPENAI_MODEL。");
    this.name = "CopywriterUnavailableError";
  }
}

export type CopyProvider = "anthropic" | "openai";

/** Which configured provider will be used. Throws when neither pair is complete. */
export function selectedCopyProvider(): CopyProvider {
  if (process.env.ANTHROPIC_API_KEY?.trim() && process.env.AI_MODEL_NAME?.trim()) return "anthropic";
  if (process.env.OPENAI_API_KEY?.trim() && process.env.OPENAI_MODEL?.trim()) return "openai";
  throw new CopywriterUnavailableError();
}

export async function generateCopy(input: { system?: string; user: string }): Promise<string> {
  const provider = selectedCopyProvider();
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
