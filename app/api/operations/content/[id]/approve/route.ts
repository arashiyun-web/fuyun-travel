import { NextRequest, NextResponse } from "next/server";
import { verifyOperationsAdminRequest } from "@/lib/operations/auth";
import { verifyAdminMutationRequest } from "@/lib/adminAuth";
import { approveContent } from "@/lib/operations/store";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  if (!verifyAdminMutationRequest(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = (await request.json().catch(() => ({}))) as { scheduledAt?: unknown };
    const scheduledAt = typeof body.scheduledAt === "string" && body.scheduledAt ? body.scheduledAt : null;
    const content = await approveContent(params.id, "operations-owner", scheduledAt);
    return NextResponse.json({ success: true, content });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "核准失敗" }, { status: 400 });
  }
}
