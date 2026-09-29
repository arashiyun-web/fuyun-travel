/**
 * Photos and source links of a synced/submitted post, so every photo reaches /highlights.
 *
 * rawPayload may carry photos as:
 *   - images: string[]            (manual submit, multi-photo)
 *   - full_picture: string        (Facebook Graph cover / legacy single photo)
 *   - attachments.data[].media.image.src and .subattachments.data[].media.image.src (Graph album posts)
 */
export const MAX_PHOTOS = 10;

type GraphMedia = { media?: { image?: { src?: unknown } } };
type GraphAttachment = GraphMedia & { subattachments?: { data?: GraphMedia[] } };

function isAllowedPhoto(url: string) {
  if (url.startsWith("/images/")) return !url.includes("..");
  try {
    return new URL(url).protocol === "https:";
  } catch {
    return false;
  }
}

export function cleanPhotoUrls(list: unknown[]): string[] {
  const out: string[] = [];
  for (const item of list) {
    if (typeof item !== "string") continue;
    const url = item.trim();
    if (!url || !isAllowedPhoto(url) || out.includes(url)) continue;
    out.push(url);
    if (out.length === MAX_PHOTOS) break;
  }
  return out;
}

export function collectPhotoUrls(raw: unknown): string[] {
  if (!raw || typeof raw !== "object") return [];
  const payload = raw as { images?: unknown; full_picture?: unknown; attachments?: { data?: unknown } };
  const found: unknown[] = [];
  if (Array.isArray(payload.images)) found.push(...payload.images);
  found.push(payload.full_picture);
  const attachments = payload.attachments && Array.isArray(payload.attachments.data) ? (payload.attachments.data as GraphAttachment[]) : [];
  for (const attachment of attachments) {
    found.push(attachment?.media?.image?.src);
    const subs = Array.isArray(attachment?.subattachments?.data) ? attachment.subattachments!.data! : [];
    for (const sub of subs) found.push(sub?.media?.image?.src);
  }
  return cleanPhotoUrls(found);
}

/** Admin-chosen cover first, then explicitly given photos, then the source post's remaining photos. */
export function mergePhotoUrls(cover: string | undefined, given: unknown[], sourcePayload: unknown): string[] {
  return cleanPhotoUrls([cover, ...given, ...collectPhotoUrls(sourcePayload)]);
}

export function cleanSourceUrl(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}
