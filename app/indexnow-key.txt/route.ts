import { envConfig } from "@/lib/config/company";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!envConfig.indexNowKey) {
    return new Response("Not configured", { status: 404 });
  }
  return new Response(envConfig.indexNowKey, {
    headers: {"Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=300"},
  });
}
