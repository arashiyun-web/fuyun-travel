import { NextResponse } from "next/server";
import { createAdminToken, validateAdminCredentials } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  if (validateAdminCredentials(body.username, body.password)) {
    return NextResponse.json({ success: true, token: createAdminToken() });
  }

  return NextResponse.json({ success: false, error: "帳號密碼錯誤" }, { status: 401 });
}

