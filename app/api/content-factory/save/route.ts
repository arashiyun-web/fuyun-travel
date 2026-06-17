import { NextResponse } from "next/server";
import { verifyAdminToken } from "@/lib/adminAuth";
import type { ContentDraftItem } from "@/lib/content-factory/types";

export const dynamic = "force-dynamic";

const store = globalThis as typeof globalThis & {
  __contentDrafts?: ContentDraftItem[];
};
const drafts: ContentDraftItem[] =
  store.__contentDrafts || (store.__contentDrafts = []);

export async function GET(request: Request) {
  const authResult = verifyAdminToken(request.headers.get("authorization"));
  if (!authResult) return NextResponse.json({ error: "未授權" }, { status: 401 });
  return NextResponse.json({ success: true, drafts });
}

export async function POST(request: Request) {
  const authResult = verifyAdminToken(request.headers.get("authorization"));
  if (!authResult) return NextResponse.json({ error: "未授權" }, { status: 401 });

  let body: { input: ContentDraftItem["input"]; output: ContentDraftItem["output"] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON 格式錯誤" }, { status: 400 });
  }

  if (!body.input || !body.output) {
    return NextResponse.json({ error: "缺少 input 或 output 欄位" }, { status: 400 });
  }

  const hasCover = !!(body.input.cover_image_url);
  const status: ContentDraftItem["status"] = hasCover ? "draft" : "draft";

  const draft: ContentDraftItem = {
    id: `cf-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    input: body.input,
    output: body.output,
    status,
    createdAt: new Date().toISOString(),
  };

  drafts.unshift(draft);
  drafts.splice(100);

  return NextResponse.json({
    success: true,
    draft,
    warning: !hasCover ? "未上傳封面圖片，草稿無法進入 ready 狀態" : undefined,
  });
}

export async function PATCH(request: Request) {
  const authResult = verifyAdminToken(request.headers.get("authorization"));
  if (!authResult) return NextResponse.json({ error: "未授權" }, { status: 401 });

  let body: { id: string; status: ContentDraftItem["status"] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON 格式錯誤" }, { status: 400 });
  }

  const draft = drafts.find((d) => d.id === body.id);
  if (!draft) return NextResponse.json({ error: "找不到草稿" }, { status: 404 });

  if (body.status === "ready" && !draft.input.cover_image_url) {
    return NextResponse.json(
      { error: "封面圖片未上傳，不可進入 ready 狀態" },
      { status: 422 },
    );
  }

  draft.status = body.status;
  return NextResponse.json({ success: true, draft });
}
