import { NextRequest, NextResponse } from "next/server";
import { verifyAdminMutationRequest } from "@/lib/adminAuth";
import { recordFacebookManualResult } from "@/lib/operations/store";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, { params }: { params: { jobId: string } }) {
  if (!verifyAdminMutationRequest(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as { externalId?: unknown; postUrl?: unknown };
  if (typeof body.externalId !== "string" || typeof body.postUrl !== "string") {
    return NextResponse.json({ error: "請填入外部 ID 與貼文網址" }, { status: 400 });
  }
  try {
    const result = await recordFacebookManualResult(params.jobId, body.externalId, body.postUrl);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "人工回填失敗" }, { status: 400 });
  }
}
