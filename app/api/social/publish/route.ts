import { type NextRequest, NextResponse } from "next/server";
import { publishToFacebook, publishToInstagram, publishToX } from "@/lib/social/publishers";
import { verifyAdminToken } from "@/lib/adminAuth";

const AUTO_PLATFORMS = ["facebook", "instagram", "x"] as const;
type AutoPlatform = (typeof AUTO_PLATFORMS)[number];

interface PublishBody {
  platform?: unknown;
  caption?: unknown;
  imageUrl?: unknown;
}

function isAuthorized(request: NextRequest) {
  return Boolean(verifyAdminToken(request.headers.get("authorization")));
}

function parseBody(body: PublishBody) {
  if (typeof body.platform !== "string" || !AUTO_PLATFORMS.includes(body.platform as AutoPlatform)) {
    return { error: "platform must be facebook, instagram, or x" };
  }

  if (typeof body.caption !== "string" || !body.caption.trim()) {
    return { error: "caption is required" };
  }

  return {
    value: {
      platform: body.platform as AutoPlatform,
      caption: body.caption.trim(),
      imageUrl: typeof body.imageUrl === "string" ? body.imageUrl.trim() : "",
    },
  };
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let parsed;
  try {
    parsed = parseBody((await request.json()) as PublishBody);
  } catch (error) {
    return NextResponse.json({ error: "Invalid JSON", detail: String(error) }, { status: 400 });
  }

  if (parsed.error || !parsed.value) {
    return NextResponse.json({ error: "Invalid body", detail: parsed.error }, { status: 400 });
  }

  const { platform, caption, imageUrl } = parsed.value;
  let result;

  if (platform === "facebook") {
    if (!imageUrl) {
      return NextResponse.json({ error: "FB 需要 imageUrl" }, { status: 400 });
    }
    result = await publishToFacebook({ caption, imageUrl });
  } else if (platform === "instagram") {
    if (!imageUrl) {
      return NextResponse.json({ error: "IG 需要 imageUrl" }, { status: 400 });
    }
    result = await publishToInstagram({ caption, imageUrl });
  } else {
    result = await publishToX({ caption });
  }

  return NextResponse.json(result, { status: result.success ? 200 : 502 });
}
