import { prisma } from "@/lib/prisma";

export type LineSource = { type?: string | null; userId?: string | null };

/** Only a signed DM user id is a member identity. Group and room sources are ignored. */
export function lineMemberUid(source: LineSource | null | undefined) {
  if (!source || source.type !== "user") return "";
  const uid = (source.userId || "").trim();
  if (!uid || uid.length > 160) return "";
  return uid;
}

/**
 * Records the LINE user id from a verified DM webhook. Does not copy name, phone, or email,
 * and does not backfill old quotes.
 */
export async function rememberLineMember(lineUid: string) {
  const uid = lineUid.trim();
  if (!uid || uid.length > 160) return { status: "ignored" as const };
  const existing = await prisma.lineUser.findUnique({ where: { lineUid: uid }, select: { id: true } });
  if (existing) {
    await prisma.lineUser.update({ where: { id: existing.id }, data: { updatedAt: new Date() } });
    return { status: "existing" as const, id: existing.id };
  }
  const created = await prisma.lineUser.create({
    data: { lineUid: uid, tags: [], name: null, phone: null, email: null },
    select: { id: true },
  });
  return { status: "created" as const, id: created.id };
}
