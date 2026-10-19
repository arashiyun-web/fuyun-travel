// Offline check of /api/travel/import access control. Loads the route in-process with jiti; every
// rejected request returns before any database access, so no DATABASE_URL is needed.
// Usage: node scripts/travel-import-auth.test.mjs   (TRAVEL_IMPORT_ROUTE_PATH=<old copy> for regression proof)
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const routePath = process.env.TRAVEL_IMPORT_ROUTE_PATH || path.join(root, "app/api/travel/import/route.ts");
delete process.env.ADMIN_ACCESS_TOKEN;
// Requests that slip past the auth checks must not reach a real database.
process.env.DATABASE_URL = "postgresql://offline:offline@127.0.0.1:1/offline";

/** envConfig reads the key at module load, so each key setting gets a fresh module graph. */
function loadRoute(apiKey) {
  if (apiKey === undefined) delete process.env.TRAVEL_IMPORT_API_KEY;
  else process.env.TRAVEL_IMPORT_API_KEY = apiKey;
  const jiti = createRequire(import.meta.url)("jiti")(fileURLToPath(import.meta.url), { alias: { "@": root }, interopDefault: true, requireCache: false }); // jiti v1
  return jiti(routePath);
}

const res = [];
const chk = (n, ok, d = "") => res.push(`${ok ? "PASS" : "FAIL"} ${n}${d ? " — " + d : ""}`);
const post = (route, headers = {}) =>
  route.POST(new Request("http://localhost/api/travel/import", { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify({ title: "synthetic", content: "synthetic" }) }));

const noKey = loadRoute(undefined);
const p1 = await post(noKey);
chk("POST with TRAVEL_IMPORT_API_KEY unset → 503", p1.status === 503, String(p1.status));
const g1 = await noKey.GET(new Request("http://localhost/api/travel/import"));
const g1Text = await g1.text();
chk("GET without admin login → 401", g1.status === 401, String(g1.status));
chk("GET response does not reveal whether the key is set", !/TRAVEL_IMPORT_API_KEY|x-api-key/.test(g1Text));

const withKey = loadRoute("synthetic-import-key-0123456789");
const p2 = await post(withKey, { "x-api-key": "synthetic-import-key-wrong-00000" });
chk("POST with wrong x-api-key → 401", p2.status === 401, String(p2.status));
const p3 = await post(withKey);
chk("POST without x-api-key → 401", p3.status === 401, String(p3.status));
const g2 = await withKey.GET(new Request("http://localhost/api/travel/import"));
chk("GET without admin login (key set) → 401", g2.status === 401, String(g2.status));

console.log(res.join("\n"));
process.exitCode = res.some((l) => l.startsWith("FAIL")) ? 1 : 0;
