/**
 * Server-side, opt-in Instagram Login adapter. Not wired into the live worker.
 * No Facebook Page token fallback. No automatic retries or success from HTTP 200 alone.
 * The caller MUST persist an immutable approval + submission intent and hold a job lease
 * before calling publishContainer. An uncertain result must be reconciled, never resent.
 * Official reference (read 2026-09-22):
 * https://developers.facebook.com/documentation/instagram-platform/content-publishing
 */

export type InstagramV2Config = {
  accountId: string;
  accessToken: string;
  apiVersion: string;
  mediaOrigins: string[];
};

export type InstagramV2ErrorKind = "configuration" | "input" | "authorization" | "rejected" | "unknown";

export class InstagramV2Error extends Error {
  readonly kind: InstagramV2ErrorKind;
  readonly mayHaveSucceeded: boolean;
  readonly automaticRetryAllowed = false;

  constructor(kind: InstagramV2ErrorKind, mayHaveSucceeded = false) {
    // Do not include provider error bodies, URLs, tokens, captions or fetch exception text.
    super(`Instagram V2: ${kind}`);
    this.name = "InstagramV2Error";
    this.kind = kind;
    this.mayHaveSucceeded = mayHaveSucceeded;
  }
}

function numericId(value: unknown): value is string {
  return typeof value === "string" && /^[0-9]{1,32}$/.test(value);
}

function publicHttps(value: string) {
  try {
    const url = new URL(value);
    // Require an explicit DNS name (not an IP or a local hostname).
    const host = url.hostname.toLowerCase();
    if (url.protocol !== "https:" || url.username || url.password || url.hash || url.port ||
      !host.includes(".") || host.includes(":") || /^[0-9.]+$/.test(host) ||
      /(?:^|\.)(?:localhost|local|internal|test|invalid)$/.test(host)) return null;
    return url;
  } catch {
    return null;
  }
}

export function instagramLoginReadinessV2(env: Record<string, string | undefined>) {
  const keys = ["INSTAGRAM_LOGIN_ACCOUNT_ID", "INSTAGRAM_LOGIN_ACCESS_TOKEN", "INSTAGRAM_LOGIN_API_VERSION", "INSTAGRAM_LOGIN_MEDIA_ORIGIN"] as const;
  const missing = keys.filter((key) => !env[key]?.trim());
  const invalid: string[] = [];
  if (env.INSTAGRAM_LOGIN_ACCOUNT_ID && !numericId(env.INSTAGRAM_LOGIN_ACCOUNT_ID)) invalid.push("INSTAGRAM_LOGIN_ACCOUNT_ID");
  if (env.INSTAGRAM_LOGIN_API_VERSION && !/^v[0-9]{1,3}\.0$/.test(env.INSTAGRAM_LOGIN_API_VERSION)) invalid.push("INSTAGRAM_LOGIN_API_VERSION");
  if (env.INSTAGRAM_LOGIN_MEDIA_ORIGIN) {
    const url = publicHttps(env.INSTAGRAM_LOGIN_MEDIA_ORIGIN);
    if (!url || url.origin !== env.INSTAGRAM_LOGIN_MEDIA_ORIGIN) invalid.push("INSTAGRAM_LOGIN_MEDIA_ORIGIN");
  }
  return {
    configuration: missing.length || invalid.length ? "BLOCKED_AUTH" : "PASS",
    authorization: "NOT_TESTED",
    publishing: "NOT_TESTED",
    activation: "NOT_TESTED",
    adapter: "instagram_login_v2",
    facebookPageRequired: false,
    missing,
    invalid,
    // A filled env does NOT establish token ownership, scope, or successful OAuth.
  } as const;
}

export function createInstagramLoginClientV2(config: InstagramV2Config, transport: typeof fetch = fetch) {
  if (typeof window !== "undefined") throw new InstagramV2Error("configuration");
  if (!numericId(config.accountId) || !config.accessToken.trim() || /[\r\n]/.test(config.accessToken) ||
    !/^v[0-9]{1,3}\.0$/.test(config.apiVersion) || !config.mediaOrigins.length) {
    throw new InstagramV2Error("configuration");
  }
  const mediaOrigins = new Set(config.mediaOrigins.map((origin) => {
    const url = publicHttps(origin);
    if (!url || url.origin !== origin) throw new InstagramV2Error("configuration");
    return origin;
  }));
  const base = `https://graph.instagram.com/${config.apiVersion}`;

async function request(resource: string, method: "GET" | "POST", payload?: Record<string, string | boolean>) {
    // resource values below are fixed literals and validated numeric IDs.
    let response: Response;
    let body: Record<string, unknown>;
    const sideEffect = method === "POST";
    try {
      response = await transport(`${base}/${resource}`, {
        method,
        headers: { Authorization: `Bearer ${config.accessToken}`, "Content-Type": "application/json" },
        body: payload ? JSON.stringify(payload) : undefined,
        signal: AbortSignal.timeout(15_000),
        redirect: "error",
        cache: "no-store",
      });
      const value: unknown = await response.json();
      if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("invalid response");
      body = value as Record<string, unknown>;
    } catch {
      throw new InstagramV2Error("unknown", sideEffect);
    }
    const providerError = body.error && typeof body.error === "object" ? body.error as Record<string, unknown> : null;
    if (response.status >= 500 || response.status === 408 || response.status === 429) {
      throw new InstagramV2Error("unknown", sideEffect);
    }
    if ([401, 403].includes(response.status) || providerError?.code === 190) throw new InstagramV2Error("authorization");
    if (!response.ok || providerError) throw new InstagramV2Error("rejected");
    return body;
  }

  function validateId(id: string) {
    if (!numericId(id)) throw new InstagramV2Error("input");
  }

  return {
    async createImageContainer(input: { caption?: string; imageUrl: string; mimeType: "image/jpeg"; isCarouselItem?: boolean }) {
      const url = publicHttps(input.imageUrl);
      // Only the explicitly configured object storage origin is submitted to Meta.
      // The caller must use sharp to produce a verified JPEG, not trust the suffix.
      if (!url || !mediaOrigins.has(url.origin) || input.mimeType !== "image/jpeg" ||
        Array.from(input.caption || "").length > 2200) throw new InstagramV2Error("input");
      const payload: Record<string, string | boolean> = { image_url: url.href };
      if (input.caption) payload.caption = input.caption;
      if (input.isCarouselItem) payload.is_carousel_item = true;
      const body = await request(`${config.accountId}/media`, "POST", payload);
      if (!numericId(body.id)) throw new InstagramV2Error("unknown", true);
      return { containerId: body.id, status: "container_created" as const };
    },

    async createCarouselContainer(input: { caption: string; children: string[] }) {
      if (Array.from(input.caption).length > 2200 || input.children.length < 2 || input.children.length > 10 || input.children.some((id) => !numericId(id))) {
        throw new InstagramV2Error("input");
      }
      const body = await request(`${config.accountId}/media`, "POST", {
        media_type: "CAROUSEL",
        children: input.children.join(","),
        caption: input.caption,
      });
      if (!numericId(body.id)) throw new InstagramV2Error("unknown", true);
      return { containerId: body.id, status: "container_created" as const };
    },

    async getContainerStatus(containerId: string) {
      validateId(containerId);
      const body = await request(`${containerId}?fields=status_code`, "GET");
      const status = body.status_code;
      if (typeof status !== "string" || !["EXPIRED", "ERROR", "FINISHED", "IN_PROGRESS", "PUBLISHED"].includes(status)) {
        throw new InstagramV2Error("unknown");
      }
      // PUBLISHED is a reconciliation signal, not proof of a matching public post URL.
      return { containerId, status };
    },

    async publishContainer(containerId: string) {
      validateId(containerId);
      const body = await request(`${config.accountId}/media_publish`, "POST", { creation_id: containerId });
      if (!numericId(body.id)) throw new InstagramV2Error("unknown", true);
      return { mediaId: body.id, containerId, status: "submitted_pending_verification" as const };
    },

    async verifyPublishedMedia(mediaId: string, expectedCaption: string, expectedMediaType: "IMAGE" | "CAROUSEL") {
      validateId(mediaId);
      const body = await request(`${mediaId}?fields=id,caption,permalink,media_type`, "GET");
      const url = typeof body.permalink === "string" ? publicHttps(body.permalink) : null;
      if (body.id !== mediaId || (body.caption ?? "") !== expectedCaption || body.media_type !== expectedMediaType ||
        !url || !["www.instagram.com", "instagram.com"].includes(url.hostname) ||
        !/^\/p\/[A-Za-z0-9_-]+\/?$/.test(url.pathname) || url.search) {
        throw new InstagramV2Error("unknown");
      }
      return { mediaId, postUrl: url.href, verification: "verified" as const };
    },

    async verifyPublishedImage(mediaId: string, expectedCaption: string) {
      return this.verifyPublishedMedia(mediaId, expectedCaption, "IMAGE");
    },
  };
}
