import { NextResponse } from "next/server";
import { verifyAdminMutationRequest } from "@/lib/adminAuth";
import { clearStoredInstagramLoginTokenFromEnvironment } from "@/lib/social/instagram-oauth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!verifyAdminMutationRequest(request)) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  try {
    const cleared = await clearStoredInstagramLoginTokenFromEnvironment();
    return NextResponse.json({
      success: true,
      localTokenCleared: cleared,
      providerRevocationRequired: true,
      note: "僅清除本機加密 token；Meta 端撤銷需由擁有者依官方流程處理。",
    });
  } catch {
    return NextResponse.json({ success: false, error: "本機 token 無法安全清除" }, { status: 503 });
  }
}
