import { NextResponse } from "next/server";
import { readPublicTravelImage } from "@/lib/operations/websiteStore";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Permanent public URL for an image of a published operations article. Drafts and unpublished articles
 * return 404; the short cache keeps a takedown effective within a minute.
 */
export async function GET(_request: Request, { params }: { params: { slug: string; n: string } }) {
  try {
    const image = await readPublicTravelImage(params.slug, params.n);
    if (!image) return new NextResponse("Not found", { status: 404 });
    return new NextResponse(new Uint8Array(image.buffer), {
      headers: {
        "content-type": image.contentType,
        "cache-control": "public, max-age=60, s-maxage=60",
        "x-content-type-options": "nosniff",
      },
    });
  } catch {
    return new NextResponse("Unavailable", { status: 503 });
  }
}
