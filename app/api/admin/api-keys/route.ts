import { createHash, randomBytes } from "crypto";
import type { ApiKey } from "@prisma/client";
import { NextResponse } from "next/server";
import { unauthorized, verifyAdminMutation, verifyAdminRequest } from "@/lib/adminQuoteAuth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
const HEADERS = { "Cache-Control": "no-store" };
const KEY_FIELDS = { id: true, name: true, keyPrefix: true, createdAt: true, disabledAt: true, lastUsedAt: true } as const;
type Metadata = Pick<ApiKey, keyof typeof KEY_FIELDS>;
function metadata(key: Metadata) {
  return { id: key.id, name: key.name, keyPrefix: key.keyPrefix,
    createdAt: key.createdAt, disabledAt: key.disabledAt, lastUsedAt: key.lastUsedAt };
}

export async function GET(request: Request) {
  if (!verifyAdminRequest(request)) return unauthorized();
  try {
    const keys = await prisma.apiKey.findMany({ select: KEY_FIELDS, orderBy: { createdAt: "desc" } });
    const now = Date.now();
    const minute = new Date(Math.floor(now / 60_000) * 60_000);
    const offset = 8 * 3_600_000;
    const day = new Date(Math.floor((now + offset) / 86_400_000) * 86_400_000 - offset);
    const counters = keys.length === 0 ? [] : await prisma.apiRateCounter.findMany({
      where: { apiKeyId: { in: keys.map(key => key.id) }, OR: [
        { scope: "minute", windowStart: minute }, { scope: "day", windowStart: day },
      ] }, select: { apiKeyId: true, scope: true, count: true },
    });
    const usage = new Map(counters.map(counter => [`${counter.apiKeyId}:${counter.scope}`, counter.count]));
    return NextResponse.json({ success: true, keys: keys.map(key => ({ ...metadata(key), usage: {
      minute: usage.get(`${key.id}:minute`) ?? 0, day: usage.get(`${key.id}:day`) ?? 0,
    } })) }, { headers: HEADERS });
  } catch {
    return NextResponse.json({ success: false, error: "金鑰與用量讀取失敗，請稍後重試。" }, { status: 503, headers: HEADERS });
  }
}

export async function POST(request: Request) {
  if (!verifyAdminMutation(request)) return unauthorized();
  const body: unknown = await request.json().catch(() => null);
  const name = body && typeof body === "object" && !Array.isArray(body) && Object.keys(body).length === 1 && "name" in body
    ? body.name : null;
  if (typeof name !== "string" || name.trim().length === 0 || name.trim().length > 100 || /[\u0000-\u001f\u007f]/.test(name)) {
    return NextResponse.json({ success: false, error: "name：請輸入 1–100 字的金鑰名稱。" }, { status: 400, headers: HEADERS });
  }
  try {
    const plaintextKey = `fyk_${randomBytes(32).toString("base64url")}`;
    const key = await prisma.apiKey.create({ select: KEY_FIELDS, data: {
      name: name.trim(), keyPrefix: plaintextKey.slice(0, 12),
      keyHash: createHash("sha256").update(plaintextKey).digest("hex"),
    } });
    return NextResponse.json({ success: true, key: metadata(key), plaintextKey }, { headers: HEADERS });
  } catch {
    return NextResponse.json({ success: false, error: "金鑰建立失敗，請稍後重試。" }, { status: 503, headers: HEADERS });
  }
}
