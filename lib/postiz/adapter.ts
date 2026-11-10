import type { PostizSocialPlatform } from "@/lib/postiz/config";

const TIMEOUT_MS = 15_000;

export type PostizDraftInput = {
  apiUrl: string;
  apiKey: string;
  platform: PostizSocialPlatform;
  integrationId: string;
  content: string;
  imageUrl?: string | null;
};

function settingsFor(platform: PostizSocialPlatform) {
  if (platform === "facebook_page") return { __type: "facebook" };
  if (platform === "instagram") return { __type: "instagram", post_type: "post" };
  return { __type: "x", who_can_reply_post: "everyone", community: "" };
}

function withoutKey(message: string, apiKey: string) {
  return apiKey ? message.split(apiKey).join("[redacted]") : message;
}

/** The request may have reached Postiz. Callers must not send it again. */
export class PostizUncertainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PostizUncertainError";
  }
}

/** Postiz answered with a failure, so this attempt did not create a draft. */
export class PostizRejectedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PostizRejectedError";
  }
}

/** Creates a Postiz draft. The request type is always draft, never now or schedule. */
export async function createPostizDraft(input: PostizDraftInput, options?: { fetchImpl?: typeof fetch; timeoutMs?: number }) {
  const fetchImpl = options?.fetchImpl || fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options?.timeoutMs ?? TIMEOUT_MS);
  const endpoint = new URL("/public/v1/posts", input.apiUrl.endsWith("/") ? input.apiUrl : `${input.apiUrl}/`);
  const image = input.imageUrl && input.imageUrl.startsWith("https://") ? [{ path: input.imageUrl }] : [];
  const body = {
    type: "draft",
    date: new Date().toISOString(),
    shortLink: false,
    tags: [],
    posts: [{
      integration: { id: input.integrationId },
      value: [{ content: input.content, image }],
      settings: settingsFor(input.platform),
    }],
  };
  try {
    const response = await fetchImpl(endpoint, {
      method: "POST",
      headers: {
        Authorization: input.apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => null) as { postId?: string; error?: string }[] | { message?: string } | null;
    if (!response.ok) {
      const raw = Array.isArray(payload) ? "" : payload?.message || `Postiz 回應 ${response.status}`;
      throw new PostizRejectedError(withoutKey(raw, input.apiKey));
    }
    const postId = Array.isArray(payload) ? payload[0]?.postId : "";
    if (!postId) throw new PostizUncertainError("Postiz 沒有回傳草稿編號");
    return { postId };
  } catch (error) {
    if (error instanceof PostizRejectedError) throw error;
    if (error instanceof PostizUncertainError) throw new PostizUncertainError(withoutKey(error.message, input.apiKey));
    if (error instanceof Error && error.name === "AbortError") throw new PostizUncertainError("Postiz 逾時，沒有建立草稿");
    if (error instanceof Error) throw new PostizUncertainError(withoutKey(error.message, input.apiKey));
    throw new PostizUncertainError("Postiz 沒有建立草稿");
  } finally {
    clearTimeout(timer);
  }
}
