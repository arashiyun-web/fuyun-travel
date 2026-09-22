import { NextResponse } from "next/server";
import { verifyAdminRequest } from "@/lib/adminAuth";
import {
  INSTAGRAM_OAUTH_STATE_COOKIE,
  buildInstagramAuthorizationUrl,
  createInstagramOAuthState,
  readInstagramOAuthConfig,
} from "@/lib/social/instagram-oauth";
import { logInstaDiagnostic } from "@/lib/social/insta-diag";

export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!verifyAdminRequest(request)) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  try {
    const config = readInstagramOAuthConfig();
    const { state, cookieValue } = createInstagramOAuthState(config);
    const response = NextResponse.redirect(buildInstagramAuthorizationUrl(config, state));
    response.cookies.set({
      name: INSTAGRAM_OAUTH_STATE_COOKIE,
      value: cookieValue,
      httpOnly: true,
      sameSite: "lax",
      secure: new URL(request.url).protocol === "https:",
      path: "/api/social/instagram/oauth",
      maxAge: 10 * 60,
    });
    return response;
  } catch {
    // Same log-safe, rate-limited diagnostic as the callback 503 path.
    logInstaDiagnostic();
    return NextResponse.json({ success: false, error: "Instagram OAuth 安全設定未完成" }, { status: 503 });
  }
}
