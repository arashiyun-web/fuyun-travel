import { NextRequest, NextResponse } from "next/server";
import { verifyOperationsAdminRequest } from "@/lib/operations/auth";
import { operationsErrorResponse } from "@/lib/operations/http";
import { readImage } from "@/lib/operations/store";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: { id: string; fileName: string } }) {
  if (!verifyOperationsAdminRequest(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const image = await readImage(params.id, params.fileName);
    if (!image) return NextResponse.json({ error: "找不到圖片" }, { status: 404 });
    return new NextResponse(new Uint8Array(image.buffer), { headers: { "Content-Type": image.contentType, "Cache-Control": "private, max-age=60" } });
  } catch (error) {
    return operationsErrorResponse(error, "讀取圖片失敗", 500);
  }
}
