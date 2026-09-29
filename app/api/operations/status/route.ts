import { NextResponse } from "next/server";
import { verifyAdminRequest } from "@/lib/adminAuth";
import { FACEBOOK_GROUP_URL, resolveInstagramAccountId } from "@/lib/operations/shared";
import { diagnoseInstagramAuthorization } from "@/lib/social/insta-diag";
import { SITE } from "@/lib/site";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** What the deployment will actually do with approved, due jobs. Names/states only, never secret values. */
export async function GET(request: Request) {
  if (!verifyAdminRequest(request)) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  const live = process.env.OPERATIONS_LIVE_PUBLISH_ENABLED === "true";
  const instagram = await diagnoseInstagramAuthorization().catch(() => null);
  return NextResponse.json({
    success: true,
    mode: live ? "live" : "dry-run",
    persistence: process.env.OPERATIONS_PERSISTENCE_MODE || "unset",
    website: { automatic: true, target: `${(process.env.NEXT_PUBLIC_SITE_URL?.trim() || SITE.url).replace(/\/$/, "")}/travel` },
    instagram: {
      automatic: process.env.OPERATIONS_INSTAGRAM_V2_ENABLED === "true",
      authState: instagram?.state ?? "unknown",
      expiresAt: instagram?.expiresAt ?? null,
      accountId: (await resolveInstagramAccountId()) || null,
      apiVersionSet: Boolean(process.env.INSTAGRAM_LOGIN_API_VERSION?.trim()),
      mediaOriginSet: Boolean(process.env.INSTAGRAM_LOGIN_MEDIA_ORIGIN?.trim()),
    },
    facebookGroup: { automatic: false, target: FACEBOOK_GROUP_URL, reason: "Meta 已移除社團發文 API；需老闆在社團正常介面發布後回填網址。" },
  });
}
