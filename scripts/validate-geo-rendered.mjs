import { spawn } from "node:child_process";
import { createServer } from "node:net";

const port = await new Promise((resolve, reject) => {
  const probe = createServer();
  probe.once("error", reject);
  probe.listen(0, "127.0.0.1", () => {
    const address = probe.address();
    if (!address || typeof address === "string") return reject(new Error("failed to allocate test port"));
    probe.close((error) => error ? reject(error) : resolve(address.port));
  });
});
const origin = `http://127.0.0.1:${port}`;
const canonicalOrigin = "https://fuyuntravel.com";

const sections = {
  home: { "zh-Hant": "/", en: "/en", ja: "/ja", "zh-Hans": "/zh-cn", ko: "/ko" },
  about: { "zh-Hant": "/about", en: "/en/about", ja: "/ja/about", "zh-Hans": "/zh-cn/about" },
  airport: { "zh-Hant": "/airport-transfer", en: "/en/airport-transfer", ja: "/ja/airport-transfer", "zh-Hans": "/zh-cn/airport-transfer", ko: "/ko/airport-transfer" },
  charter: { "zh-Hant": "/charter-bus", en: "/en/charter-bus", ja: "/ja/charter-bus", "zh-Hans": "/zh-cn/charter-bus", ko: "/ko/charter-bus" },
  jiufen: { "zh-Hant": "/blog/taipei-jiufen-charter", en: "/en/blog/taipei-to-jiufen-charter-bus-price", ja: "/ja/blog/taipei-jiufen-charter-rates", "zh-Hans": "/zh-cn/blog/taipei-jiufen-charter" },
};

const notFoundRoutes = {
  "/missing": "zh-Hant",
  "/en/missing": "en",
  "/ja/missing": "ja",
  "/zh-cn/missing": "zh-Hans",
  "/ko/missing": "ko",
  "/ms/missing": "ms",
  "/th/missing": "th",
  "/vi/missing": "vi",
};

function normalized(url) {
  const parsed = new URL(url);
  const pathname = parsed.pathname === "/" ? "" : parsed.pathname.replace(/\/$/, "");
  return parsed.origin + pathname;
}

function attrs(tag) {
  const result = {};
  for (const match of tag.matchAll(/([\w:-]+)=["']([^"']*)["']/g)) result[match[1].toLowerCase()] = match[2];
  return result;
}

function equalRecord(actual, expected) {
  const actualEntries = Object.entries(actual).sort(([a], [b]) => a.localeCompare(b));
  const expectedEntries = Object.entries(expected).sort(([a], [b]) => a.localeCompare(b));
  return JSON.stringify(actualEntries) === JSON.stringify(expectedEntries);
}

const failures = [];
let routesChecked = 0;
let schemaChecked = 0;

function validateGeoSchema(data, route) {
  const graph = Array.isArray(data?.["@graph"]) ? data["@graph"] : [];
  const organization = graph.find((node) => node?.["@type"] === "TravelAgency");
  const service = graph.find((node) => node?.["@type"] === "Service");
  const faq = graph.find((node) => node?.["@type"] === "FAQPage");
  if (!organization) failures.push(`${route}: TravelAgency node missing`);
  if (!service?.provider?.["@id"] || service.provider["@id"] !== organization?.["@id"]) failures.push(`${route}: Service provider mismatch`);
  if (!Array.isArray(faq?.mainEntity) || faq.mainEntity.length === 0) failures.push(`${route}: FAQPage questions missing`);
  if (!organization?.taxID) failures.push(`${route}: taxID missing`);
  if (!Array.isArray(organization?.identifier) || organization.identifier.length < 2 || organization.identifier.some((item) => item?.["@type"] !== "PropertyValue" || !item?.propertyID || !item?.value)) failures.push(`${route}: identifiers invalid`);
  if (organization?.hasCredential?.["@type"] !== "Credential" || !organization.hasCredential.description) failures.push(`${route}: Credential invalid`);
  if (JSON.stringify(data).includes('"@type":"Grant"')) failures.push(`${route}: Grant credential remains`);
  schemaChecked += 1;
}

function validateCoreSchema(data, route) {
  const nodes = Array.isArray(data) ? data : [data];
  const organization = nodes.find((node) => {
    const types = Array.isArray(node?.["@type"]) ? node["@type"] : [node?.["@type"]];
    return types.includes("TravelAgency");
  });
  if (!organization?.name || !organization?.url || !organization?.telephone || organization?.address?.["@type"] !== "PostalAddress") failures.push(`${route}: core TravelAgency invalid`);
  if (route === "/" && !nodes.some((node) => node?.["@type"] === "WebSite")) failures.push(`${route}: WebSite node missing`);
  schemaChecked += 1;
}

async function waitForServer(child) {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`next start exited early with ${child.exitCode}`);
    try {
      const response = await fetch(origin + "/");
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("timed out waiting for next start");
}

const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", String(port)], {
  cwd: process.cwd(),
  stdio: ["ignore", "pipe", "pipe"],
});
let serverOutput = "";
child.stdout.on("data", (chunk) => { serverOutput += chunk; });
child.stderr.on("data", (chunk) => { serverOutput += chunk; });

try {
  await waitForServer(child);

  for (const localeMap of Object.values(sections)) {
    const expectedAlternates = Object.fromEntries(Object.entries(localeMap).map(([locale, path]) => [locale, normalized(canonicalOrigin + path)]));
    expectedAlternates["x-default"] = normalized(canonicalOrigin + localeMap["zh-Hant"]);

    for (const [locale, route] of Object.entries(localeMap)) {
      const response = await fetch(origin + route);
      const html = await response.text();
      routesChecked += 1;
      if (response.status !== 200) failures.push(`${route}: HTTP ${response.status}`);
      const htmlAttrs = attrs(html.match(/<html\b[^>]*>/i)?.[0] ?? "");
      if (htmlAttrs.lang !== locale) failures.push(`${route}: html lang=${htmlAttrs.lang ?? "MISSING"}, expected=${locale}`);

      const links = [...html.matchAll(/<link\b[^>]*>/gi)].map((match) => attrs(match[0]));
      const canonical = links.find((link) => link.rel === "canonical")?.href;
      if (!canonical || normalized(canonical) !== normalized(canonicalOrigin + route)) failures.push(`${route}: canonical mismatch`);
      const actualAlternates = Object.fromEntries(links.filter((link) => link.rel === "alternate" && link.hreflang && link.href).map((link) => [link.hreflang, normalized(link.href)]));
      if (!equalRecord(actualAlternates, expectedAlternates)) failures.push(`${route}: hreflang set mismatch`);

      const blocks = [...html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
      if (blocks.length === 0) failures.push(`${route}: JSON-LD missing`);
      for (const block of blocks) {
        try {
          const data = JSON.parse(block[1]);
          if (route === "/" || route === "/about") validateCoreSchema(data, route);
          else validateGeoSchema(data, route);
        } catch (error) {
          failures.push(`${route}: JSON-LD parse error: ${error.message}`);
        }
      }
    }
  }

  for (const [route, locale] of Object.entries(notFoundRoutes)) {
    const response = await fetch(origin + route);
    const html = await response.text();
    const htmlAttrs = attrs(html.match(/<html\b[^>]*>/i)?.[0] ?? "");
    if (response.status !== 404) failures.push(`${route}: expected 404, got ${response.status}`);
    if (htmlAttrs.lang !== locale) failures.push(`${route}: 404 html lang=${htmlAttrs.lang ?? "MISSING"}, expected=${locale}`);
    if (!html.includes(`data-localized-not-found="${locale}"`)) failures.push(`${route}: branded localized 404 missing`);
  }
} catch (error) {
  failures.push(`test harness: ${error.message}; server output=${serverOutput.trim()}`);
} finally {
  child.kill("SIGTERM");
  await new Promise((resolve) => {
    if (child.exitCode !== null) return resolve();
    child.once("exit", resolve);
    setTimeout(resolve, 2_000);
  });
}

console.log(`CORE_ROUTES_CHECKED=${routesChecked}`);
console.log(`SCHEMA_BLOCKS_CHECKED=${schemaChecked}`);
console.log(`LOCALIZED_404_ROUTES_CHECKED=${Object.keys(notFoundRoutes).length}`);
console.log(`FAILURES=${failures.length}`);
for (const failure of failures) console.log(`FAIL ${failure}`);
process.exitCode = failures.length === 0 ? 0 : 1;
