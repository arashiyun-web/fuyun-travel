// Route-level Instagram OAuth harness against an isolated server whose provider calls are mocked
// (scripts/test-support/ig-provider-mock.cjs). Synthetic data; no Meta contact; live publish off.
// Usage: node scripts/instagram-oauth-e2e-harness.mjs <baseUrl> <adminSecretsDir> <databaseUrl>
import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

const [,, B, secDir, databaseUrl] = process.argv;
const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
const res = [];
const chk = (n, ok, d = "") => res.push(`${ok ? "PASS" : "FAIL"} ${n}${d ? " — " + d : ""}`);
const pw = readFileSync(secDir + "/admin-login.txt", "utf8").match(/密碼: (.+)/)[1].trim();
const user = readFileSync(secDir + "/admin-auth.env", "utf8").match(/^ADMIN_USERNAME=(.+)$/m)[1].trim();
const cookieOf = (response, name) => (response.headers.getSetCookie?.() || []).find((c) => c.startsWith(name + "="));
const cookieValue = (setCookie) => setCookie?.split(";")[0];

await prisma.instagramLoginToken.deleteMany({});

// login sets the HttpOnly session cookie
const login = await fetch(B + "/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username: user, password: pw }) });
const session = cookieOf(login, "fuyun_admin_session");
chk("login returns HttpOnly SameSite=Lax session cookie (Path=/)", login.status === 200 && /HttpOnly/i.test(session || "") && /SameSite=lax/i.test(session || "") && /Path=\//.test(session || ""), session ? session.replace(/=[^;]+/, "=<redacted>") : "none");
const sessionCookie = cookieValue(session);

// OAuth start: unauthenticated → 401; with session cookie → redirect to Instagram + state cookie
const noAuth = await fetch(B + "/api/social/instagram/oauth/start", { redirect: "manual" });
chk("OAuth start without session → 401", noAuth.status === 401, String(noAuth.status));
const start = await fetch(B + "/api/social/instagram/oauth/start", { redirect: "manual", headers: { cookie: sessionCookie } });
const location = start.headers.get("location") || "";
const stateCookie = cookieValue(cookieOf(start, "fuyun_instagram_oauth_state"));
const state = location ? new URL(location).searchParams.get("state") : null;
chk("OAuth start with session cookie → redirect to instagram.com with state", [302, 307].includes(start.status) && location.startsWith("https://www.instagram.com/oauth/authorize") && !!state && !!stateCookie, `${start.status}`);
chk("authorize URL carries no app secret", !location.includes("app-secret-synthetic"));

const status = async () => (await fetch(B + "/api/social/instagram/status", { headers: { cookie: sessionCookie } })).json();
chk("status before authorization → NOT_AUTHORIZED", (await status()).state === "NOT_AUTHORIZED");

// wrong state / cancel / bad code
const wrong = await fetch(`${B}/api/social/instagram/oauth/callback?code=synthetic-good-code&state=${encodeURIComponent(state + "x")}`, { headers: { cookie: stateCookie } });
chk("callback with tampered state → 403", wrong.status === 403, String(wrong.status));
const cancel = await fetch(`${B}/api/social/instagram/oauth/callback?error=access_denied&error_reason=user_denied&state=${encodeURIComponent(state)}`, { headers: { cookie: stateCookie } });
chk("callback after user cancel → 400, nothing stored", cancel.status === 400 && (await prisma.instagramLoginToken.count()) === 0, String(cancel.status));
const badCode = await fetch(`${B}/api/social/instagram/oauth/callback?code=wrong&state=${encodeURIComponent(state)}`, { headers: { cookie: stateCookie } });
const badBody = await badCode.text();
chk("provider rejection → 502 without provider error text", badCode.status === 502 && !badBody.includes("invalid code") && (await prisma.instagramLoginToken.count()) === 0, String(badCode.status));

// success
const ok = await fetch(`${B}/api/social/instagram/oauth/callback?code=synthetic-good-code&state=${encodeURIComponent(state)}`, { headers: { cookie: stateCookie } });
const okBody = await ok.json();
chk("callback success → 200 authorized_token_stored, exact large account id, no token in response", ok.status === 200 && okBody.status === "authorized_token_stored" && okBody.accountId === "17841400000000000123" && !JSON.stringify(okBody).includes("synthetic-long-token"), `${ok.status} ${okBody.accountId}`);
const row = await prisma.instagramLoginToken.findUnique({ where: { slot: "default" } });
chk("token persisted in database, encrypted (no plaintext token)", !!row && row.accountId === "17841400000000000123" && !row.encrypted.includes("synthetic-long-token"));
const st = await status();
chk("status after authorization → AUTHORIZED, live publish off, no secrets", st.state === "AUTHORIZED" && st.livePublishEnabled === false && !JSON.stringify(st).includes("synthetic-long-token"), st.state);

// revoke requires same-origin for cookie auth
const crossRevoke = await fetch(B + "/api/social/instagram/oauth/revoke", { method: "POST", headers: { cookie: sessionCookie, origin: "https://evil.example" } });
chk("cross-origin revoke with cookie → 401", crossRevoke.status === 401, String(crossRevoke.status));
const revoke = await fetch(B + "/api/social/instagram/oauth/revoke", { method: "POST", headers: { cookie: sessionCookie, origin: B } });
chk("same-origin revoke clears stored token", revoke.status === 200 && (await prisma.instagramLoginToken.count()) === 0, String(revoke.status));
chk("status after revoke → NOT_AUTHORIZED", (await status()).state === "NOT_AUTHORIZED");

// logout clears the session cookie
const logout = await fetch(B + "/api/auth/logout", { method: "POST", headers: { cookie: sessionCookie, origin: B } });
const cleared = cookieOf(logout, "fuyun_admin_session");
chk("logout expires the session cookie", logout.status === 200 && /Max-Age=0/i.test(cleared || ""), cleared ? cleared.replace(/=[^;]*/, "=") : "none");
const crossLogout = await fetch(B + "/api/auth/logout", { method: "POST", headers: { origin: "https://evil.example" } });
chk("cross-origin logout → 403", crossLogout.status === 403, String(crossLogout.status));

console.log(res.join("\n"));
await prisma.$disconnect();
