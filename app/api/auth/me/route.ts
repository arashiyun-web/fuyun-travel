import { NextResponse } from "next/server";
import { verifyAdminRequest } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

// Bearer header (older admin pages) or the HttpOnly session cookie (operations page).
export async function GET(request: Request) {
  const user = verifyAdminRequest(request);
  if (!user) {
    return NextResponse.json({ success: false, error: "憑證無效" }, { status: 403 });
  }

  return NextResponse.json({ success: true, user });
}

