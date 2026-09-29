import { NextResponse } from "next/server";
import { INSTAGRAM_OAUTH_STATE_COOKIE, InstagramOAuthError, exchangeInstagramAuthorizationCode, readInstagramOAuthConfig, saveInstagramLoginToken, verifyInstagramOAuthState } from "@/lib/social/instagram-oauth";
import { logInstaDiagnostic } from "@/lib/social/insta-diag";
import { requeueAwaitingAuth } from "@/lib/operations/store";

export const runtime = "nodejs";

function clearStateCookie(response: NextResponse, request: Request) {
  response.cookies.set({
    name: INSTAGRAM_OAUTH_STATE_COOKIE,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: new URL(request.url).protocol === "https:",
    path: "/api/social/instagram/oauth",
    maxAge: 0,
  });
  return response;
}

function result(request: Request, payload: Record<string, unknown>, status: number) {
  return clearStateCookie(NextResponse.json(payload, { status }), request);
}

export async function GET(request: Request) {
  let config;
  try {
    config = readInstagramOAuthConfig();
  } catch {
    // Emit the log-safe, rate-limited diagnostic so the Owner can see WHICH
    // field blocks (field name + status only). Never included in the response.
    logInstaDiagnostic();
    return NextResponse.json({ success: false, error: "Instagram OAuth 安全設定未完成" }, { status: 503 });
  }

  const url = new URL(request.url);
  const state = url.searchParams.get("state");
  const cookieValue = request.headers.get("cookie")?.split(";").map((item) => item.trim())
    .find((item) => item.startsWith(`${INSTAGRAM_OAUTH_STATE_COOKIE}=`))?.slice(INSTAGRAM_OAUTH_STATE_COOKIE.length + 1) || null;
  try {
    verifyInstagramOAuthState(state, cookieValue, config);
  } catch {
    return result(request, { success: false, error: "Instagram OAuth state 無效或已過期" }, 403);
  }

  if (url.searchParams.get("error") || url.searchParams.get("error_reason")) {
    return result(request, { success: false, error: "Instagram 授權未完成" }, 400);
  }
  const code = url.searchParams.get("code");
  if (!code) return result(request, { success: false, error: "Instagram OAuth 回呼缺少必要資料" }, 400);

  try {
    const token = await exchangeInstagramAuthorizationCode(config, code);
    await saveInstagramLoginToken(config, token);
    // Jobs parked for missing/revoked authorization become due again; the approval hash still binds
    // them to their approved account, so a different account invalidates them at claim time.
    const requeued = await requeueAwaitingAuth("instagram").catch((error) => {
      console.error("instagram oauth: requeue of awaiting_auth jobs failed", { error: String(error).slice(0, 200) });
      return 0;
    });
    return result(request, {
      success: true,
      status: "authorized_token_stored",
      accountId: token.accountId,
      expiresAt: token.expiresAt,
      scopes: token.scopes,
      requeuedJobs: requeued,
      note: "Token 已加密保存；未回傳 token。",
    }, 200);
  } catch (error) {
    const kind = error instanceof InstagramOAuthError ? error.kind : "provider";
    if (kind === "storage" || kind === "configuration") {
      return result(request, { success: false, error: "Instagram 授權結果無法安全保存" }, 503);
    }
    return result(request, { success: false, error: "Instagram OAuth 交換失敗，請由擁有者重新操作" }, 502);
  }
}
