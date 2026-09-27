import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { verifyAdminMutationRequest, verifyAdminRequest as verifyAdminSession } from "@/lib/adminAuth";

/**
 * Quote / analytics admin API authorisation.
 * - Admin session: HttpOnly session cookie or admin JWT bearer (same verifier as the rest of /admin).
 * - Automation: ADMIN_ACCESS_TOKEN, accepted only in the Authorization header (constant-time).
 * Tokens in the URL query (?admin_token=) are no longer accepted: URLs end up in history,
 * bookmarks and request logs.
 */
function automationBearer(request: Request) {
  const configured = process.env.ADMIN_ACCESS_TOKEN?.trim() || "";
  const auth = request.headers.get("authorization") || "";
  const supplied = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!configured || !supplied) return false;
  const a = Buffer.from(configured);
  const b = Buffer.from(supplied);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function verifyAdminRequest(request: Request) {
  return Boolean(verifyAdminSession(request)) || automationBearer(request);
}

/** State changes: cookie sessions must be same-origin; bearer callers are not cookie-driven. */
export function verifyAdminMutation(request: Request) {
  return Boolean(verifyAdminMutationRequest(request)) || automationBearer(request);
}

export function unauthorized() {
  return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
}
