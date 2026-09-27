import { NextRequest, NextResponse } from "next/server";
import { verifyOperationsWorkerRequest } from "@/lib/operations/auth";
import { runDueJobs } from "@/lib/operations/store";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!verifyOperationsWorkerRequest(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const result = await runDueJobs();
  return NextResponse.json({ success: true, results: result });
}
