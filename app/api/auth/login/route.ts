import { NextResponse } from "next/server";
import { createAdminToken, isAdminAuthConfigured, validateAdminCredentials } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isAdminAuthConfigured()) {
    return NextResponse.json({ success: false, error: "管理員安全設定未完成" }, { status: 503 });
  }

  const body = await request.json().catch(() => ({}));
  if (!validateAdminCredentials(body.username, body.password)) {
    return NextResponse.json({ success: false, error: "帳號密碼錯誤" }, { status: 401 });
  }

  try {
    return NextResponse.json({ success: true, token: createAdminToken() });
  } catch {
    return NextResponse.json({ success: false, error: "管理員安全設定未完成" }, { status: 503 });
  }
}
