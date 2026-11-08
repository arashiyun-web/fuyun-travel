import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import { scryptSync, randomBytes } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const database = "fuyun_flow_test";
const dbUser = "fuyun_flow";
const dbPassword = "fuyun_flow_only";
const databaseUrl = `postgresql://${dbUser}:${dbPassword}@127.0.0.1:5432/${database}`;
const origin = "http://127.0.0.1:3467";

function psql(sql) {
  execFileSync("sudo", ["-u", "postgres", "psql", "-v", "ON_ERROR_STOP=1", "-c", sql], { stdio: "pipe" });
}

test("login, read, save a draft, and reload it on an isolated database", { timeout: 180000 }, async () => {
  let server;
  try {
  psql(`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${database}' AND pid <> pg_backend_pid();`);
  psql(`DROP DATABASE IF EXISTS ${database};`);
  psql(`DROP USER IF EXISTS ${dbUser};`);
  psql(`CREATE USER ${dbUser} WITH PASSWORD '${dbPassword}' LOGIN;`);
  psql(`CREATE DATABASE ${database} OWNER ${dbUser};`);
  execFileSync("npx", ["prisma", "migrate", "deploy"], {
    cwd: root,
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: "pipe",
  });

  const salt = randomBytes(16).toString("hex");
  const password = "flow-test-pass";
  const hash = scryptSync(password, salt, 64).toString("hex");
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  const quote = await prisma.charterQuote.create({
    data: {
      lineUserId: "line-test-user",
      pickup: "台北車站",
      destination: "九份",
      passengerCount: 6,
      remark: "10小時",
      recommendedVehicle: "賓士小車",
    },
  });
  await prisma.inquiry.create({
    data: {
      customerName: "測試旅客",
      phone: "0912000111",
      tripType: "包車",
      pickupLocation: "台北車站",
      destination: "九份",
      passengerCount: 6,
      preferredVehicle: ["賓士"],
      specialRequests: "10小時",
    },
  });
  await prisma.lineUser.create({
    data: { lineUid: "line-test-user", name: "測試會員", tags: [], orderHistory: [], quoteHistory: [] },
  });
  await prisma.$disconnect();

  const logs = [];
  server = spawn("npx", ["next", "start", "-p", "3467"], {
    cwd: root,
    detached: true,
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
      ADMIN_USERNAME: "flow-admin",
      ADMIN_PASSWORD_SALT: salt,
      ADMIN_PASSWORD_HASH: hash,
      JWT_SECRET: "isolated-flow-test-secret-32chars",
      OPERATIONS_LIVE_PUBLISH_ENABLED: "false",
      LINE_CHANNEL_ACCESS_TOKEN: "",
      NEXT_PUBLIC_SITE_URL: origin,
    },
  });
  server.stdout.on("data", (chunk) => logs.push(String(chunk)));
  server.stderr.on("data", (chunk) => logs.push(String(chunk)));
  {
    for (let attempt = 0; attempt < 40; attempt += 1) {
      try {
        const ping = await fetch(`${origin}/admin/quotes`);
        if (ping.status === 200) break;
      } catch {
        // server still starting
      }
      if (attempt === 39) throw new Error(`server did not start: ${logs.join("").slice(-500)}`);
      await delay(250);
    }

    const anonymousQuotes = await fetch(`${origin}/admin/quotes`);
    const anonymousHtml = await anonymousQuotes.text();
    assert.match(anonymousHtml, /請先到/);
    assert.match(anonymousHtml, /登入/);
    assert.equal(anonymousHtml.includes("目前沒有詢價資料"), false);
    assert.equal(anonymousHtml.includes("台北車站"), false);

    const anonymousInquiries = await fetch(`${origin}/admin/inquiries`);
    const inquiryHtml = await anonymousInquiries.text();
    assert.match(inquiryHtml, /讀取中/);
    assert.equal(inquiryHtml.includes("目前沒有網站詢價"), false);

    const anonymousApi = await fetch(`${origin}/api/admin/quotes/${quote.id}`);
    const anonymousApiBody = await anonymousApi.json();
    assert.equal(anonymousApi.status, 401);
    assert.match(anonymousApiBody.error, /請先到 \/admin 登入/);

    const login = await fetch(`${origin}/api/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json", origin },
      body: JSON.stringify({ username: "flow-admin", password }),
    });
    const loginBody = await login.json();
    assert.equal(login.status, 200);
    assert.equal(typeof loginBody.token, "string");
    const cookie = login.headers.get("set-cookie") || "";
    assert.match(cookie, /fuyun_admin_session=/);
    const session = cookie.split(";")[0];

    const byCookie = await fetch(`${origin}/api/inquiry`, { headers: { cookie: session } });
    const cookieInquiries = await byCookie.json();
    assert.equal(byCookie.status, 200);
    assert.equal(cookieInquiries.inquiries.some((item) => item.name === "測試旅客" && item.pickup_location === "台北車站"), true);

    const byBearer = await fetch(`${origin}/api/admin/quotes`, { headers: { authorization: `Bearer ${loginBody.token}` } });
    const bearerQuotes = await byBearer.json();
    assert.equal(byBearer.status, 200);
    assert.equal(bearerQuotes.quotes.some((item) => item.id === quote.id), true);

    const quotesPage = await fetch(`${origin}/admin/quotes`, { headers: { cookie: session } });
    const quotesHtml = await quotesPage.text();
    assert.match(quotesHtml, /台北車站/);
    assert.match(quotesHtml, /九份/);
    assert.equal(quotesHtml.includes("請先到"), false);

    const draft = await fetch(`${origin}/api/admin/quotes/${quote.id}/draft`, {
      method: "POST",
      headers: { cookie: session, origin, "content-type": "application/json" },
      body: JSON.stringify({ vehicleHint: "賓士小車" }),
    });
    const draftBody = await draft.json();
    assert.equal(draft.status, 200);
    assert.equal(draftBody.amountTwd, 7000);
    assert.equal(draftBody.sendsToCustomer, false);
    assert.match(draftBody.quote.quoteDraftText, /含油資、過路費、停車費/);

    const reloaded = await fetch(`${origin}/api/admin/quotes/${quote.id}`, { headers: { authorization: `Bearer ${loginBody.token}` } });
    const reloadedBody = await reloaded.json();
    assert.equal(reloaded.status, 200);
    assert.match(reloadedBody.quote.quoteDraftText, /7000 元/);
    assert.match(reloadedBody.quote.quoteDraftText, /基本車資/);
    assert.match(reloadedBody.quote.quoteDraftText, /不是總價/);

    const members = await fetch(`${origin}/api/admin/members`, { headers: { cookie: session } });
    const membersBody = await members.json();
    assert.equal(members.status, 200);
    assert.equal(membersBody.orderTable, false);
    assert.equal(membersBody.members.some((item) => item.name === "測試會員" && item.orderCount === 0), true);

    const logText = logs.join("");
    assert.equal(logText.includes("api.line.me"), false);
    assert.equal(logText.includes(password), false);
    assert.equal(logText.includes(hash), false);
  }
  } finally {
    if (server?.pid) {
      try { process.kill(-server.pid, "SIGTERM"); } catch { server.kill("SIGTERM"); }
    }
    await delay(400);
    psql(`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${database}' AND pid <> pg_backend_pid();`);
    psql(`DROP DATABASE IF EXISTS ${database};`);
    psql(`DROP USER IF EXISTS ${dbUser};`);
  }
});
