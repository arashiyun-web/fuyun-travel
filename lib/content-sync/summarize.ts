// 用 GX10（本機/內網部署的 AI，敏感資料不外流）把貼文原文摘成一行地點/主題摘要，
// 供每週清單頁快速掃視用。呼叫方式沿用 lib/social/captionGenerator.ts 的既有模式。

export async function summarizePostOneLiner(rawText: string): Promise<string> {
  const text = rawText.trim();
  if (!text) return "（無文字內容）";

  if (!process.env.GX10_AI_API_URL) {
    // GX10 未設定時不擋流程，直接截斷原文當摘要，讓清單頁仍可用。
    return text.length > 40 ? `${text.slice(0, 40)}…` : text;
  }

  try {
    const response = await fetch(`${process.env.GX10_AI_API_URL}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(process.env.GX10_AI_API_KEY ? { Authorization: `Bearer ${process.env.GX10_AI_API_KEY}` } : {}),
      },
      body: JSON.stringify({
        model: process.env.GX10_MODEL,
        messages: [
          {
            role: "user",
            content: `把以下貼文內容摘成一行繁體中文摘要（地點/主題為主，20字以內，不要加標點以外的裝飾）：\n\n${text}`,
          },
        ],
      }),
    });
    const data: { choices?: Array<{ message?: { content?: string } }> } = await response.json();
    const summary = data.choices?.[0]?.message?.content?.trim();
    return summary || (text.length > 40 ? `${text.slice(0, 40)}…` : text);
  } catch {
    return text.length > 40 ? `${text.slice(0, 40)}…` : text;
  }
}
