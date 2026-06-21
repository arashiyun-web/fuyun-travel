import { NextResponse } from "next/server";
import { envConfig } from "@/lib/config/company";
import { SITE } from "@/lib/site";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    success: true,
    enabled: Boolean(envConfig.indexNowKey),
    status: envConfig.indexNowKey ? "IndexNow key configured" : "IndexNow disabled until INDEXNOW_KEY is set.",
  });
}

export async function POST(request: Request) {
  if (!envConfig.indexNowKey) {
    return NextResponse.json(
      { success: false, message: "INDEXNOW_KEY is not configured." },
      { status: 503 },
    );
  }
  const body = await request.json().catch(() => ({}));
  const requested = Array.isArray(body.urls) ? body.urls : [SITE.url];
  const origin = new URL(SITE.url);
  const urls = requested
    .map((value: unknown) => String(value || ""))
    .filter((value: string) => {
      try {
        return new URL(value).host === origin.host;
      } catch {
        return false;
      }
    })
    .slice(0, 10000);
  if (!urls.length) {
    return NextResponse.json({ success: false, message: "No valid site URLs supplied." }, { status: 400 });
  }
  const payload = {
    host: origin.host,
    key: envConfig.indexNowKey,
    keyLocation: `${origin.origin}/indexnow-key.txt`,
    urlList: urls,
  };
  const response = await fetch("https://api.indexnow.org/indexnow", {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  return NextResponse.json(
    { success: response.ok, status: response.status, submitted: urls },
    { status: response.ok ? 200 : 502 },
  );
}
