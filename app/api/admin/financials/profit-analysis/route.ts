import { NextResponse } from "next/server";
import { verifyAdminToken } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = verifyAdminToken(request.headers.get("authorization"));
  if (!user) {
    return NextResponse.json({ success: false, error: "憑證無效" }, { status: 403 });
  }

  return NextResponse.json({
    success: true,
    summary: {
      total_revenue: 0,
      total_cost: 0,
      total_net_profit: 0,
      overall_profit_margin: 0,
    },
    details: [],
  });
}

