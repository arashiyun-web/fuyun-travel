import { createHash } from "crypto";
import { GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * Private S3-compatible object storage for operations images (Cloudflare R2 in production).
 *
 * Settings (names match the existing lib/storage/r2.ts adapter):
 *   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME
 *   R2_ENDPOINT (optional; overrides https://<account>.r2.cloudflarestorage.com, used for isolated tests)
 * Objects are never made public: admins read them through an authenticated route and
 * Instagram receives a short-lived presigned URL at publish time.
 */
export const PRESIGNED_URL_TTL_SECONDS = 15 * 60;

export class ObjectStoreError extends Error {
  constructor(public readonly kind: "configuration" | "write" | "read" | "integrity", message: string) {
    super(message);
    this.name = "ObjectStoreError";
  }
}

function settings() {
  const accountId = process.env.R2_ACCOUNT_ID?.trim() || "";
  const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim() || "";
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim() || "";
  const bucket = process.env.R2_BUCKET_NAME?.trim() || "";
  const endpoint = process.env.R2_ENDPOINT?.trim() || (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : "");
  return { accessKeyId, secretAccessKey, bucket, endpoint };
}

export function objectStoreConfigured() {
  const s = settings();
  return Boolean(s.accessKeyId && s.secretAccessKey && s.bucket && s.endpoint);
}

let cached: { client: S3Client; bucket: string } | null = null;

function client() {
  const s = settings();
  if (!objectStoreConfigured()) throw new ObjectStoreError("configuration", "物件儲存尚未設定");
  if (!cached || cached.bucket !== s.bucket) {
    cached = {
      bucket: s.bucket,
      client: new S3Client({
        region: "auto",
        endpoint: s.endpoint,
        forcePathStyle: Boolean(process.env.R2_ENDPOINT),
        credentials: { accessKeyId: s.accessKeyId, secretAccessKey: s.secretAccessKey },
      }),
    };
  }
  return cached;
}

export function sha256Hex(buffer: Buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

/** Upload and read back the metadata to confirm size and checksum. */
export async function putObject(key: string, body: Buffer, contentType: string) {
  const { client: s3, bucket } = client();
  const sha256 = sha256Hex(body);
  try {
    await s3.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType, Metadata: { sha256 } }));
    const head = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    if (head.ContentLength !== body.length || head.Metadata?.sha256 !== sha256) {
      throw new ObjectStoreError("integrity", "物件寫入後大小或雜湊不符");
    }
  } catch (error) {
    if (error instanceof ObjectStoreError) throw error;
    throw new ObjectStoreError("write", "物件寫入失敗");
  }
  return { key, sha256, bytes: body.length };
}

/** Read an object and verify it against the stored checksum. */
export async function getObject(key: string) {
  const { client: s3, bucket } = client();
  let buffer: Buffer;
  let contentType = "application/octet-stream";
  let expected: string | undefined;
  try {
    const result = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    buffer = Buffer.from(await result.Body!.transformToByteArray());
    contentType = result.ContentType || contentType;
    expected = result.Metadata?.sha256;
  } catch {
    throw new ObjectStoreError("read", "物件讀取失敗");
  }
  if (expected && sha256Hex(buffer) !== expected) throw new ObjectStoreError("integrity", "物件內容與雜湊不符");
  return { buffer, contentType, sha256: expected ?? sha256Hex(buffer) };
}

export async function presignGet(key: string, seconds = PRESIGNED_URL_TTL_SECONDS) {
  const { client: s3, bucket } = client();
  return getSignedUrl(s3, new GetObjectCommand({ Bucket: bucket, Key: key }), { expiresIn: seconds });
}
