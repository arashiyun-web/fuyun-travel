import { NextResponse } from "next/server";
import { verifyAdminToken } from "@/lib/adminAuth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const ALLOWED_SOURCE_TYPES = ["group_official", "group_whitelist", "group_other"];

function currentBatchLabel() {
  const now = new Date();
  const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

// 社團貼文無法透過 Facebook Graph API 自動讀取（Meta 平台政策限制，見
// lib/content-sync/facebookGraph.ts 開頭說明）。這支路由是備援：老闆自己把
// 想收錄的社團貼文內容手動貼進來，並且親自標註來源身份（只有老闆知道
// 「這則是白名單成員發的」還是「其他成員發的」），不做任何自動判斷。
export async function POST(request: Request) {
  const authResult = verifyAdminToken(request.headers.get("authorization"));
  if (!authResult) return NextResponse.json({ error: "未授權" }, { status: 401 });

  let body: {
    summary: string;
    sourceType: string;
    authorName?: string;
    postUrl?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON 格式錯誤" }, { status: 400 });
  }

  if (!body.summary?.trim()) {
    return NextResponse.json({ error: "缺少貼文內容" }, { status: 400 });
  }

  if (!ALLOWED_SOURCE_TYPES.includes(body.sourceType)) {
    return NextResponse.json(
      { error: `sourceType 必須是 ${ALLOWED_SOURCE_TYPES.join(" / ")} 其中一個` },
      { status: 400 },
    );
  }

  const item = await prisma.contentSyncItem.create({
    data: {
      sourceType: body.sourceType,
      authorName: body.authorName?.trim() || null,
      summary: body.summary.trim(),
      postUrl: body.postUrl?.trim() || null,
      batchLabel: currentBatchLabel(),
      rawPayload: { message: body.summary.trim(), manualSubmit: true },
      status: "pending",
    },
  });

  return NextResponse.json({ success: true, item });
}
