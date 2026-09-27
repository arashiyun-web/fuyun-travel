import { NextRequest, NextResponse } from "next/server";
import { verifyOperationsWorkerRequest } from "@/lib/operations/auth";
import { operationsErrorResponse } from "@/lib/operations/http";
import { runDueJobs } from "@/lib/operations/store";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!verifyOperationsWorkerRequest(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    return NextResponse.json({ success: true, results: await runDueJobs() });
  } catch (error) {
    return operationsErrorResponse(error, "處理到期工作失敗", 500);
  }
}
