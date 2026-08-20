import { NextResponse } from "next/server";
import { verifyAdminToken } from "@/lib/adminAuth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authResult = verifyAdminToken(request.headers.get("authorization"));
  if (!authResult) return NextResponse.json({ error: "未授權" }, { status: 401 });

  const members = await prisma.authorizedGroupMember.findMany({ orderBy: { addedAt: "desc" } });
  return NextResponse.json({ success: true, members });
}

export async function POST(request: Request) {
  const authResult = verifyAdminToken(request.headers.get("authorization"));
  if (!authResult) return NextResponse.json({ error: "未授權" }, { status: 401 });

  let body: { displayName: string; fbIdentifier?: string; note?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON 格式錯誤" }, { status: 400 });
  }

  if (!body.displayName?.trim()) {
    return NextResponse.json({ error: "缺少 displayName（FB 顯示名稱）" }, { status: 400 });
  }

  const member = await prisma.authorizedGroupMember.create({
    data: {
      displayName: body.displayName.trim(),
      fbIdentifier: body.fbIdentifier?.trim() || null,
      note: body.note?.trim() || null,
    },
  });

  return NextResponse.json({ success: true, member });
}

export async function DELETE(request: Request) {
  const authResult = verifyAdminToken(request.headers.get("authorization"));
  if (!authResult) return NextResponse.json({ error: "未授權" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "缺少 id" }, { status: 400 });

  await prisma.authorizedGroupMember.delete({ where: { id } }).catch(() => null);
  return NextResponse.json({ success: true });
}
