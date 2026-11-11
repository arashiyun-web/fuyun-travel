import type { FeaturedSpot } from "@prisma/client";

/** Preserve existing public assets without downloading or rehosting them. */
export function isPublicDraftImage(value: unknown): value is string {
  if (typeof value !== "string" || value !== value.trim() || /[\\\s\u0000-\u001f]/.test(value)) return false;
  // Fleet photos are first-party static assets, same as /images/.
  // Allowing /fleet/ keeps drafts consistent with existing site-path rules;
  // article markdown still uses https://fuyuntravel.com absolute URLs.
  if (value.startsWith("/images/") || value.startsWith("/fleet/")) {
    try {
      const decoded = decodeURIComponent(value);
      return !decoded.includes("..") && !/[\\?#\u0000-\u001f]/.test(decoded);
    } catch { return false; }
  }
  try {
    const url = new URL(value);
    return url.protocol === "https:" && Boolean(url.hostname) && !url.username && !url.password;
  } catch { return false; }
}

export function featuredSpotSource(spot: Pick<FeaturedSpot, "id" | "title" | "description" | "photoUrl" | "photoUrls">) {
  const image_urls = Array.from(new Set([spot.photoUrl, ...spot.photoUrls].filter(isPublicDraftImage)));
  return { id: spot.id, title: spot.title, description: spot.description, image_urls, cover_image_url: image_urls[0] || "" };
}
