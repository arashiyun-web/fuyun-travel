// Route-level check of quote/analytics admin auth after the URL-token migration.
// Isolated server + isolated DB, synthetic quote only. The send-to-LINE route is only
// exercised on its rejection paths (a success would push a real LINE message).
// Usage: node scripts/admin-quotes-auth-harness.mjs <baseUrl> <adminSecretsDir> <accessToken>
import { readFileSync } from "node:fs";

const [,, B, secDir, accessToken] = process.argv;
const res = [];
const chk = (n, ok, d = "") => res.push(`${ok ? "PASS" : "FAIL"} ${n}${d ? " — " + d : ""}`);
const pw = readFileSync(secDir + "/admin-login.txt", "utf8").match(/密碼: (.+)/)[1].trim();
const user = readFileSync(secDir + "/admin-auth.env", "utf8").match(/^ADMIN_USERNAME=(.+)$/m)[1].trim();
const login = await fetch(B + "/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username: user, password: pw }) });
const cookie = (login.headers.getSetCookie?.() || []).find((c) => c.startsWith("fuyun_admin_session="))?.split(";")[0];
chk("admin login sets session cookie", login.status === 200 && !!cookie);
const code = async (path, init = {}) => (await fetch(B + path, { redirect: "manual", ...init })).status;
const ID = "synthetic-quote-auth-test";

chk("GET /api/admin/quotes with ?admin_token= only → 401", (await code(`/api/admin/quotes?admin_token=${encodeURIComponent(accessToken)}`)) === 401);
chk("GET /api/admin/analytics with ?admin_token= only → 401", (await code(`/api/admin/analytics?admin_token=${encodeURIComponent(accessToken)}`)) === 401);
chk("GET /api/admin/quotes with ADMIN_ACCESS_TOKEN header → 200", (await code("/api/admin/quotes", { headers: { authorization: `Bearer ${accessToken}` } })) === 200);
chk("GET /api/admin/quotes with wrong bearer → 401", (await code("/api/admin/quotes", { headers: { authorization: "Bearer wrong" } })) === 401);
chk("GET /api/admin/quotes with session cookie → 200", (await code("/api/admin/quotes", { headers: { cookie } })) === 200);
chk("GET /api/admin/quotes/[id] with session cookie → 200", (await code(`/api/admin/quotes/${ID}`, { headers: { cookie } })) === 200);

const patch = (headers) => code(`/api/admin/quotes/${ID}`, { method: "PATCH", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify({ quoteDraftText: "合成測試報價草稿", quoteStatus: "draft" }) });
chk("PATCH quote with cookie from another origin → 401", (await patch({ cookie, origin: "https://evil.example" })) === 401);
chk("PATCH quote with cookie and no Origin/Referer → 401", (await patch({ cookie })) === 401);
chk("PATCH quote with ?admin_token= only → 401", (await code(`/api/admin/quotes/${ID}?admin_token=${encodeURIComponent(accessToken)}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: "{}" })) === 401);
chk("PATCH quote same-origin with cookie → 200", (await patch({ cookie, origin: B })) === 200);
chk("POST send with cookie from another origin → 401 (no LINE push)", (await code(`/api/admin/quotes/${ID}/send`, { method: "POST", headers: { cookie, origin: "https://evil.example" } })) === 401);
chk("POST send with ?admin_token= only → 401 (no LINE push)", (await code(`/api/admin/quotes/${ID}/send?admin_token=${encodeURIComponent(accessToken)}`, { method: "POST" })) === 401);

const page = async (path, headers = {}) => { const r = await fetch(B + path, { headers }); return { status: r.status, html: await r.text() }; };
const listNoAuth = await page("/admin/quotes");
chk("/admin/quotes without session shows login notice, no data", listNoAuth.html.includes("請先在") && !listNoAuth.html.includes("合成測試地點"));
const legacyHop = await fetch(`${B}/admin/quotes?admin_token=${encodeURIComponent(accessToken)}`, { redirect: "manual" });
chk("legacy ?admin_token= link is redirected to a URL without the token", [307, 308, 302, 303].includes(legacyHop.status) && !(legacyHop.headers.get("location") || "").includes(accessToken), `${legacyHop.status} ${legacyHop.headers.get("location")}`);
const legacyLocation = legacyHop.headers.get("location") || "/admin/quotes?legacy=1";
const listLegacy = await page(new URL(legacyLocation, B).pathname + new URL(legacyLocation, B).search);
chk("/admin/quotes with legacy ?admin_token= is not authorised and shows notice", listLegacy.html.includes("舊的 admin_token 連結格式已停用") && !listLegacy.html.includes("合成測試地點"));
const list = await page("/admin/quotes", { cookie });
chk("/admin/quotes with session cookie lists the quote; edit link has no token", list.html.includes("合成測試地點") && list.html.includes(`/admin/quotes/${ID}`) && !list.html.includes("admin_token="));
const analytics = await page("/admin/analytics", { cookie });
chk("/admin/analytics with session cookie renders metrics", analytics.status === 200 && analytics.html.includes("今日詢價數") && !analytics.html.includes("讀取 analytics 失敗"));
chk("rendered pages never contain the access token", ![listNoAuth, listLegacy, list, analytics].some((p) => p.html.includes(accessToken)));
console.log(res.join("\n"));
