import { NextRequest, NextResponse } from "next/server";
import { verifyOperationsAdminRequest } from "@/lib/operations/auth";
import { operationsErrorResponse } from "@/lib/operations/http";
import { getContentRecord } from "@/lib/operations/store";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  if (!verifyOperationsAdminRequest(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const content = await getContentRecord(params.id);
    return content ? NextResponse.json({ success: true, content }) : NextResponse.json({ error: "找不到內容" }, { status: 404 });
  } catch (error) {
    return operationsErrorResponse(error, "讀取內容失敗", 500);
  }
}
