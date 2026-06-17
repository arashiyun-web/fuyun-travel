import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type AiTestRequest = {
  message?: unknown;
};

const CHARTER_PATTERN = /(包車|遊覽車|來回|單程|接送|機場|行李|幾人|人數|出發|目的地|\d+\s*人)/;

function normalizeMessage(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function handleTravelQuery(message: string) {
  if (!message) {
    return "請輸入想查詢的行程問題，例如：恩愛農場多少錢、鼻頭角步道後面是什麼、想看櫻花。";
  }

  if (CHARTER_PATTERN.test(message)) {
    return "此需求屬於包車報價，不能用行程團費估算。請提供日期、人數、出發地、目的地、單程或來回、行李數量，客服會協助確認正式報價。";
  }

  if (message.includes("恩愛農場")) {
    return "桃園復興行程：恩愛農場 → 北橫之星 → 巴陵橋。含便當。費用：車資+保險+便當+門票 799 元。";
  }

  if (message.includes("太平山")) {
    return "宜蘭行程：太平山國家森林風景區 → 見晴懷古步道 → 鳩之澤溫泉。可代訂便當100元。費用：車資+保險 400 元。早班出發。";
  }

  if (message.includes("鹿港")) {
    return "彰化行程：鹿港三輪車遊 → 台灣優格餅乾學院 → 彰化扇形車站 → 忠權3D社區 → 北極宮 → 台塑生醫。午餐自理。費用：車資+保險+三輪車 599 元。";
  }

  if (message.includes("鼻頭角") && /後面|之後|下一站/.test(message)) {
    return "鼻頭角步道後一站可能是象鼻岩，依行程版本不同也可能接鼻頭國小。建議以實際報名行程為準。";
  }

  if (message.includes("鼻頭角")) {
    return "鼻頭角相關行程可安排鼻頭角步道、象鼻岩、南雅奇岩等景點。深澳鐵道自行車票通常另計，請以實際團體行程為準。";
  }

  if (message.includes("櫻花")) {
    return "推薦賞櫻行程：三芝天元宮、武陵農場、恩愛農場。若要搭配包車，請提供日期、人數與出發地。";
  }

  if (message.includes("溫泉") || message.includes("泡湯")) {
    return "推薦溫泉行程：太平山鳩之澤溫泉、關子嶺泥漿溫泉。部分泡湯或門票費用需自理，請以正式行程公告為準。";
  }

  return "很抱歉，目前沒有找到相關行程。您可以試試搜尋「恩愛農場」、「太平山」、「鼻頭角步道」或「鹿港」。";
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as AiTestRequest;
    const message = normalizeMessage(body.message);
    return NextResponse.json({ reply: handleTravelQuery(message) });
  } catch {
    return NextResponse.json({ reply: "請輸入正確的 JSON 格式，例如 { \"message\": \"恩愛農場多少錢\" }。" }, { status: 400 });
  }
}
