import { NextResponse } from "next/server";
import { verifyAdminToken } from "@/lib/adminAuth";
import { prisma } from "@/lib/prisma";
import { fetchRecentPagePosts } from "@/lib/content-sync/facebookGraph";
import { summarizePostOneLiner } from "@/lib/content-sync/summarize";

export const dynamic = "force-dynamic";

function isAuthorized(request: Request) {
  const authHeader = request.headers.get("authorization");

  // Vercel Cron 觸發：用 CRON_SECRET 驗證（見 vercel.json 的 crons 設定）。
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) return true;

  // 管理員手動觸發（後台按「立即拉取」）：沿用既有 admin token 驗證。
  return !!verifyAdminToken(authHeader);
}

function currentBatchLabel() {
  // ISO 週次當本次批次標籤，例如 2026-W34，同一週重複觸發不會重複造出新批次。
  const now = new Date();
  const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "未授權" }, { status: 401 });
  }

  const result = await fetchRecentPagePosts(7);

  if (!result.configured) {
    return NextResponse.json(
      { success: false, error: result.error, hint: "需要老闆先在 Meta for Developers 建立 Facebook App 並產生粉專 Page Access Token，設定 FACEBOOK_PAGE_ID / FACEBOOK_ACCESS_TOKEN 環境變數" },
      { status: 503 },
    );
  }

  if (result.error) {
    return NextResponse.json({ success: false, error: result.error }, { status: 502 });
  }

  const batchLabel = currentBatchLabel();
  let created = 0;
  let skipped = 0;

  for (const post of result.posts) {
    const existing = await prisma.contentSyncItem.findUnique({ where: { sourcePostId: post.id } });
    if (existing) {
      skipped += 1;
      continue;
    }

    const summary = await summarizePostOneLiner(post.message || "");

    await prisma.contentSyncItem.create({
      data: {
        sourcePostId: post.id,
        sourceType: "page_official",
        authorName: "小羽旅遊趣（粉專）",
        summary,
        postUrl: post.permalink_url,
        postedAt: post.created_time ? new Date(post.created_time) : undefined,
        batchLabel,
        rawPayload: post as unknown as object,
        status: "pending",
      },
    });
    created += 1;
  }

  return NextResponse.json({ success: true, batchLabel, created, skipped, totalFetched: result.posts.length });
}
