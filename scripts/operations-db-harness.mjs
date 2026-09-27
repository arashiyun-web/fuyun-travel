// Isolated database-mode harness for the operations backend (no external publishing).
// Requires: two `next start` instances (A, B) in OPERATIONS_PERSISTENCE_MODE=database sharing an
// isolated Postgres (DATABASE_URL) and S3-compatible store, plus instance C (mode unset) and
// instance D (VERCEL=1, mode=file) for fail-closed checks. Synthetic data only.
// Usage: node scripts/operations-db-harness.mjs <A> <B> <C> <D> <adminSecretsDir> <cronToken> <workerScript>
import { readFileSync } from "node:fs";
import { execFile } from "node:child_process";
import { PrismaClient } from "@prisma/client";

const [,, A, B, C, D, secDir, cron, workerScript] = process.argv;
const prisma = new PrismaClient();
const res = [];
const chk = (n, ok, d = "") => res.push(`${ok ? "PASS" : "FAIL"} ${n}${d ? " — " + d : ""}`);
const pw = readFileSync(secDir + "/admin-login.txt", "utf8").match(/密碼: (.+)/)[1].trim();
const user = readFileSync(secDir + "/admin-auth.env", "utf8").match(/^ADMIN_USERNAME=(.+)$/m)[1].trim();

async function login(base) {
  const r = await fetch(base + "/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username: user, password: pw }) });
  return (await r.json()).token;
}
const { default: sharp } = await import("sharp");
const pngCache = new Map();
async function makePng(seed) {
  if (!pngCache.has(seed)) {
    const buf = await sharp({ create: { width: 2, height: 2, channels: 3, background: { r: (seed * 70) % 256, g: 120, b: 200 } } }).png().toBuffer();
    pngCache.set(seed, "data:image/png;base64," + buf.toString("base64"));
  }
  return pngCache.get(seed);
}
for (const s of [0, 1, 2]) await makePng(s);
const png = (seed) => pngCache.get(seed % 3);
const intake = (title, body, seed = 0) => ({ title, type: "招生", tripDate: "2030-11-20", body, selectedPlatforms: ["website", "facebook_group", "instagram"], images: [{ dataUrl: png(seed), originalName: "synthetic.png" }] });

const tA = await login(A);
const tB = await login(B);
chk("admin login on instance A and B", !!tA && !!tB);
const H = (t) => ({ authorization: `Bearer ${t}`, "content-type": "application/json" });
const post = (base, t, b) => fetch(base + "/api/operations/content", { method: "POST", headers: H(t), body: JSON.stringify(b) }).then(async (r) => ({ status: r.status, json: await r.json() }));
const approve = (base, t, id, extra = {}) => fetch(`${base}/api/operations/content/${id}/approve`, { method: "POST", headers: H(t), body: JSON.stringify(extra) }).then(async (r) => ({ status: r.status, json: await r.json() }));
const due = (base) => fetch(base + "/api/operations/process-due", { method: "POST", headers: { authorization: `Bearer ${cron}` } }).then((r) => r.json());
const claims = async (contentId) => {
  const ev = await prisma.operationsEvent.findMany({ where: { contentId, type: "job_claimed" } });
  const per = {};
  for (const e of ev) per[e.jobId] = (per[e.jobId] || 0) + 1;
  return per;
};

// 1. concurrent identical intake on two instances → one record
const [p1, p2] = await Promise.all([post(A, tA, intake("合成測試 資料庫 阿里山", "合成測試內容。", 0)), post(B, tB, intake("合成測試 資料庫 阿里山", "合成測試內容。", 0))]);
const id1 = p1.json.content?.id;
chk("concurrent identical intake on A and B → same content id", p1.status === 201 && id1 && id1 === p2.json.content?.id, `${p1.status}/${p2.status} ${id1} ${p2.json.content?.id}`);
chk("exactly one content row and three job rows", (await prisma.operationsContent.count({ where: { contentFingerprint: p1.json.content?.contentFingerprint } })) === 1 && (await prisma.operationsJob.count({ where: { contentId: id1 } })) === 3);

// 2. image stored privately, retrievable through the admin route with matching checksum
const img = p1.json.content.images[0];
const ir = await fetch(`${B}/api/operations/content/${id1}/images/${img.fileName}`, { headers: { authorization: `Bearer ${tB}` } });
const buf = Buffer.from(await ir.arrayBuffer());
const { createHash } = await import("node:crypto");
chk("image read back via instance B matches stored sha256", ir.status === 200 && createHash("sha256").update(buf).digest("hex") === img.sha256, String(ir.status));
const anon = await fetch(`${A}/api/operations/content/${id1}/images/${img.fileName}`);
chk("image route without auth → 401 (objects are private)", anon.status === 401, String(anon.status));
chk("image record has private storage keys, no public URL", !!img.storageKey && !img.publicUrl && !!img.instagramStorageKey);

// 3. fact check gates approval
const bad = await post(A, tA, intake("合成測試 資料庫 定價", "每人只要 9,999 元，含住宿與早餐。", 1));
const refuse = await approve(A, tA, bad.json.content.id);
chk("approval refused while fact check fails (no acknowledgement)", refuse.status === 400 && /事實檢查/.test(refuse.json.error || ""), String(refuse.status));
const ack = await approve(A, tA, bad.json.content.id, { acknowledgeFactWarnings: true });
const ackEvent = await prisma.operationsEvent.count({ where: { contentId: bad.json.content.id, type: "fact_warnings_acknowledged" } });
chk("explicit acknowledgement approves and is recorded", ack.status === 200 && ackEvent === 1);

// 4. approve on B, then three concurrent process-due calls across A and B
const ap = await approve(B, tB, id1);
chk("approval stores approval hash on every job", ap.status === 200 && Object.values(ap.json.content.platforms).every((j) => /^[0-9a-f]{64}$/.test(j.approvalHash || "")));
await Promise.all([due(A), due(B), due(A)]);
const per1 = await claims(id1);
chk("three concurrent process-due on two instances → each job claimed exactly once", Object.keys(per1).length === 3 && Object.values(per1).every((n) => n === 1), JSON.stringify(per1));
const jobs1 = await prisma.operationsJob.findMany({ where: { contentId: id1 } });
chk("all jobs dry_run_verified, none published, locks released", jobs1.every((j) => j.status === "dry_run_verified" && !j.externalId && !j.lockOwner && !j.lockedUntil));
await Promise.all([due(A), due(B)]);
chk("re-run after completion claims nothing (no resend)", Object.values(await claims(id1)).reduce((a, b) => a + b, 0) === 3);

// 5. two worker processes on different "hosts" (separate lock files) → DB guarantees single claim
const w = await post(A, tA, intake("合成測試 資料庫 雙 worker", "合成測試內容 worker。", 2));
await approve(A, tA, w.json.content.id);
const runWorker = (base, lock) => new Promise((resolve) => execFile(process.execPath, [workerScript], { env: { ...process.env, OPERATIONS_AGENT_BASE_URL: base, OPERATIONS_CRON_TOKEN: cron, OPERATIONS_WORKER_LOCK: lock, OPERATIONS_DATA_DIR: lock + ".d" } }, (err) => resolve(err ? err.code : 0)));
const codes = await Promise.all([runWorker(A, process.env.TEMP + "/w1.lock"), runWorker(B, process.env.TEMP + "/w2.lock")]);
const perW = await claims(w.json.content.id);
chk("two workers on separate hosts/locks → each job claimed exactly once", Object.keys(perW).length === 3 && Object.values(perW).every((n) => n === 1), `codes ${codes} ${JSON.stringify(perW)}`);

// 6. tamper after approval → approval withdrawn; sibling jobs not run
const t = await post(A, tA, intake("合成測試 資料庫 日月潭", "合成測試內容二。", 0));
await approve(A, tA, t.json.content.id);
await prisma.operationsJob.update({ where: { jobId: `${t.json.content.id}:instagram:v1` }, data: { caption: "核准後被改的 caption" } });
await due(B);
const tJobs = Object.fromEntries((await prisma.operationsJob.findMany({ where: { contentId: t.json.content.id } })).map((j) => [j.platform, j]));
const tContent = await prisma.operationsContent.findUnique({ where: { id: t.json.content.id } });
chk("caption changed after approval → approval invalidated, IG job not run", tJobs.instagram.status === "pending_approval" && !tJobs.instagram.approvalHash && tContent.approvalStatus === "pending", `${tJobs.instagram.status}/${tContent.approvalStatus}`);
chk("sibling jobs of the invalidated content are not run (returned to pending_approval)", ["website", "facebook_group"].every((p) => tJobs[p].status === "pending_approval" && !tJobs[p].approvalHash && tJobs[p].attempts === 0), ["website", "facebook_group"].map((p) => tJobs[p].status).join(","));

// 7. expired lease (crash mid-publish) → parked for reconciliation, never re-run
const l = await post(A, tA, intake("合成測試 資料庫 墾丁", "合成測試內容三。", 1));
await approve(A, tA, l.json.content.id);
await prisma.operationsJob.update({ where: { jobId: `${l.json.content.id}:instagram:v1` }, data: { status: "processing", lockedUntil: new Date(Date.now() - 1000), lockOwner: "crashed-host:1:dead", attempts: 1 } });
await due(A);
await due(B);
const lj = await prisma.operationsJob.findUnique({ where: { jobId: `${l.json.content.id}:instagram:v1` } });
chk("expired lease → submitted_pending_verification, attempts unchanged", lj.status === "submitted_pending_verification" && lj.attempts === 1 && !lj.lockOwner, `${lj.status} attempts=${lj.attempts}`);
const others = await prisma.operationsJob.findMany({ where: { contentId: l.json.content.id, platform: { in: ["website", "facebook_group"] } } });
chk("other platforms of that content processed once", others.every((j) => j.status === "dry_run_verified" && j.attempts === 1));

// 8. manual_required is not auto-claimed
await prisma.operationsJob.update({ where: { jobId: `${l.json.content.id}:facebook_group:v1` }, data: { status: "manual_required" } });
await due(A);
const mj = await prisma.operationsJob.findUnique({ where: { jobId: `${l.json.content.id}:facebook_group:v1` } });
chk("manual_required job is not auto-claimed by process-due", mj.status === "manual_required" && mj.attempts === 1, `${mj.status} attempts=${mj.attempts}`);

// 9. fail closed
const c1 = await post(C, await login(C), intake("合成測試 未設定", "x", 0));
chk("instance with persistence mode unset → intake 503 with safe diagnostic", c1.status === 503 && c1.json.storage?.reason && !JSON.stringify(c1.json).match(/postgres|password|secret/i), `${c1.status} ${JSON.stringify(c1.json.storage)}`);
const d1 = await post(D, await login(D), intake("合成測試 serverless file", "x", 0));
chk("serverless (VERCEL=1) with file mode → intake 503", d1.status === 503 && /serverless/.test(d1.json.storage?.reason || ""), `${d1.status} ${d1.json.storage?.reason}`);
const pub = await fetch(C + "/");
chk("public site still serves while operations storage is unavailable", pub.status === 200, String(pub.status));

console.log(res.join("\n"));
await prisma.$disconnect();
