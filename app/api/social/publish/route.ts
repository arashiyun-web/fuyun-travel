import { NextResponse } from "next/server";
import { verifyAdminToken } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

/** Direct publishing is retired. Approved jobs leave through /admin/operations and the cron worker. */
export async function POST(request: Request) {
  if (!verifyAdminToken(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json(
    { success: false, error: "請到 /admin/operations 核准後，由排程發布。這裡不再直接發文。" },
    { status: 410 },
  );
}
