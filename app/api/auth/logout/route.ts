import { NextResponse } from "next/server";
import { ADMIN_COOKIE_NAME, adminCookieOptions, isSameOriginRequest } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

/** Clear the admin session cookie. Bearer tokens held by pages expire on their own (12 h). */
export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  const response = NextResponse.json({ success: true });
  response.cookies.set(ADMIN_COOKIE_NAME, "", { ...adminCookieOptions(request), maxAge: 0 });
  return response;
}
