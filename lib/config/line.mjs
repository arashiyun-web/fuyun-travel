/**
 * line.mjs — single source for the public LINE Official Account (Node + browser, no deps).
 *
 * The ID is taken from the public site setting (NEXT_PUBLIC_LINE_OA_URL, then the
 * legacy NEXT_PUBLIC_LINE_URL) that already drives the site's LINE buttons, so the
 * quote form, WebMCP tool and captions always point at the same account.
 * Fallback: @954fyicw, the account the public site links to (verified 2026-09-27).
 *
 * URL formats per LINE docs (developers.line.biz, "Using LINE URL scheme"):
 *  - profile / existing chat: https://line.me/R/ti/p/{LINE ID}
 *  - chat with prefilled text: https://line.me/R/oaMessage/{percent-encoded LINE ID}/?{percent-encoded text}
 * The URL scheme works in LINE for iOS/Android only, not LINE for PC.
 */

export const DEFAULT_LINE_OA_ID = "@954fyicw";
const LINE_ID_RE = /^@[a-z0-9._-]{2,40}$/i;

/** Extract "@id" from a line.me profile/chat URL; returns null when not recognisable. */
export function lineOaIdFromUrl(url) {
  const match = /line\.me\/(?:R\/)?(?:ti\/p|oaMessage)\/([^/?#]+)/i.exec(String(url || ""));
  if (!match) return null;
  let id;
  try {
    id = decodeURIComponent(match[1]);
  } catch {
    return null;
  }
  if (!id.startsWith("@")) id = `@${id}`;
  return LINE_ID_RE.test(id) ? id : null;
}

function configuredLineUrl() {
  // Written as literal process.env.NEXT_PUBLIC_* so Next.js inlines them in client bundles.
  try {
    return process.env.NEXT_PUBLIC_LINE_OA_URL || process.env.NEXT_PUBLIC_LINE_URL || "";
  } catch {
    return "";
  }
}

export const LINE_OA_ID = lineOaIdFromUrl(configuredLineUrl()) || DEFAULT_LINE_OA_ID;

export function lineProfileUrl(id = LINE_OA_ID) {
  return `https://line.me/R/ti/p/${encodeURIComponent(id)}`;
}

/** Official prefill URL; falls back to the profile URL when there is no text. */
export function lineOaMessageUrl(message, id = LINE_OA_ID) {
  const text = String(message ?? "").trim();
  if (!text) return lineProfileUrl(id);
  return `https://line.me/R/oaMessage/${encodeURIComponent(id)}/?${encodeURIComponent(text)}`;
}
