import { NextResponse } from "next/server";
import { verifyAdminToken } from "@/lib/adminAuth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = verifyAdminToken(request.headers.get("authorization"));
  if (!user) {
    return NextResponse.json({ success: false, error: "憑證無效" }, { status: 403 });
  }

  try {
    const [inquiries, quotes, jobs] = await Promise.all([
      prisma.inquiry.count(),
      prisma.charterQuote.count(),
      prisma.operationsJob.groupBy({ by: ["status"], _count: { _all: true } }),
    ]);
    const jobCounts = Object.fromEntries(jobs.map((row) => [row.status, row._count._all]));
    const jobTotal = jobs.reduce((sum, row) => sum + row._count._all, 0);
    return NextResponse.json({
      success: true,
      summary: {
        inquiries,
        quotes,
        operationsJobs: jobTotal,
        operationsQueued: (jobCounts.queued || 0) + (jobCounts.scheduled || 0) + (jobCounts.retryable_failed || 0),
        operationsPublished: jobCounts.published || 0,
      },
      details: jobs.map((row) => ({ order_id: row.status, order_status: String(row._count._all), revenue: 0, total_cost: 0, net_profit: 0 })),
    });
  } catch (error) {
    console.error("admin dashboard counts failed", error);
    return NextResponse.json({ success: false, error: "資料庫暫時無法連線" }, { status: 503 });
  }
}
