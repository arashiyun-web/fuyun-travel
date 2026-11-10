import { NextResponse } from "next/server";
import { verifyOperationsWorkerRequest } from "@/lib/operations/auth";
import { sendFridayHighlightsReminder } from "@/lib/operations/fridayReminder";

export const dynamic = "force-dynamic";

async function run(request: Request) {
  if (!verifyOperationsWorkerRequest(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const result = await sendFridayHighlightsReminder();
  return NextResponse.json(result, { status: !result.sent && result.reason === "delivery_failed" ? 502 : 200 });
}

export const GET = run;
export const POST = run;
