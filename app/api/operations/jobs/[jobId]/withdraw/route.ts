import { NextRequest, NextResponse } from "next/server";
import { verifyAdminMutationRequest } from "@/lib/adminAuth";
import { operationsErrorResponse } from "@/lib/operations/http";
import { withdrawWebsiteJob } from "@/lib/operations/store";

export const dynamic = "force-dynamic";

/** Take a published website article down (admin, same-origin cookie or bearer). */
export async function POST(request: NextRequest, { params }: { params: { jobId: string } }) {
  const admin = verifyAdminMutationRequest(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const result = await withdrawWebsiteJob(params.jobId, admin.username);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return operationsErrorResponse(error, "官網下架失敗");
  }
}
