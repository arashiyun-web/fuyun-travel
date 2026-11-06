import { createHmac, randomBytes } from "crypto";

export type XCredentials = {
  apiKey: string;
  apiSecret: string;
  accessToken: string;
  accessSecret: string;
};

export function xCredentialsFromEnv(): XCredentials | null {
  const apiKey = process.env.X_API_KEY?.trim() || "";
  const apiSecret = process.env.X_API_SECRET?.trim() || "";
  const accessToken = process.env.X_ACCESS_TOKEN?.trim() || "";
  const accessSecret = process.env.X_ACCESS_SECRET?.trim() || "";
  if (!apiKey || !apiSecret || !accessToken || !accessSecret) return null;
  return { apiKey, apiSecret, accessToken, accessSecret };
}

function percentEncode(value: string) {
  return encodeURIComponent(value).replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
}

/** OAuth 1.0a Authorization header. `extra` holds form fields included in the signature (not used for multipart or JSON bodies). */
export function buildOauth1Header(method: string, url: string, credentials: XCredentials, extra: Record<string, string> = {}) {
  const oauth: Record<string, string> = {
    oauth_consumer_key: credentials.apiKey,
    oauth_nonce: randomBytes(16).toString("hex"),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: credentials.accessToken,
    oauth_version: "1.0",
  };
  const signed = { ...extra, ...oauth };
  const parameterString = Object.keys(signed)
    .sort()
    .map((key) => `${percentEncode(key)}=${percentEncode(signed[key])}`)
    .join("&");
  const base = [method.toUpperCase(), percentEncode(url), percentEncode(parameterString)].join("&");
  const signingKey = `${percentEncode(credentials.apiSecret)}&${percentEncode(credentials.accessSecret)}`;
  oauth.oauth_signature = createHmac("sha1", signingKey).update(base).digest("base64");
  return `OAuth ${Object.keys(oauth)
    .sort()
    .map((key) => `${percentEncode(key)}="${percentEncode(oauth[key])}"`)
    .join(", ")}`;
}

export async function publishXPost(input: { text: string; image?: { buffer: Buffer; contentType: string } | null }): Promise<{ id: string }> {
  const credentials = xCredentialsFromEnv();
  if (!credentials) throw new Error("缺少 X_API_KEY、X_API_SECRET、X_ACCESS_TOKEN 或 X_ACCESS_SECRET");

  let mediaId: string | null = null;
  if (input.image?.buffer.length) {
    const uploadUrl = "https://upload.twitter.com/1.1/media/upload.json";
    const body = new FormData();
    body.set("media", new Blob([new Uint8Array(input.image.buffer)], { type: input.image.contentType || "image/jpeg" }), "image.jpg");
    const uploaded = await fetch(uploadUrl, {
      method: "POST",
      headers: { Authorization: buildOauth1Header("POST", uploadUrl, credentials) },
      body,
    });
    const media = (await uploaded.json().catch(() => ({}))) as { media_id_string?: string; errors?: { message?: string }[] };
    if (!uploaded.ok || !media.media_id_string) {
      throw new Error(media.errors?.[0]?.message || `X 圖片上傳失敗 ${uploaded.status}`);
    }
    mediaId = media.media_id_string;
  }

  const tweetUrl = "https://api.twitter.com/2/tweets";
  const tweeted = await fetch(tweetUrl, {
    method: "POST",
    headers: {
      Authorization: buildOauth1Header("POST", tweetUrl, credentials),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text: input.text.slice(0, 280),
      ...(mediaId ? { media: { media_ids: [mediaId] } } : {}),
    }),
  });
  const data = (await tweeted.json().catch(() => ({}))) as { data?: { id?: string }; detail?: string; errors?: { message?: string }[] };
  if (!tweeted.ok || !data.data?.id) {
    throw new Error(data.errors?.[0]?.message || data.detail || `X 發文失敗 ${tweeted.status}`);
  }
  return { id: data.data.id };
}
