// R2 evidence for the PR #33 Preview E2E runtime credential. Four facts, recorded separately; none
// stands in for another (see r2-scope-evidence.mjs):
//   A. object read/write works with the runtime credential (one synthetic object, unique per run)
//   B. anonymous S3 read is refused (endpoint-level: R2 answers the same for any bucket name)
//   C. public entry points are off: r2.dev disabled, no custom domains (Cloudflare management API)
//   D. the token policy is Object Read & Write on this bucket only (saved policy evidence, matched by
//      sha256 of the Access Key ID; produced from the dashboard session, see checkpoint)
// A ListBuckets probe is reported as INFO only. Reads %USERPROFILE%\.fuyun-secrets\preview-e2e.env;
// prints no secrets. Exit 0 only when A–D all PASS.
import { readFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, ListBucketsCommand, HeadBucketCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { classifyAnonymousGet, classifyPublicEntry, evaluateTokenPolicy, expectRefused, sha256Hex } from "./r2-scope-evidence.mjs";

const HOME = process.env.USERPROFILE;
const F = path.join(HOME, ".fuyun-secrets", "preview-e2e.env");
const POLICY = process.env.R2_TOKEN_POLICY_EVIDENCE || path.join(HOME, ".fuyun-tools", "preview-e2e", "r2-token-policy.json");
const e = Object.fromEntries(readFileSync(F, "utf8").split(/\r?\n/).filter((l) => /^[A-Z0-9_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]));
for (const k of ["R2_ACCOUNT_ID", "R2_BUCKET_NAME", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY"]) if (!e[k]) throw new Error(`missing ${k}`);
const ep = `https://${e.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
const s3 = new S3Client({ region: "auto", endpoint: ep, credentials: { accessKeyId: e.R2_ACCESS_KEY_ID, secretAccessKey: e.R2_SECRET_ACCESS_KEY } });
const bucket = e.R2_BUCKET_NAME;
const key = `e2e-precheck/${new Date().toISOString().slice(0, 10)}-${randomUUID()}.txt`;
const body = Buffer.from(`synthetic r2 precheck ${key}`);
const r = [];
const put = (status, name, detail = "") => r.push(`${status} ${name}${detail ? " — " + detail : ""}`);
const step = async (name, fn) => {
  try {
    const ok = await fn();
    put(ok === false ? "FAIL" : "PASS", name);
  } catch (x) {
    put("FAIL", name, x.name || x.message);
  }
};

// A. object read/write
let written = false;
try {
  await step("A bucket reachable with the runtime credential", () => s3.send(new HeadBucketCommand({ Bucket: bucket })));
  await step("A write synthetic object (unique key)", async () => { await s3.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, Metadata: { sha256: sha256Hex(body) } })); written = true; });
  await step("A read back, sha256 matches", async () => sha256Hex(Buffer.from(await (await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }))).Body.transformToByteArray())) === sha256Hex(body));
  await step("A 60 s presigned URL returns the same bytes", async () => { const s = await fetch(await getSignedUrl(s3, new GetObjectCommand({ Bucket: bucket, Key: key }), { expiresIn: 60 })); return s.status === 200 && sha256Hex(Buffer.from(await s.arrayBuffer())) === sha256Hex(body); });

  // B. anonymous S3 read
  const anon = await fetch(`${ep}/${bucket}/${key}`);
  const a = classifyAnonymousGet(anon.status, await anon.text());
  put(a.outcome === "refused" ? "PASS" : "FAIL", "B anonymous S3 GET refused (endpoint requires a signature; not proof of bucket privacy)", `${a.status} ${a.code}`);
} finally {
  if (written) {
    try {
      await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
      put("PASS", "A synthetic object deleted");
    } catch (x) {
      put("FAIL", "A synthetic object deleted", `cleanup failed (${x.name}); key ${key} left in the test bucket`);
    }
  }
}

// C. public entry points (management API via the logged-in wrangler)
const wr = (args) => spawnSync("npx", ["-y", "wrangler@4.142.0", "r2", "bucket", ...args, bucket], { encoding: "utf8", shell: process.platform === "win32" });
const dev = wr(["dev-url", "get"]);
const dom = wr(["domain", "list"]);
if (dev.status !== 0 || dom.status !== 0) put("FAIL", "C public entry points readable via management API", `wrangler exit ${dev.status}/${dom.status}`);
else {
  const pe = classifyPublicEntry(dev.stdout, dom.stdout);
  put(pe.devUrlDisabled ? "PASS" : "FAIL", "C r2.dev Public Development URL disabled");
  put(pe.noCustomDomains ? "PASS" : "FAIL", "C no custom domains connected");
}

// D. token policy scope
if (!existsSync(POLICY)) put("UNVERIFIED", "D token policy limited to this bucket", "no policy evidence file");
else {
  const ev = JSON.parse(readFileSync(POLICY, "utf8"));
  const t = evaluateTokenPolicy(ev.token, { accessKeyId: e.R2_ACCESS_KEY_ID, accountId: e.R2_ACCOUNT_ID, bucket });
  put(t.scoped ? "PASS" : "FAIL", "D token = runtime Access Key ID, Object Read & Write, this bucket only", t.scoped ? `${t.permissions.join(" + ")} on ${bucket}; source ${ev.source} at ${ev.readAt}` : t.problems.join("; "));
}

// Supporting signal only
const lb = await expectRefused(() => s3.send(new ListBucketsCommand({})));
put("INFO", "ListBuckets with the runtime credential (supporting signal; not scope proof)", `${lb.outcome}${lb.kind ? ` (${lb.kind} ${lb.name || ""} ${lb.status || ""})` : ""}`);

console.log(r.join("\n"));
process.exit(r.some((l) => /^(FAIL|UNVERIFIED)/.test(l)) ? 1 : 0);
