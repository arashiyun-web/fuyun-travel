// R2 evidence for a runtime credential. Facts are recorded separately; none stands in for another
// (see r2-scope-evidence.mjs):
//   D. token policy: this Access Key ID (sha256 match), Object Read & Write, this bucket only
//      (saved policy evidence read from the dashboard session; checked first — no object is written
//      with a key whose policy is not verified)
//   C. public entry points off: r2.dev disabled, no custom domains (Cloudflare management API)
//   A. object read/write with the key (one synthetic object, unique per run, deleted in finally)
//   B. anonymous S3 read refused (endpoint-level: R2 answers the same for any bucket name)
//   E. (production only) the key cannot list the Preview test bucket (403 AccessDenied required)
// ListBuckets is INFO only. Prints no secrets. Exit 0 only when every non-INFO line is PASS.
//   node scripts/test-support/r2-precheck.mjs                       # Preview test key/bucket
//   node scripts/test-support/r2-precheck.mjs --target production   # release key/bucket (not wired to Vercel)
import { readFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, ListBucketsCommand, ListObjectsV2Command, HeadBucketCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { classifyAnonymousGet, classifyPublicEntry, evaluateTokenPolicy, expectRefused, sha256Hex } from "./r2-scope-evidence.mjs";

const HOME = process.env.USERPROFILE;
const TEST_BUCKET = "fuyun-ops-pr33-e2e";
const ti = process.argv.indexOf("--target");
const target = ti > 0 ? process.argv[ti + 1] : "preview";
if (!["preview", "production"].includes(target)) throw new Error("--target preview|production");
const cfg = target === "production"
  ? { env: path.join(HOME, ".fuyun-secrets", "production-release.env"), policy: path.join(HOME, ".fuyun-tools", "release", "r2-token-policy-production.json"), prefix: "release-precheck" }
  : { env: path.join(HOME, ".fuyun-secrets", "preview-e2e.env"), policy: process.env.R2_TOKEN_POLICY_EVIDENCE || path.join(HOME, ".fuyun-tools", "preview-e2e", "r2-token-policy.json"), prefix: "e2e-precheck" };
const e = Object.fromEntries(readFileSync(cfg.env, "utf8").split(/\r?\n/).filter((l) => /^[A-Z0-9_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]));
for (const k of ["R2_ACCOUNT_ID", "R2_BUCKET_NAME", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY"]) if (!e[k]) throw new Error(`missing ${k} in ${path.basename(cfg.env)}`);
const bucket = e.R2_BUCKET_NAME;
if (target === "production" && bucket === TEST_BUCKET) throw new Error("production target points at the test bucket");
const ep = `https://${e.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
const s3 = new S3Client({ region: "auto", endpoint: ep, credentials: { accessKeyId: e.R2_ACCESS_KEY_ID, secretAccessKey: e.R2_SECRET_ACCESS_KEY } });
const key = `${cfg.prefix}/${new Date().toISOString().slice(0, 10)}-${randomUUID()}.txt`;
const body = Buffer.from(`synthetic r2 precheck ${key}`);
const r = [`INFO target=${target} bucket=${bucket}`];
const put = (status, name, detail = "") => r.push(`${status} ${name}${detail ? " — " + detail : ""}`);
const step = async (name, fn) => {
  try {
    const ok = await fn();
    put(ok === false ? "FAIL" : "PASS", name);
  } catch (x) {
    put("FAIL", name, x.name || x.message);
  }
};

// D. token policy
let policyOk = false;
if (!existsSync(cfg.policy)) put("UNVERIFIED", "D token policy limited to this bucket", "no policy evidence file");
else {
  const ev = JSON.parse(readFileSync(cfg.policy, "utf8"));
  const t = evaluateTokenPolicy(ev.token, { accessKeyId: e.R2_ACCESS_KEY_ID, accountId: e.R2_ACCOUNT_ID, bucket });
  policyOk = t.scoped;
  put(t.scoped ? "PASS" : "FAIL", "D token = this Access Key ID, Object Read & Write, this bucket only", t.scoped ? `${t.permissions.join(" + ")} on ${bucket}; source ${ev.source} at ${ev.readAt}` : t.problems.join("; "));
}

// C. public entry points (management API via the logged-in wrangler)
const wr = (args) => spawnSync("npx", ["-y", "wrangler@4.142.0", "r2", "bucket", ...args, bucket], { encoding: "utf8", shell: process.platform === "win32" });
const dev = wr(["dev-url", "get"]);
const dom = wr(["domain", "list"]);
if (dev.status !== 0 || dom.status !== 0) put("FAIL", "C public entry points readable via management API", `wrangler exit ${dev.status}/${dom.status}: ${(dev.stderr + dom.stderr).match(/(\[code: \d+\][^\n]*|does not exist[^\n]*)/)?.[0] || "see wrangler"}`);
else {
  const pe = classifyPublicEntry(dev.stdout, dom.stdout);
  put(pe.devUrlDisabled ? "PASS" : "FAIL", "C r2.dev Public Development URL disabled");
  put(pe.noCustomDomains ? "PASS" : "FAIL", "C no custom domains connected");
}

// A/B. object read/write, anonymous read — only with a key whose policy is verified
if (!policyOk) put("SKIPPED", "A/B object write, read-back, presign, anonymous read", "token policy not verified for this bucket; nothing written");
else {
  let written = false;
  try {
    await step("A bucket reachable with the key", () => s3.send(new HeadBucketCommand({ Bucket: bucket })));
    await step("A write synthetic object (unique key)", async () => { await s3.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, Metadata: { sha256: sha256Hex(body) } })); written = true; });
    await step("A read back, sha256 matches", async () => sha256Hex(Buffer.from(await (await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }))).Body.transformToByteArray())) === sha256Hex(body));
    await step("A 60 s presigned URL returns the same bytes", async () => { const s = await fetch(await getSignedUrl(s3, new GetObjectCommand({ Bucket: bucket, Key: key }), { expiresIn: 60 })); return s.status === 200 && sha256Hex(Buffer.from(await s.arrayBuffer())) === sha256Hex(body); });
    const anon = await fetch(`${ep}/${bucket}/${key}`);
    const a = classifyAnonymousGet(anon.status, await anon.text());
    put(a.outcome === "refused" ? "PASS" : "FAIL", "B anonymous S3 GET refused (endpoint requires a signature; not proof of bucket privacy)", `${a.status} ${a.code}`);
  } finally {
    if (written) {
      try {
        await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
        put("PASS", "A synthetic object deleted");
      } catch (x) {
        put("FAIL", "A synthetic object deleted", `cleanup failed (${x.name}); key ${key} left in ${bucket}`);
      }
    }
  }
}

// E. production key must not reach the Preview test bucket (read-only listing probe)
if (target === "production") {
  const x = await expectRefused(() => s3.send(new ListObjectsV2Command({ Bucket: TEST_BUCKET, MaxKeys: 1 })));
  put(x.outcome === "refused" ? "PASS" : "FAIL", `E production key cannot list the test bucket ${TEST_BUCKET}`, `${x.outcome}${x.kind ? ` (${x.kind} ${x.name || ""} ${x.status || ""})` : ""}`);
}

const lb = await expectRefused(() => s3.send(new ListBucketsCommand({})));
put("INFO", "ListBuckets with the key (supporting signal; not scope proof)", `${lb.outcome}${lb.kind ? ` (${lb.kind} ${lb.name || ""} ${lb.status || ""})` : ""}`);

console.log(r.join("\n"));
process.exit(r.every((l) => /^(PASS|INFO)/.test(l)) ? 0 : 1);
