import { NextRequest, NextResponse } from "next/server";
import { verifyOperationsAdminRequest } from "@/lib/operations/auth";
import { verifyAdminMutationRequest } from "@/lib/adminAuth";
import { createContentDraft, getOperationsLimits, getOperationsStorageInfo, listContentRecords } from "@/lib/operations/store";
import { CONTENT_TYPES, OPERATIONS_PLATFORMS, type ContentType, type OperationsPlatform } from "@/lib/operations/types";

export const dynamic = "force-dynamic";

function authorized(request: NextRequest) {
  return verifyOperationsAdminRequest(request);
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const storage = getOperationsStorageInfo();
  if (storage.mode === "database_unavailable") return NextResponse.json({ error: "正式持久化尚未配置完成", storage }, { status: 503 });
  return NextResponse.json({ success: true, contents: await listContentRecords(), limits: getOperationsLimits(), storage });
}

export async function POST(request: NextRequest) {
  if (!verifyAdminMutationRequest(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const storage = getOperationsStorageInfo();
  if (storage.mode === "database_unavailable") return NextResponse.json({ error: "正式持久化尚未配置完成，未建立草稿", storage }, { status: 503 });
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const type = body.type;
    const selectedPlatforms = Array.isArray(body.selectedPlatforms)
      ? Array.from(new Set(body.selectedPlatforms.filter((item): item is OperationsPlatform => typeof item === "string" && OPERATIONS_PLATFORMS.includes(item as OperationsPlatform))))
      : [];
    const images = Array.isArray(body.images)
      ? body.images
          .filter((item): item is { dataUrl: string; originalName?: string } => Boolean(item && typeof item === "object" && typeof (item as { dataUrl?: unknown }).dataUrl === "string"))
          .map((item) => ({ dataUrl: item.dataUrl, originalName: typeof item.originalName === "string" ? item.originalName : undefined }))
      : [];
    const publicImageUrls = Array.isArray(body.publicImageUrls)
      ? body.publicImageUrls.filter((url): url is string => typeof url === "string" && url.startsWith("https://")).slice(0, images.length)
      : [];
    if (typeof body.title !== "string" || typeof body.body !== "string" || typeof body.tripDate !== "string") {
      return NextResponse.json({ error: "標題、日期與行程文字必填" }, { status: 400 });
    }
    if (!CONTENT_TYPES.includes(type as ContentType)) return NextResponse.json({ error: "type 必須是招生或回顧" }, { status: 400 });
    const content = await createContentDraft({
      title: body.title,
      type: type as ContentType,
      tripDate: body.tripDate,
      body: body.body,
      selectedPlatforms,
      images,
      publicImageUrls,
    });
    return NextResponse.json({ success: true, content }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "建立草稿失敗" }, { status: 400 });
  }
}
