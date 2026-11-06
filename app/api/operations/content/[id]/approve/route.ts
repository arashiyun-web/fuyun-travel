import { NextRequest, NextResponse } from "next/server";
import { verifyAdminMutationRequest } from "@/lib/adminAuth";
import { operationsErrorResponse } from "@/lib/operations/http";
import { OPERATIONS_OWNER_APPROVER } from "@/lib/operations/approvalGate";
import { approveContent } from "@/lib/operations/store";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  if (!verifyAdminMutationRequest(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = (await request.json().catch(() => ({}))) as { scheduledAt?: unknown; acknowledgeFactWarnings?: unknown };
    const scheduledAt = typeof body.scheduledAt === "string" && body.scheduledAt ? body.scheduledAt : null;
    const content = await approveContent(params.id, OPERATIONS_OWNER_APPROVER, scheduledAt, body.acknowledgeFactWarnings === true);
    return NextResponse.json({ success: true, content });
  } catch (error) {
    return operationsErrorResponse(error, "核准失敗");
  }
}
