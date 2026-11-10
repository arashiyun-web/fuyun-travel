export type PublishOutlet = "native" | "postiz";
export type PostizSocialPlatform = "facebook_page" | "instagram" | "x";

export const POSTIZ_SOCIAL_PLATFORMS: PostizSocialPlatform[] = ["facebook_page", "instagram", "x"];

const INTEGRATION_ENV: Record<PostizSocialPlatform, string> = {
  facebook_page: "POSTIZ_FACEBOOK_INTEGRATION_ID",
  instagram: "POSTIZ_INSTAGRAM_INTEGRATION_ID",
  x: "POSTIZ_X_INTEGRATION_ID",
};

export function publishOutlet(): PublishOutlet | null {
  const value = process.env.PUBLISH_OUTLET;
  if (value === "native" || value === "postiz") return value;
  return null;
}

export function isPostizSocialPlatform(platform: string): platform is PostizSocialPlatform {
  return (POSTIZ_SOCIAL_PLATFORMS as string[]).includes(platform);
}

export function postizSettings() {
  const integrations = {
    facebook_page: process.env.POSTIZ_FACEBOOK_INTEGRATION_ID?.trim() || "",
    instagram: process.env.POSTIZ_INSTAGRAM_INTEGRATION_ID?.trim() || "",
    x: process.env.POSTIZ_X_INTEGRATION_ID?.trim() || "",
  };
  const missing = [
    process.env.POSTIZ_API_URL?.trim() ? "" : "POSTIZ_API_URL",
    process.env.POSTIZ_API_KEY?.trim() ? "" : "POSTIZ_API_KEY",
    integrations.facebook_page ? "" : INTEGRATION_ENV.facebook_page,
    integrations.instagram ? "" : INTEGRATION_ENV.instagram,
    integrations.x ? "" : INTEGRATION_ENV.x,
  ].filter(Boolean);
  return {
    apiUrl: process.env.POSTIZ_API_URL?.trim() || "",
    apiKey: process.env.POSTIZ_API_KEY?.trim() || "",
    integrations,
    missing,
    ready: missing.length === 0,
  };
}
