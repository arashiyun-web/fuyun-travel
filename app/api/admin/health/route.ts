import { NextResponse } from "next/server";
import { publishingHealth } from "@/lib/admin/publishingHealth";
import { verifyAdminToken } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!verifyAdminToken(request.headers.get("authorization"))) {
    return NextResponse.json({ success: false, error: "未授權" }, { status: 401 });
  }
  return NextResponse.json({ success: true, features: publishingHealth() });
}
