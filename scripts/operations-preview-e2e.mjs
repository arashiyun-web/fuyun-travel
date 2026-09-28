// Cloud Preview E2E for the operations backend (PR #33). Synthetic data only, no external publishing.
// Target: a Git Preview deployment whose branch-scoped env points at an isolated Neon schema-only
// branch and a dedicated private R2 test bucket. Refuses to run against the production database.
//
// Usage:
//   node scripts/operations-preview-e2e.mjs run    <previewUrl>
//   node scripts/operations-preview-e2e.mjs verify <previewUrl>   (after a redeploy: data/images still there)
// Secrets come from an ACL-protected env file (PREVIEW_E2E_ENV, default %USERPROFILE%\.fuyun-secrets\preview-e2e.env)
// and VERCEL_AUTOMATION_BYPASS_SECRET in the process env. Nothing secret is printed.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { S3Client, HeadObjectCommand, GetObjectCommand, ListBucketsCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { classifyAnonymousGet, expectRefused } from "./test-support/r2-scope-evidence.mjs";

const [,, phase, rawBase] = process.argv;
if (!["run", "sched", "verify"].includes(phase) || !/^https:\/\//.test(rawBase || "")) {
  console.error("usage: operations-preview-e2e.mjs run|sched|verify <https preview url>");
  process.exit(2);
}
const BASE = rawBase.replace(/\/$/, "");
const home = process.env.USERPROFILE || process.env.HOME;
const readEnv = (file) => Object.fromEntries(readFileSync(file, "utf8").split(/\r?\n/).filter((l) => /^[A-Z0-9_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]));
const cfg = readEnv(process.env.PREVIEW_E2E_ENV || path.join(home, ".fuyun-secrets", "preview-e2e.env"));
// The project's existing "Protection Bypass for Automation" secret, read through the logged-in Vercel
// CLI and kept in memory only (Preview deployments sit behind Vercel Authentication).
function automationBypass() {
  if (process.env.VERCEL_AUTOMATION_BYPASS_SECRET) return process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
  const r = spawnSync("vercel", ["api", "/v9/projects/fuyun-travel", "--scope", "arashiyun-s-projects"], { shell: true, encoding: "utf8", env: { ...process.env, MSYS_NO_PATHCONV: "1" } });
  const project = JSON.parse(r.stdout.slice(r.stdout.indexOf("{")));
  const entry = Object.entries(project.protectionBypass || {}).find(([, v]) => v.scope === "automation-bypass");
  if (!entry) throw new Error("no automation bypass secret on the project");
  return entry[0];
}
const bypass = automationBypass();
const stateDir = path.join(home, ".fuyun-tools", "preview-e2e");
const stateFile = path.join(stateDir, "state.json");
const res = [];
const chk = (n, ok, d = "") => res.push(`${ok ? "PASS" : "FAIL"} ${n}${d ? " — " + d : ""}`);
const sha = (b) => createHash("sha256").update(b).digest("hex");
const endpointId = (url) => new URL(url).hostname.split(".")[0].replace(/-pooler$/, "");

// ---- Guard: never touch production data ----
const prodUrl = readEnv(path.join(home, ".fuyun-secrets", "neon-prod.env")).DATABASE_URL;
if (!cfg.PREVIEW_DATABASE_URL || endpointId(cfg.PREVIEW_DATABASE_URL) === endpointId(prodUrl)) {
  console.error("REFUSED: preview database endpoint is missing or equals the production endpoint");
  process.exit(3);
}
const prisma = new PrismaClient({ datasources: { db: { url: cfg.PREVIEW_DATABASE_URL } } });
const customerRows = await prisma.$queryRawUnsafe(
  "select (select count(*) from charter_quotes where id not like 'synthetic-%')::int q, (select count(*) from inquiries)::int i, (select count(*) from line_sessions)::int l, (select count(*) from ai_conversations)::int a",
);
const cr = customerRows[0];
if (cr.q + cr.i + cr.l + cr.a !== 0) {
  console.error("REFUSED: preview database contains non-synthetic customer rows");
  process.exit(3);
}
chk("preview DB endpoint differs from production and holds no customer rows", true, `endpoint ${endpointId(cfg.PREVIEW_DATABASE_URL)}`);

const vh = bypass ? { "x-vercel-protection-bypass": bypass } : {};
const f = (p, init = {}) => fetch(BASE + p, { redirect: "manual", ...init, headers: { ...vh, ...(init.headers || {}) } });
const jsonOf = async (r) => { try { return await r.json(); } catch { return {}; } };

async function login() {
  const r = await f("/api/auth/login", { method: "POST", headers: { "content-type": "application/json", origin: BASE }, body: JSON.stringify({ username: cfg.PREVIEW_ADMIN_USERNAME, password: cfg.PREVIEW_ADMIN_PASSWORD }) });
  const setCookie = (r.headers.getSetCookie?.() || []).find((c) => c.startsWith("fuyun_admin_session=")) || "";
  return { status: r.status, token: (await jsonOf(r)).token, setCookie, cookie: setCookie.split(";")[0] };
}

const s3 = new S3Client({ region: "auto", endpoint: `https://${cfg.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`, credentials: { accessKeyId: cfg.R2_ACCESS_KEY_ID, secretAccessKey: cfg.R2_SECRET_ACCESS_KEY } });
async function objectChecks(label, key, expectedSha) {
  const head = await s3.send(new HeadObjectCommand({ Bucket: cfg.R2_BUCKET_NAME, Key: key }));
  const body = Buffer.from(await (await s3.send(new GetObjectCommand({ Bucket: cfg.R2_BUCKET_NAME, Key: key }))).Body.transformToByteArray());
  chk(`${label}: R2 object exists, metadata and bytes match sha256`, head.Metadata?.sha256 === expectedSha && sha(body) === expectedSha);
  const unsigned = await fetch(`https://${cfg.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${cfg.R2_BUCKET_NAME}/${key}`);
  const anon = classifyAnonymousGet(unsigned.status, await unsigned.text());
  // Endpoint-level only: bucket privacy (r2.dev, custom domains) and token scope are checked by r2-precheck.mjs.
  chk(`${label}: anonymous S3 GET refused (signature required)`, anon.outcome === "refused", `${anon.status} ${anon.code}`);
  const signed = await fetch(await getSignedUrl(s3, new GetObjectCommand({ Bucket: cfg.R2_BUCKET_NAME, Key: key }), { expiresIn: 60 }));
  chk(`${label}: 60 s presigned URL returns the same bytes`, signed.status === 200 && sha(Buffer.from(await signed.arrayBuffer())) === expectedSha, String(signed.status));
}

async function verifyPersisted(state, t) {
  for (const { id, fileName, sha256, storageKey } of state.contents) {
    const c = await f(`/api/operations/content/${id}`, { headers: { authorization: `Bearer ${t}` } });
    const ir = await f(`/api/operations/content/${id}/images/${fileName}`, { headers: { authorization: `Bearer ${t}` } });
    const buf = Buffer.from(await ir.arrayBuffer());
    chk(`content ${id.slice(0, 8)} readable on ${state.deployment === BASE ? "same" : "new"} deployment, image hash intact`, c.status === 200 && ir.status === 200 && sha(buf) === sha256, `${c.status}/${ir.status}`);
    await objectChecks(`content ${id.slice(0, 8)}`, storageKey, sha256);
  }
}

if (phase === "sched") {
  // After scripts/test-support/scheduled-identity-preview-check.ps1: the content left approved by the
  // run phase must have been processed exactly once, in dry-run, by the scheduled-identity worker.
  const state = JSON.parse(readFileSync(stateFile, "utf8"));
  const ps = spawnSync("powershell", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", path.join("scripts", "test-support", "scheduled-identity-preview-check.ps1"), "-PreviewUrl", BASE], { encoding: "utf8", env: { ...process.env, VERCEL_AUTOMATION_BYPASS_SECRET: bypass } });
  console.log(ps.stdout.trim());
  chk("temporary S4U/Limited task ran the worker against the Preview (exit 0)", ps.status === 0 && /lastResult=0 /.test(ps.stdout) && /completed: \d+ job/.test(ps.stdout), ps.stderr.slice(0, 200));
  const jobs = await prisma.operationsJob.findMany({ where: { contentId: state.scheduledContentId } });
  const claimed = await prisma.operationsEvent.count({ where: { contentId: state.scheduledContentId, type: "job_claimed" } });
  chk("scheduled-identity worker processed the approved content once, dry-run only", jobs.length === 3 && claimed === 3 && jobs.every((j) => j.status === "dry_run_verified" && !j.externalId), `${jobs.map((j) => j.status).join(",")} claims=${claimed}`);
  console.log(res.join("\n"));
  await prisma.$disconnect();
  process.exit(res.some((l) => l.startsWith("FAIL")) ? 1 : 0);
}

if (phase === "verify") {
  if (!existsSync(stateFile)) throw new Error("no state from a previous run");
  const state = JSON.parse(readFileSync(stateFile, "utf8"));
  const { token } = await login();
  chk("verify phase targets a different deployment than the run phase", state.deployment !== BASE, `${state.deployment} → ${BASE}`);
  await verifyPersisted(state, token);
  console.log(res.join("\n"));
  await prisma.$disconnect();
  process.exit(res.some((l) => l.startsWith("FAIL")) ? 1 : 0);
}

// ---- 1. Session cookie, origin checks, quote header auth ----
const L = await login();
chk("admin login on the Preview domain", L.status === 200 && !!L.token && !!L.cookie, String(L.status));
chk("session cookie is HttpOnly, Secure, SameSite=Lax", /HttpOnly/i.test(L.setCookie) && /Secure/i.test(L.setCookie) && /SameSite=Lax/i.test(L.setCookie));
const st = await jsonOf(await f("/api/social/instagram/status", { headers: { cookie: L.cookie } }));
chk("live publishing is off (OPERATIONS_LIVE_PUBLISH_ENABLED=false)", st.livePublishEnabled === false && st.state !== "AUTHORIZED", `${st.livePublishEnabled}/${st.state}`);

const png = async (seed) => {
  const { default: sharp } = await import("sharp");
  const buf = await sharp({ create: { width: 2, height: 2, channels: 3, background: { r: (seed * 70) % 256, g: 120, b: 200 } } }).png().toBuffer();
  return "data:image/png;base64," + buf.toString("base64");
};
const imgs = [await png(0), await png(1), await png(2)];
const intake = (title, body, seed = 0) => ({ title, type: "招生", tripDate: "2030-11-20", body, selectedPlatforms: ["website", "facebook_group", "instagram"], images: [{ dataUrl: imgs[seed % 3], originalName: "synthetic.png" }] });
const run = `E2E ${Date.now().toString(36)}`;
const postCookie = (origin) => f("/api/operations/content", { method: "POST", headers: { cookie: L.cookie, "content-type": "application/json", ...(origin ? { origin } : {}) }, body: JSON.stringify(intake(`合成測試 ${run} cookie`, "合成測試內容 cookie。", 2)) });
chk("cookie mutation from another origin → 401", (await postCookie("https://evil.example")).status === 401);
chk("cookie mutation without Origin → 401", (await postCookie(null)).status === 401);
chk("cookie mutation same-origin → 201", (await postCookie(BASE)).status === 201);

const QID = "synthetic-quote-preview-e2e";
await prisma.charterQuote.upsert({ where: { id: QID }, update: {}, create: { id: QID, lineUserId: "synthetic-line-user", lineName: "合成測試", tripDate: "2030-11-20", passengerCount: 10 } });
const qc = async (p, init = {}) => (await f(p, init)).status;
chk("quotes: header ADMIN_ACCESS_TOKEN → 200", (await qc("/api/admin/quotes", { headers: { authorization: `Bearer ${cfg.PREVIEW_ADMIN_ACCESS_TOKEN}` } })) === 200);
chk("quotes: ?admin_token= only → 401", (await qc(`/api/admin/quotes?admin_token=${encodeURIComponent(cfg.PREVIEW_ADMIN_ACCESS_TOKEN)}`)) === 401);
chk("quotes: wrong bearer → 401", (await qc("/api/admin/quotes", { headers: { authorization: "Bearer wrong" } })) === 401);
chk("quotes: session cookie → 200", (await qc("/api/admin/quotes", { headers: { cookie: L.cookie } })) === 200);
const patch = (h) => qc(`/api/admin/quotes/${QID}`, { method: "PATCH", headers: { "content-type": "application/json", ...h }, body: JSON.stringify({ quoteDraftText: "合成測試報價草稿", quoteStatus: "draft" }) });
chk("quote PATCH cookie cross-origin → 401", (await patch({ cookie: L.cookie, origin: "https://evil.example" })) === 401);
chk("quote PATCH cookie same-origin → 200", (await patch({ cookie: L.cookie, origin: BASE })) === 200);
chk("quote send cross-origin → 401 (no LINE push attempted)", (await qc(`/api/admin/quotes/${QID}/send`, { method: "POST", headers: { cookie: L.cookie, origin: "https://evil.example" } })) === 401);

// ---- 2. Operations flow ----
const H = { authorization: `Bearer ${L.token}`, "content-type": "application/json" };
const post = (b) => f("/api/operations/content", { method: "POST", headers: H, body: JSON.stringify(b) }).then(async (r) => ({ status: r.status, json: await jsonOf(r) }));
const approve = (id, extra = {}) => f(`/api/operations/content/${id}/approve`, { method: "POST", headers: H, body: JSON.stringify(extra) }).then(async (r) => ({ status: r.status, json: await jsonOf(r) }));
const due = () => f("/api/operations/process-due", { method: "POST", headers: { authorization: `Bearer ${cfg.PREVIEW_OPERATIONS_CRON_TOKEN}`, "content-type": "application/json" }, body: "{}" }).then(jsonOf);
const claims = async (contentId) => {
  const per = {};
  for (const e of await prisma.operationsEvent.findMany({ where: { contentId, type: "job_claimed" } })) per[e.jobId] = (per[e.jobId] || 0) + 1;
  return per;
};

const [p1, p2] = await Promise.all([post(intake(`合成測試 ${run} 阿里山`, "合成測試內容。", 0)), post(intake(`合成測試 ${run} 阿里山`, "合成測試內容。", 0))]);
const id1 = p1.json.content?.id;
chk("concurrent identical intake → same content id", p1.status === 201 && !!id1 && id1 === p2.json.content?.id, `${p1.status}/${p2.status}`);
chk("one content row, three job rows", (await prisma.operationsContent.count({ where: { contentFingerprint: p1.json.content?.contentFingerprint } })) === 1 && (await prisma.operationsJob.count({ where: { contentId: id1 } })) === 3);
const img = p1.json.content.images[0];
const ir = await f(`/api/operations/content/${id1}/images/${img.fileName}`, { headers: { authorization: `Bearer ${L.token}` } });
chk("image read back through the admin route matches sha256", ir.status === 200 && sha(Buffer.from(await ir.arrayBuffer())) === img.sha256, String(ir.status));
chk("image route without auth → 401", (await f(`/api/operations/content/${id1}/images/${img.fileName}`)).status === 401);
chk("image record: private storage keys, no public URL", !!img.storageKey && !!img.instagramStorageKey && !img.publicUrl);
await objectChecks("intake image", img.storageKey, img.sha256);
// Supporting signal only, never a scope PASS: bucket scope comes from the token policy (r2-precheck.mjs D).
const lb = await expectRefused(() => s3.send(new ListBucketsCommand({})));
console.log(`INFO ListBuckets with the runtime credential: ${lb.outcome}${lb.kind ? ` (${lb.kind} ${lb.name || ""} ${lb.status || ""})` : ""}`);

const bad = await post(intake(`合成測試 ${run} 定價`, "每人只要 9,999 元，含住宿與早餐。", 1));
const refuse = await approve(bad.json.content.id);
chk("fact check failure blocks approval", refuse.status === 400, String(refuse.status));
const ack = await approve(bad.json.content.id, { acknowledgeFactWarnings: true });
chk("explicit acknowledgement approves and is recorded", ack.status === 200 && (await prisma.operationsEvent.count({ where: { contentId: bad.json.content.id, type: "fact_warnings_acknowledged" } })) === 1);

const ap = await approve(id1);
chk("approval stores a hash on every job", ap.status === 200 && Object.values(ap.json.content?.platforms || {}).every((j) => /^[0-9a-f]{64}$/.test(j.approvalHash || "")));
await Promise.all([due(), due(), due()]);
const per1 = await claims(id1);
chk("three concurrent process-due calls → each job claimed once", Object.keys(per1).length === 3 && Object.values(per1).every((n) => n === 1), JSON.stringify(per1));
const jobs1 = await prisma.operationsJob.findMany({ where: { contentId: id1 } });
chk("jobs end dry_run_verified, nothing published, locks released", jobs1.every((j) => j.status === "dry_run_verified" && !j.externalId && !j.lockOwner), jobs1.map((j) => j.status).join(","));
await Promise.all([due(), due()]);
chk("re-run claims nothing (no resend)", Object.values(await claims(id1)).reduce((a, b) => a + b, 0) === 3);

const t = await post(intake(`合成測試 ${run} 日月潭`, "合成測試內容二。", 0));
await approve(t.json.content.id);
await prisma.operationsJob.update({ where: { jobId: `${t.json.content.id}:instagram:v1` }, data: { caption: "核准後被改的 caption" } });
await due();
const tj = Object.fromEntries((await prisma.operationsJob.findMany({ where: { contentId: t.json.content.id } })).map((j) => [j.platform, j]));
chk("change after approval → approval withdrawn for all jobs, none run", Object.values(tj).every((j) => j.status === "pending_approval" && !j.approvalHash && j.attempts === 0), Object.values(tj).map((j) => j.status).join(","));

const l = await post(intake(`合成測試 ${run} 墾丁`, "合成測試內容三。", 1));
await approve(l.json.content.id);
await prisma.operationsJob.update({ where: { jobId: `${l.json.content.id}:instagram:v1` }, data: { status: "processing", lockedUntil: new Date(Date.now() - 1000), lockOwner: "crashed-host:1:dead", attempts: 1 } });
await due();
const lj = await prisma.operationsJob.findUnique({ where: { jobId: `${l.json.content.id}:instagram:v1` } });
chk("expired lease → submitted_pending_verification, not re-sent", lj.status === "submitted_pending_verification" && lj.attempts === 1, `${lj.status} attempts=${lj.attempts}`);
await prisma.operationsJob.update({ where: { jobId: `${l.json.content.id}:facebook_group:v1` }, data: { status: "manual_required" } });
await due();
const mj = await prisma.operationsJob.findUnique({ where: { jobId: `${l.json.content.id}:facebook_group:v1` } });
chk("manual_required (Facebook group) is never auto-claimed", mj.status === "manual_required", mj.status);

// ---- 3. Left for the scheduled-identity step: one approved content, untouched ----
const sched = await post(intake(`合成測試 ${run} 排程身份`, "合成測試內容 排程。", 2));
await approve(sched.json.content.id);

mkdirSync(stateDir, { recursive: true });
writeFileSync(stateFile, JSON.stringify({
  deployment: BASE,
  at: new Date().toISOString(),
  scheduledContentId: sched.json.content.id,
  contents: [p1.json.content, t.json.content].map((c) => ({ id: c.id, fileName: c.images[0].fileName, sha256: c.images[0].sha256, storageKey: c.images[0].storageKey })),
}, null, 2));
console.log(res.join("\n"));
await prisma.$disconnect();
process.exit(res.some((x) => x.startsWith("FAIL")) ? 1 : 0);
