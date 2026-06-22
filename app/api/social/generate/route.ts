import { type NextRequest, NextResponse } from "next/server";
import { generateCaptions } from "@/lib/social/captionGenerator";
import { resizeAll } from "@/lib/social/imageResize";
import { uploadToR2 } from "@/lib/storage/r2";
import { verifyAdminToken } from "@/lib/adminAuth";

interface GenerateBody {
  text?: unknown;
  location?: unknown;
  imageBase64?: unknown;
}

function isAuthorized(request: NextRequest) {
  return Boolean(verifyAdminToken(request.headers.get("authorization")));
}

function parseBody(body: GenerateBody) {
  if (typeof body.text !== "string" || !body.text.trim()) {
    return { error: "text is required" };
  }

  if (typeof body.imageBase64 !== "string" || !body.imageBase64.trim()) {
    return { error: "imageBase64 is required" };
  }

  return {
    value: {
      text: body.text.trim(),
      location: typeof body.location === "string" ? body.location.trim() : "",
      imageBase64: body.imageBase64,
    },
  };
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let parsed;
  try {
    parsed = parseBody((await request.json()) as GenerateBody);
  } catch (error) {
    return NextResponse.json({ error: "Invalid JSON", detail: String(error) }, { status: 400 });
  }

  if (parsed.error || !parsed.value) {
    return NextResponse.json({ error: "Invalid body", detail: parsed.error }, { status: 400 });
  }

  try {
    const base64 = parsed.value.imageBase64.replace(/^data:image\/\w+;base64,/, "");
    const inputBuffer = Buffer.from(base64, "base64");

    const [captions, images] = await Promise.all([
      generateCaptions({ text: parsed.value.text, location: parsed.value.location }),
      resizeAll(inputBuffer),
    ]);

    const stamp = Date.now().toString(36);
    const uploaded = await Promise.all(
      images.map(async (image) => {
        const key = `social/${stamp}/${image.platform}.jpg`;
        const url = await uploadToR2(key, image.buffer, "image/jpeg");
        return {
          platform: image.platform,
          label: image.label,
          url,
          dataUrl: url ? null : `data:image/jpeg;base64,${image.buffer.toString("base64")}`,
        };
      }),
    );

    const items = captions.map((caption) => {
      const imageKey = caption.platform === "instagram" ? "instagram_post" : caption.platform;
      const image =
        uploaded.find((item) => item.platform === imageKey) ||
        uploaded.find((item) => item.platform === caption.platform);

      return {
        platform: caption.platform,
        label: caption.label,
        caption: caption.caption,
        autoPost: caption.autoPost,
        imageUrl: image?.url || null,
        imageDataUrl: image?.dataUrl || null,
      };
    });

    return NextResponse.json({ success: true, items, allImages: uploaded }, { status: 200 });
  } catch (error) {
    console.error("[social/generate] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
