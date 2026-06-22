import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

function getR2Client(): S3Client | null {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!accountId || !accessKeyId || !secretAccessKey) {
    return null;
  }

  return new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });
}

export async function uploadToR2(
  key: string,
  body: Buffer,
  contentType: string,
): Promise<string | null> {
  const client = getR2Client();
  const bucket = process.env.R2_BUCKET_NAME;
  const publicUrl = process.env.R2_PUBLIC_URL;

  if (!client || !bucket || !publicUrl) {
    return null;
  }

  try {
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );

    return `${publicUrl.replace(/\/$/, "")}/${key}`;
  } catch (error) {
    console.error("[R2] upload error:", error);
    return null;
  }
}
