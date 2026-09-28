// Verifies the bucket-scoped R2 runtime credential for the PR #33 Preview E2E with one synthetic object:
// write, read-back hash, unsigned GET refused, presigned URL works, no account-wide listing, no other bucket,
// then deletes the object. Reads %USERPROFILE%\.fuyun-secrets\preview-e2e.env; prints no secrets.
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, ListBucketsCommand, HeadBucketCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const F = `${process.env.USERPROFILE}/.fuyun-secrets/preview-e2e.env`;
const e = Object.fromEntries(readFileSync(F, "utf8").split(/\r?\n/).filter((l) => /^[A-Z0-9_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]));
for (const k of ["R2_ACCOUNT_ID", "R2_BUCKET_NAME", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY"]) if (!e[k]) throw new Error(`missing ${k}`);
const ep = `https://${e.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
const s3 = new S3Client({ region: "auto", endpoint: ep, credentials: { accessKeyId: e.R2_ACCESS_KEY_ID, secretAccessKey: e.R2_SECRET_ACCESS_KEY } });
const bucket = e.R2_BUCKET_NAME;
const key = "e2e-precheck/synthetic.txt";
const body = Buffer.from(`synthetic r2 precheck ${Date.now()}`);
const sha = (b) => createHash("sha256").update(b).digest("hex");
const r = [];
const step = async (name, fn) => { try { const ok = await fn(); r.push(`${ok === false ? "FAIL" : "PASS"} ${name}`); } catch (x) { r.push(`FAIL ${name}: ${x.name || x.message}`); } };

await step("bucket reachable with the runtime credential", () => s3.send(new HeadBucketCommand({ Bucket: bucket })));
await step("write synthetic object", () => s3.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, Metadata: { sha256: sha(body) } })));
await step("read back, sha256 matches", async () => sha(Buffer.from(await (await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }))).Body.transformToByteArray())) === sha(body));
await step("unsigned GET refused", async () => [400, 401, 403].includes((await fetch(`${ep}/${bucket}/${key}`)).status));
await step("60 s presigned URL returns the same bytes", async () => { const s = await fetch(await getSignedUrl(s3, new GetObjectCommand({ Bucket: bucket, Key: key }), { expiresIn: 60 })); return s.status === 200 && sha(Buffer.from(await s.arrayBuffer())) === sha(body); });
let listed = false;
try { await s3.send(new ListBucketsCommand({})); listed = true; } catch { /* expected */ }
r.push(`${listed ? "FAIL" : "PASS"} credential cannot list account buckets (bucket-scoped)`);
let otherWrite = false;
try { await s3.send(new PutObjectCommand({ Bucket: "fuyun-scope-check-other", Key: "x", Body: "x" })); otherWrite = true; } catch { /* expected */ }
r.push(`${otherWrite ? "FAIL" : "PASS"} write to another bucket name refused`);
await step("synthetic object deleted", () => s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key })));
console.log(r.join("\n"));
process.exit(r.some((l) => l.startsWith("FAIL")) ? 1 : 0);
