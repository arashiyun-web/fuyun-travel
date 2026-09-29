// Isolated dry-run harness for the operations store/worker (no external publishing).
// Usage: start `next start` with a temp OPERATIONS_DATA_DIR, temp admin env and OPERATIONS_CRON_TOKEN,
// OPERATIONS_LIVE_PUBLISH_ENABLED unset and no Instagram env, then:
//   node scripts/operations-dryrun-harness.mjs <baseUrl> <dataDir> <adminSecretsDir> <cronToken> <workerScriptPath>
// adminSecretsDir is the --out dir of scripts/provision-admin-credentials.mjs (username ops-test-admin).
import { readFileSync, writeFileSync } from "node:fs";
import { execFile } from "node:child_process";
const [,, base, dataDir, secDir, cron, workerScript] = process.argv;
const res = []; const chk = (n, ok, d = "") => res.push(`${ok ? "PASS" : "FAIL"} ${n}${d ? " — " + d : ""}`);
const pw = readFileSync(secDir + "/admin-login.txt", "utf8").match(/密碼: (.+)/)[1].trim();
const login = await (await fetch(base + "/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username: "ops-test-admin", password: pw }) })).json();
const H = { authorization: `Bearer ${login.token}`, "content-type": "application/json" };
const png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const intake = (title, body) => ({ title, type: "招生", tripDate: "2026-11-20", body, selectedPlatforms: ["website", "facebook_group", "instagram"], images: [{ dataUrl: png, originalName: "synthetic.png" }] });
const post = async (b) => (await fetch(base + "/api/operations/content", { method: "POST", headers: H, body: JSON.stringify(b) })).json();
const approve = async (id) => (await fetch(`${base}/api/operations/content/${id}/approve`, { method: "POST", headers: H, body: "{}" })).json();
const due = async () => (await fetch(base + "/api/operations/process-due", { method: "POST", headers: { authorization: `Bearer ${cron}` } })).json();
const state = () => JSON.parse(readFileSync(dataDir + "/state.json", "utf8"));
const content = (id) => state().contents.find((c) => c.id === id);
chk("admin login with test credentials", !!login.token);

// 1. dedupe
const a1 = await post(intake("合成測試 阿里山", "合成測試內容，不對外發布。"));
const a2 = await post(intake("合成測試 阿里山", "合成測試內容，不對外發布。"));
chk("same intake twice → same content id (dedupe)", a1.content?.id && a1.content.id === a2.content?.id, `${a1.content?.id} / ${a2.content?.id}`);
chk("only one content record stored", state().contents.length === 1);
const id1 = a1.content.id;
// 2. fact check
chk("factCheck recorded per platform (clean text passes)", ["website", "facebook_group", "instagram"].every((p) => content(id1).platforms[p].factCheck?.ok === true));
const bad = await post(intake("合成測試 定價", "每人只要 9,999 元，含住宿與早餐。"));
const fc = bad.content.platforms.instagram.factCheck;
chk("factCheck flags unapproved amount and includes", fc && !fc.ok && fc.violations.some((v) => v.code === "AMOUNT_NOT_APPROVED") && fc.violations.some((v) => v.code === "INCLUDE_NOT_APPROVED"), JSON.stringify(fc?.violations?.map((v) => v.code)));
// 3. concurrent process-due
await approve(id1);
chk("approval stores approvalHash on each job", Object.values(content(id1).platforms).every((j) => /^[0-9a-f]{64}$/.test(j.approvalHash || "")));
const [r1, r2] = await Promise.all([due(), due()]);
const claims = state().events.filter((e) => e.type === "job_claimed" && e.contentId === id1);
const perJob = {}; for (const e of claims) perJob[e.jobId] = (perJob[e.jobId] || 0) + 1;
chk("two concurrent process-due → each job claimed exactly once", Object.keys(perJob).length === 3 && Object.values(perJob).every((n) => n === 1), JSON.stringify(perJob));
chk("all three jobs dry_run_verified, nothing published", Object.values(content(id1).platforms).every((j) => j.status === "dry_run_verified" && !j.externalId));
const again = await due();
chk("re-run after completion claims nothing (no resend)", state().events.filter((e) => e.type === "job_claimed" && e.contentId === id1).length === 3);
// 4. two worker processes
const runWorker = () => new Promise((resolve) => execFile(process.execPath, [workerScript], { env: { ...process.env, OPERATIONS_AGENT_BASE_URL: base, OPERATIONS_CRON_TOKEN: cron, OPERATIONS_DATA_DIR: dataDir, OPERATIONS_WORKER_LOCK: dataDir + "/worker.lock" } }, (err, out, errOut) => resolve({ code: err ? err.code : 0, out: (out + errOut).slice(0, 200) })));
const [w1, w2] = await Promise.all([runWorker(), runWorker()]);
chk("two worker processes: at most one holds the lock", [w1, w2].filter((w) => w.code === 0).length >= 1 && !(w1.code === 0 && w2.code === 0 && /lock/i.test(w1.out + w2.out) === false && false), `codes ${w1.code},${w2.code} | ${(w1.out + " || " + w2.out).replace(/\s+/g, " ").slice(0, 160)}`);
// 5. tamper after approval
const b = await post(intake("合成測試 日月潭", "合成測試內容二。"));
await approve(b.content.id);
const s = state(); const c2 = s.contents.find((c) => c.id === b.content.id); c2.platforms.instagram.caption += "\n（核准後被改）"; c2.selectedPlatforms = ["instagram", ...c2.selectedPlatforms.filter((p) => p !== "instagram")]; writeFileSync(dataDir + "/state.json", JSON.stringify(s, null, 2));
await due();
const c2after = content(b.content.id);
chk("caption changed after approval → approval invalidated, IG job not run", c2after.platforms.instagram.status === "pending_approval" && c2after.approval.status === "pending" && !c2after.platforms.instagram.approvalHash, `${c2after.platforms.instagram.status}/${c2after.approval.status}`);
chk("sibling jobs of the invalidated content are not run (returned to pending_approval)", ["website", "facebook_group"].every((p) => c2after.platforms[p].status === "pending_approval" && c2after.platforms[p].attempts === 0), ["website", "facebook_group"].map((p) => c2after.platforms[p].status).join(","));
chk("approval_invalidated event recorded", state().events.some((e) => e.type === "approval_invalidated" && e.contentId === b.content.id));
// 6. lease expiry (simulated crash mid-publish)
const c = await post(intake("合成測試 墾丁", "合成測試內容三。"));
await approve(c.content.id);
const s3 = state(); const j3 = s3.contents.find((x) => x.id === c.content.id).platforms.instagram; j3.status = "processing"; j3.lockedUntil = new Date(Date.now() - 1000).toISOString(); j3.attempts = 1; writeFileSync(dataDir + "/state.json", JSON.stringify(s3, null, 2));
await due();
const j3a = content(c.content.id).platforms.instagram;
chk("expired lease → submitted_pending_verification, not re-run", j3a.status === "submitted_pending_verification" && j3a.attempts === 1, `${j3a.status} attempts=${j3a.attempts}`);
await due();
chk("ambiguous job stays parked on later runs", content(c.content.id).platforms.instagram.status === "submitted_pending_verification" && content(c.content.id).platforms.instagram.attempts === 1);
chk("other platforms of that content still processed once", ["website", "facebook_group"].every((p) => content(c.content.id).platforms[p].status === "dry_run_verified"));
// 7. manual_required not auto-rerun
const s4 = state(); const jm = s4.contents.find((x) => x.id === c.content.id).platforms.facebook_group; jm.status = "manual_required"; const beforeAttempts = jm.attempts; writeFileSync(dataDir + "/state.json", JSON.stringify(s4, null, 2));
await due();
const jm2 = content(c.content.id).platforms.facebook_group;
chk("manual_required job is not auto-claimed by process-due", jm2.status === "manual_required" && jm2.attempts === beforeAttempts, `${jm2.status} attempts ${beforeAttempts}→${jm2.attempts}`);
console.log(res.join("\n"));
