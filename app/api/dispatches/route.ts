import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const sp = new URL(req.url).searchParams;
  const date = sp.get("date");       // 可選：10/11、2026-10-11、10月11日
  const limit = Math.min(parseInt(sp.get("limit") || "50", 10), 200);

  try {
    const where: Record<string, unknown> = {};

    if (date) {
      // 容納 10/11、2026-10-11、10月11日
      const normalized = date
        .replace(/(\d{4})-(\d{1,2})-(\d{1,2})/, (_m, y, mo, d) => `${mo}/${d}`)
        .replace(/(\d{1,2})月(\d{1,2})日/, (_m, mo, d) => `${mo}/${d}`)
        .replace(/^(\d{1,2})\/(\d{1,2})$/, (_m, mo, d) =>
          `${new Date().getMonth() + 1 === parseInt(mo) ? "" : ""}${mo}/${d}`
        );
      where.tripDate = normalized.trim();
    }

    const rows = await prisma.dispatchOrder.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return NextResponse.json({
      ok: true,
      count: rows.length,
      trips: rows.map((r) => ({
        id: r.id,
        日期: r.tripDate,
        時間: r.tripTime,
        車牌: r.licensePlate,
        司機: r.driverName,
        電話: r.driverPhone,
        目的地: r.destination,
        群組: r.groupId,
        原句: r.rawText,
        時間戳: r.createdAt.toISOString(),
      })),
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
