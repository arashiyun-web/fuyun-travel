// Local end-to-end check of automatic website publishing, fully isolated (throwaway PostgreSQL on
// 127.0.0.1, S3 mock, one `next start` in live mode). Nothing points at production.
//   npx next build && node scripts/test-support/website-publish-e2e.mjs <workDir>
// Flow: intake (2 photos, website + instagram + facebook_group) → approve → the real worker script runs
// process-due → website article is public with the approved text and photos (read back) → IG waits for
// authorization, FB group stays manual → a second worker run publishes nothing twice → takedown works.
import { spawn, spawnSync, execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, openSync } from "node:fs";
import { createHash, randomBytes } from "node:crypto";
import path from "node:path";
import sharp from "sharp";

const workDir = path.resolve(process.argv[2] || "C:/fuyun-release/website-e2e");
const PG = path.join(process.env.USERPROFILE, ".fuyun-tools", "pgsql-17", "pgsql", "bin");
const PORT = 3260, PG_PORT = 55434, S3_PORT = 9110;
const BASE = `http://127.0.0.1:${PORT}`;
const DB = `postgresql://tester@127.0.0.1:${PG_PORT}/webtest`;
const res = [];
const chk = (n, ok, d = "") => res.push(`${ok ? "PASS" : "FAIL"} ${n}${d !== "" ? " — " + d : ""}`);
const sha = (b) => createHash("sha256").update(b).digest("hex");
const procs = [];

rmSync(workDir, { recursive: true, force: true });
mkdirSync(workDir, { recursive: true });
const run = (exe, args, opts = {}) => execFileSync(exe, args, { stdio: "ignore", ...opts });
run(path.join(PG, "initdb.exe"), ["-D", path.join(workDir, "pg"), "-U", "tester", "--auth=trust", "-E", "UTF8", "--no-locale"]);
spawnSync(path.join(PG, "pg_ctl.exe"), ["-D", path.join(workDir, "pg"), "-o", `-c listen_addresses=127.0.0.1 -p ${PG_PORT}`, "-l", path.join(workDir, "pg.log"), "-w", "start"], { stdio: "ignore" });
try {
  run(path.join(PG, "psql.exe"), ["-h", "127.0.0.1", "-p", String(PG_PORT), "-U", "tester", "-d", "postgres", "-qc", "create database webtest"]);
  spawnSync("npx", ["prisma", "migrate", "deploy"], { shell: true, stdio: "ignore", env: { ...process.env, DATABASE_URL: DB } });

  const sec = path.join(workDir, "sec");
  run(process.execPath, ["scripts/provision-admin-credentials.mjs", "--username", "web-e2e", "--out", sec, "--force"]);
  const admin = Object.fromEntries(readFileSync(path.join(sec, "admin-auth.env"), "utf8").split("\n").filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]));
  const password = readFileSync(path.join(sec, "admin-login.txt"), "utf8").match(/密碼: (\S+)/)[1];
  const cron = randomBytes(24).toString("hex");
  const env = { ...process.env, ...admin, NODE_ENV: "production", DATABASE_URL: DB, OPERATIONS_PERSISTENCE_MODE: "database", OPERATIONS_LIVE_PUBLISH_ENABLED: "true", OPERATIONS_CRON_TOKEN: cron, NEXT_PUBLIC_SITE_URL: BASE,
    R2_ACCOUNT_ID: "local-test", R2_ACCESS_KEY_ID: "test-access", R2_SECRET_ACCESS_KEY: "test-secret", R2_BUCKET_NAME: "ops-test", R2_ENDPOINT: `http://127.0.0.1:${S3_PORT}` };
  for (const k of ["VERCEL", "OPERATIONS_DATA_DIR", "OPERATIONS_INSTAGRAM_V2_ENABLED", "INSTAGRAM_LOGIN_ACCESS_TOKEN"]) delete env[k];
  const start = (name, args) => {
    const log = openSync(path.join(workDir, `${name}.log`), "a");
    const child = spawn(process.execPath, args, { env, stdio: ["ignore", log, log], windowsHide: true });
    procs.push(child);
  };
  start("s3", ["scripts/test-support/s3-mock.mjs", String(S3_PORT), path.join(workDir, "s3")]);
  start("next", ["node_modules/next/dist/bin/next", "start", "-p", String(PORT)]);
  for (let i = 0; i < 60; i += 1) { try { if ((await fetch(`${BASE}/`)).ok) break; } catch {} await new Promise((r) => setTimeout(r, 1000)); }

  const f = (p, init = {}) => fetch(BASE + p, { redirect: "manual", ...init });
  const login = await f("/api/auth/login", { method: "POST", headers: { "content-type": "application/json", origin: BASE }, body: JSON.stringify({ username: "web-e2e", password }) });
  const token = (await login.json()).token;
  const H = { authorization: `Bearer ${token}`, "content-type": "application/json" };
  const jpeg = await sharp({ create: { width: 40, height: 30, channels: 3, background: { r: 200, g: 120, b: 40 } } }).jpeg().toBuffer();
  const png = await sharp({ create: { width: 30, height: 40, channels: 3, background: { r: 20, g: 120, b: 200 } } }).png().toBuffer();
  const body = "第一天：阿里山看日出 & 走神木步道。\n第二天：奮起湖老街 <便當> 午餐。";
  const intake = await (await f("/api/operations/content", { method: "POST", headers: H, body: JSON.stringify({ title: "E2E 阿里山日出二日", type: "招生", tripDate: "2030-11-20", body, selectedPlatforms: ["website", "instagram", "facebook_group"], images: [{ dataUrl: `data:image/jpeg;base64,${jpeg.toString("base64")}`, originalName: "sunrise.jpg" }, { dataUrl: `data:image/png;base64,${png.toString("base64")}`, originalName: "street.png" }] }) })).json();
  const content = intake.content;
  chk("intake stored with 2 photos and 3 platform jobs", !!content?.id && content.images.length === 2 && content.selectedPlatforms.length === 3);
  const approve = await f(`/api/operations/content/${content.id}/approve`, { method: "POST", headers: H, body: "{}" });
  chk("owner approval recorded", approve.status === 200, String(approve.status));

  const worker = () => spawnSync(process.execPath, ["scripts/operations-worker.mjs"], { encoding: "utf8", env: { ...process.env, OPERATIONS_AGENT_BASE_URL: BASE, OPERATIONS_CRON_TOKEN: cron, OPERATIONS_WORKER_LOCK: path.join(workDir, "worker.lock"), OPERATIONS_WORKER_ENV_FILE: path.join(workDir, "none.env") } });
  const w1 = worker();
  chk("scheduled worker run (one-shot) exits 0", w1.status === 0, (w1.stdout + w1.stderr).trim().split("\n").pop());
  const after = (await (await f(`/api/operations/content/${content.id}`, { headers: H })).json()).content;
  const web = after.platforms.website;
  chk("website job published with article id and public URL", web.status === "published" && !!web.externalId && /\/travel\/trip-/.test(web.postUrl || ""), `${web.status} ${web.postUrl}`);
  chk("instagram waits for authorization, nothing sent", after.platforms.instagram.status === "awaiting_auth", after.platforms.instagram.status);
  chk("facebook group stays manual (no fake automation)", after.platforms.facebook_group.status === "manual_required", after.platforms.facebook_group.status);

  const page = await fetch(web.postUrl);
  const html = await page.text();
  const slug = new URL(web.postUrl).pathname.split("/").pop();
  chk("public article page 200 with title and approved text (line breaks kept)", page.status === 200 && html.includes("E2E 阿里山日出二日") && html.includes("第一天：阿里山看日出 &amp; 走神木步道。") && html.includes("奮起湖老街 &lt;便當&gt; 午餐"), String(page.status));
  const i1 = Buffer.from(await (await fetch(`${BASE}/travel-media/${slug}/1`)).arrayBuffer());
  const i2r = await fetch(`${BASE}/travel-media/${slug}/2`);
  const i2 = Buffer.from(await i2r.arrayBuffer());
  chk("both public photos served from permanent URLs with the approved bytes", sha(i1) === sha(jpeg) && sha(i2) === sha(png) && i2r.headers.get("content-type") === "image/png");
  chk("public photo URL is not a signed/expiring URL", !/X-Amz|Signature|Expires/i.test(html));
  chk("unlisted index → 404", (await fetch(`${BASE}/travel-media/${slug}/3`)).status === 404);
  chk("draft photos stay behind admin auth", (await f(`/api/operations/content/${content.id}/images/${content.images[0].fileName}`)).status === 401);
  // /travel is a static exploration page; published articles are listed through the sitemap and RSS feed.
  chk("article listed in sitemap.xml and rss.xml", (await (await fetch(`${BASE}/sitemap.xml`)).text()).includes(`/travel/${slug}`) && (await (await fetch(`${BASE}/rss.xml`)).text()).includes(`/travel/${slug}`));

  const w2 = worker();
  const again = (await (await f(`/api/operations/content/${content.id}`, { headers: H })).json()).content;
  const listing = await (await f(`/api/admin/trip-publisher?slug=${slug}`, { headers: { authorization: `Bearer ${token}` } })).json();
  chk("second worker run publishes nothing twice (same job, same article, still published)", w2.status === 0 && again.platforms.website.status === "published" && again.platforms.website.externalId === web.externalId && again.platforms.website.attempts === web.attempts && listing.slugState === "published");

  const wd = await f(`/api/operations/jobs/${encodeURIComponent(web.jobId)}/withdraw`, { method: "POST", headers: H, body: "{}" });
  const wdJob = (await wd.json()).job;
  chk("takedown → job withdrawn", wd.status === 200 && wdJob?.status === "withdrawn", String(wd.status));
  await new Promise((r) => setTimeout(r, 500));
  chk("after takedown the page and photos are gone", (await fetch(web.postUrl)).status === 404 && (await fetch(`${BASE}/travel-media/${slug}/1`)).status === 404);
  const w3 = worker();
  const final = (await (await f(`/api/operations/content/${content.id}`, { headers: H })).json()).content;
  chk("worker never re-publishes a withdrawn article", w3.status === 0 && final.platforms.website.status === "withdrawn" && (await fetch(web.postUrl)).status === 404);
} finally {
  for (const p of procs) { try { process.kill(p.pid); } catch {} }
  spawnSync(path.join(PG, "pg_ctl.exe"), ["-D", path.join(workDir, "pg"), "-m", "fast", "-w", "stop"], { stdio: "ignore" });
  console.log(res.join("\n"));
  process.exitCode = res.length && res.every((l) => l.startsWith("PASS")) ? 0 : 1;
}
