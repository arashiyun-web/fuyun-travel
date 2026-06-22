import { COMPANY } from "@/lib/config/company";

export interface PlatformCaption {
  platform: string;
  label: string;
  caption: string;
  autoPost: boolean;
}

const PLATFORM_PROMPTS: Record<string, { label: string; rule: string; autoPost: boolean }> = {
  facebook: {
    label: "Facebook",
    rule: "完整版貼文，含 2-3 個 emoji，結尾加聯絡電話與 LINE，3-5 個 hashtag。可含連結。",
    autoPost: true,
  },
  instagram: {
    label: "Instagram",
    rule: "精簡開頭 2-3 句，重點放 hashtag，產生 20-30 個相關 hashtag。不要外部連結。",
    autoPost: true,
  },
  x: {
    label: "X (Twitter)",
    rule: "280 字以內，口語化，1-2 個 hashtag，可含短連結。",
    autoPost: true,
  },
  tiktok: {
    label: "抖音 / TikTok",
    rule: "15 字內標題黨開頭，有梗、年輕化，3-5 個話題標籤（#）。",
    autoPost: false,
  },
  xiaohongshu: {
    label: "小紅書",
    rule: "emoji 分段，種草語氣，用「姐妹們」「絕了」「私藏」等詞，標題黨，分點呈現，5-8 個標籤。",
    autoPost: false,
  },
};

async function callAI(prompt: string): Promise<string> {
  if (process.env.GX10_AI_API_URL) {
    try {
      const response = await fetch(`${process.env.GX10_AI_API_URL}/api/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(process.env.GX10_AI_API_KEY ? { Authorization: `Bearer ${process.env.GX10_AI_API_KEY}` } : {}),
        },
        body: JSON.stringify({
          model: process.env.GX10_MODEL,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      const data: unknown = await response.json();
      if (typeof data === "object" && data !== null) {
        const record = data as {
          message?: { content?: string };
          choices?: { message?: { content?: string } }[];
        };
        return record.message?.content || record.choices?.[0]?.message?.content || "";
      }
    } catch {
      // Fall back to the next provider.
    }
  }

  if (process.env.OPENAI_API_KEY) {
    try {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: process.env.OPENAI_MODEL,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      const data: unknown = await response.json();
      if (typeof data === "object" && data !== null) {
        const record = data as { choices?: { message?: { content?: string } }[] };
        return record.choices?.[0]?.message?.content || "";
      }
    } catch {
      // Final fallback is handled by the caller.
    }
  }

  return "";
}

export async function generateCaptions(raw: {
  text: string;
  location?: string;
}): Promise<PlatformCaption[]> {
  return Promise.all(
    Object.entries(PLATFORM_PROMPTS).map(async ([platform, config]) => {
      const prompt = `你是台灣旅遊社群小編，為「${COMPANY.brand}」（包車旅遊）撰寫貼文。
平台：${config.label}
規則：${config.rule}
聯絡電話：${COMPANY.phone}
LINE：${COMPANY.line}
原始內容：${raw.text}
${raw.location ? `地點：${raw.location}` : ""}
請直接輸出貼文內容，不要任何說明文字。`;

      const generated = await callAI(prompt);
      const caption = generated.trim() || `${raw.text}\n\n電話：${COMPANY.phone}\nLINE：${COMPANY.line}\n${COMPANY.brand}`;

      return {
        platform,
        label: config.label,
        caption,
        autoPost: config.autoPost,
      };
    }),
  );
}
