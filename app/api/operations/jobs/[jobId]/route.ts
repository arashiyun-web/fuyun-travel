import { NextRequest, NextResponse } from "next/server";
import { verifyOperationsAdminRequest } from "@/lib/operations/auth";
import { operationsErrorResponse } from "@/lib/operations/http";
import { getJob } from "@/lib/operations/store";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: { jobId: string } }) {
  if (!verifyOperationsAdminRequest(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const result = await getJob(params.jobId);
    return result ? NextResponse.json({ success: true, ...result }) : NextResponse.json({ error: "找不到發布工作" }, { status: 404 });
  } catch (error) {
    return operationsErrorResponse(error, "讀取工作失敗", 500);
  }
}
