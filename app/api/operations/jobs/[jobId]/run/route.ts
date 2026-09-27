import { NextRequest, NextResponse } from "next/server";
import { verifyOperationsAdminRequest } from "@/lib/operations/auth";
import { verifyAdminMutationRequest } from "@/lib/adminAuth";
import { runJob } from "@/lib/operations/store";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, { params }: { params: { jobId: string } }) {
  if (!verifyAdminMutationRequest(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as { mode?: unknown };
  const mode = body.mode === "live" ? "live" : "dry-run";
  const result = await runJob(params.jobId, mode);
  return NextResponse.json(result, { status: result.status === "not_claimed" ? 409 : 200 });
}
