import { NextResponse } from "next/server";
import { verifyAdminRequest } from "@/lib/adminAuth";
import { diagnoseInstagramAuthorization } from "@/lib/social/insta-diag";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Admin-only Instagram connection status: field names/statuses and state only, never values or tokens. */
export async function GET(request: Request) {
  if (!verifyAdminRequest(request)) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  const result = await diagnoseInstagramAuthorization();
  return NextResponse.json({
    success: true,
    state: result.state,
    expiresAt: result.expiresAt ?? null,
    fields: result.config.fields.map((field) => ({ field: field.field, status: field.status, note: field.note })),
    livePublishEnabled: process.env.OPERATIONS_LIVE_PUBLISH_ENABLED === "true",
  });
}
