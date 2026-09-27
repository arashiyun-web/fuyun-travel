import { readFile } from "fs/promises";
import { NextRequest, NextResponse } from "next/server";
import { verifyOperationsAdminRequest } from "@/lib/operations/auth";
import { getImageContentType, getImagePath } from "@/lib/operations/store";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: { id: string; fileName: string } }) {
  if (!verifyOperationsAdminRequest(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const imagePath = await getImagePath(params.id, params.fileName);
  if (!imagePath) return NextResponse.json({ error: "找不到圖片" }, { status: 404 });
  try {
    const buffer = await readFile(imagePath);
    return new NextResponse(buffer, { headers: { "Content-Type": getImageContentType(params.fileName), "Cache-Control": "private, max-age=60" } });
  } catch {
    return NextResponse.json({ error: "讀取圖片失敗" }, { status: 404 });
  }
}
