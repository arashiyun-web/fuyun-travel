import { NextResponse } from "next/server";
import { envConfig } from "@/lib/config/company";
import { SITE } from "@/lib/site";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    success: true,
    enabled: Boolean(envConfig.indexNowKey),
    status: envConfig.indexNowKey ? "IndexNow key configured" : "IndexNow is ready but disabled until INDEXNOW_KEY is set.",
  });
}

export async function POST(request: Request) {
  if (!envConfig.indexNowKey) {
    return NextResponse.json(
      { success: false, message: "INDEXNOW_KEY is not configured; submission is disabled by default." },
      { status: 503 },
    );
  }

  const body = await request.json().catch(() => ({}));
  const urls = Array.isArray(body.urls) ? body.urls : [SITE.url];

  return NextResponse.json({
    success: true,
    message: "IndexNow submission payload prepared.",
    payload: {
      host: new URL(SITE.url).host,
      key: envConfig.indexNowKey,
      urlList: urls,
    },
  });
}
