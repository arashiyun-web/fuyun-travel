import { NextResponse } from "next/server";
import { ADMIN_COOKIE_NAME, adminCookieOptions, createAdminToken, isAdminAuthConfigured, validateAdminCredentials } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

// Best-effort throttle per server instance (serverless instances do not share it).
const WINDOW_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 10;
const attempts = new Map<string, { count: number; resetAt: number }>();

function clientKey(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip") || "unknown";
}

const MAX_TRACKED_KEYS = 5000;

function isThrottled(key: string, now: number) {
  if (attempts.size > MAX_TRACKED_KEYS) {
    attempts.forEach((v, k) => {
      if (v.resetAt <= now) attempts.delete(k);
    });
    if (attempts.size > MAX_TRACKED_KEYS) attempts.clear();
  }
  const entry = attempts.get(key);
  if (!entry || entry.resetAt <= now) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  entry.count += 1;
  return entry.count > MAX_ATTEMPTS;
}

export async function POST(request: Request) {
  if (!isAdminAuthConfigured()) {
    return NextResponse.json({ success: false, error: "管理員安全設定未完成" }, { status: 503 });
  }

  const key = clientKey(request);
  if (isThrottled(key, Date.now())) {
    return NextResponse.json({ success: false, error: "嘗試次數過多，請稍後再試" }, { status: 429 });
  }

  const body = await request.json().catch(() => ({}));
  if (!(await validateAdminCredentials(body.username, body.password))) {
    return NextResponse.json({ success: false, error: "帳號密碼錯誤" }, { status: 401 });
  }

  attempts.delete(key);
  try {
    const token = createAdminToken();
    // Bearer token for the existing admin pages, plus an HttpOnly session cookie so browser
    // navigations (e.g. the Instagram OAuth start redirect) are authenticated too.
    const response = NextResponse.json({ success: true, token });
    response.cookies.set(ADMIN_COOKIE_NAME, token, adminCookieOptions(request));
    return response;
  } catch {
    return NextResponse.json({ success: false, error: "管理員安全設定未完成" }, { status: 503 });
  }
}
