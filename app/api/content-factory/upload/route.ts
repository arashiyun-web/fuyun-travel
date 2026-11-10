import { NextResponse } from "next/server";
import { verifyAdminToken } from "@/lib/adminAuth";
import { uploadToR2 } from "@/lib/storage/r2";

export const dynamic = "force-dynamic";

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export async function POST(request: Request) {
  const authResult = verifyAdminToken(request.headers.get("authorization"));
  if (!authResult) {
    return NextResponse.json({ error: "未授權" }, { status: 401 });
  }
  if (!process.env.R2_PUBLIC_URL?.trim()) {
    return NextResponse.json({ error: "新圖片的公開儲存網址尚待核准，暫停上傳。請先使用已發布素材的既有圖片。" }, { status: 503 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "表單解析失敗" }, { status: 400 });
  }

  const file = formData.get("image") as File | null;
  if (!file || typeof file.arrayBuffer !== "function") {
    return NextResponse.json({ error: "未收到圖片" }, { status: 400 });
  }

  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json({ error: "僅支援 JPG / PNG / WebP / GIF" }, { status: 400 });
  }

  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: "圖片超過 10 MB 上限" }, { status: 400 });
  }

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const key = `content-drafts/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const url = await uploadToR2(key, buffer, file.type);
  if (!url) {
    return NextResponse.json({ error: "R2 上傳失敗。請確認 R2 帳號與 R2_PUBLIC_URL。" }, { status: 503 });
  }
  return NextResponse.json({ url });
}
