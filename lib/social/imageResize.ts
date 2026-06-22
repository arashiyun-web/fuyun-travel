import sharp from "sharp";

export interface PlatformSize {
  platform: string;
  width: number;
  height: number;
  label: string;
}

export interface ResizedImage {
  platform: string;
  label: string;
  buffer: Buffer;
}

export const PLATFORM_SIZES: PlatformSize[] = [
  { platform: "facebook", width: 1200, height: 630, label: "Facebook 貼文" },
  { platform: "instagram_post", width: 1080, height: 1080, label: "Instagram 貼文" },
  { platform: "instagram_story", width: 1080, height: 1920, label: "Instagram 限動" },
  { platform: "x", width: 1200, height: 675, label: "X (Twitter)" },
  { platform: "tiktok", width: 1080, height: 1920, label: "抖音 / TikTok" },
  { platform: "xiaohongshu", width: 1080, height: 1440, label: "小紅書" },
];

export async function resizeForPlatform(input: Buffer, size: PlatformSize): Promise<Buffer> {
  return sharp(input)
    .resize(size.width, size.height, { fit: "cover", position: "center" })
    .jpeg({ quality: 88 })
    .toBuffer();
}

export async function resizeAll(input: Buffer): Promise<ResizedImage[]> {
  return Promise.all(
    PLATFORM_SIZES.map(async (size) => ({
      platform: size.platform,
      label: size.label,
      buffer: await resizeForPlatform(input, size),
    })),
  );
}
