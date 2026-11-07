import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const catalog = await import("../lib/fleetCatalog.ts");

function publicText() {
  return JSON.stringify(catalog.publicFleetProfiles());
}

test("known rates are structured and unknown amounts are null, never zero", () => {
  assert.equal(catalog.confirmedVehicleRate("mercedes-van", "taipei-day-10h"), 7000);
  assert.equal(catalog.confirmedVehicleRate("mercedes-van", "taipei-jiufen-10h"), 7000);
  assert.equal(catalog.confirmedVehicleRate("toyota-midibus", "taipei-jiufen-10h"), 9000);
  assert.equal(catalog.confirmedVehicleRate("toyota-midibus", "taipei-day-10h"), null);
  assert.equal(catalog.confirmedVehicleRate("coach-42", "taipei-day-10h"), null);
  const amounts = ["mercedes-van", "toyota-midibus"].flatMap((slug) => catalog.fleetQuoteRecord(slug).rates.map((rate) => rate.amountTwd));
  assert.equal(amounts.includes(0), false);
  assert.equal(catalog.FLEET_CATALOG_LINE_AUTO_QUOTE, false);
  const van = catalog.publicFleetProfile("mercedes-van");
  const midibus = catalog.publicFleetProfile("toyota-midibus");
  assert.deepEqual(van.photos, [
    "/fleet/mercedes-van-exterior.webp",
    "/fleet/mercedes-van-captain.webp",
    "/fleet/mercedes-van-rear.webp",
    "/fleet/mercedes-van-front.webp",
  ]);
  assert.equal(van.photosReady, true);
  assert.equal(catalog.fleetLaunchBlocked("mercedes-van"), false);
  for (const photo of van.photos) assert.equal(existsSync(path.join(root, "public", photo)), true, photo);
  assert.deepEqual(midibus.photos, [
    "/fleet/toyota-midibus-side.webp",
    "/fleet/toyota-midibus-interior-front.webp",
    "/fleet/toyota-midibus-interior-rear.webp",
    "/fleet/toyota-midibus-front.webp",
  ]);
  assert.equal(midibus.photosReady, true);
  assert.equal(catalog.fleetLaunchBlocked("toyota-midibus"), false);
  for (const photo of midibus.photos) {
    assert.equal(existsSync(path.join(root, "public", photo)), true, photo);
    assert.equal(van.photos.includes(photo), false);
  }
  assert.equal(JSON.stringify(van).includes("toyota-midibus"), false);
});

test("public intros describe the ride and do not carry quote terms", () => {
  const mercedes = catalog.publicFleetProfile("mercedes-van");
  const toyota = catalog.publicFleetProfile("toyota-midibus");
  const shown = publicText();
  const banned = ["7,000", "7000", "9,000", "9000", "300 元", "500 元", "800 元", "1,500", "1500", "舉牌", "過路費", "訂金", "30%", "免責", "昱境", "油資", "加價", "超時"];
  for (const phrase of banned) assert.equal(shown.includes(phrase), false, phrase);
  assert.match(JSON.stringify(mercedes), /九人座賓士小車，適合四人以上的家庭、朋友小團體/);
  assert.match(JSON.stringify(mercedes), /獨立乘客座/);
  assert.match(JSON.stringify(toyota), /含司機 21 座，最多 20 位乘客/);
  assert.match(JSON.stringify(toyota), /建議不要坐滿/);
  assert.match(JSON.stringify(toyota), /親友同行、公司小型團體/);
  assert.equal(JSON.stringify(toyota).includes("最少要"), true);
  const vanQuote = catalog.fleetQuoteRecord("mercedes-van");
  const busQuote = catalog.fleetQuoteRecord("toyota-midibus");
  assert.equal(vanQuote.rates.find((rate) => rate.id === "taipei-day-10h").amountTwd, 7000);
  assert.equal(vanQuote.rates.find((rate) => rate.id === "taipei-jiufen-10h").amountTwd, 7000);
  assert.equal(busQuote.rates.find((rate) => rate.id === "taipei-jiufen-10h").amountTwd, 9000);
  assert.equal(busQuote.rates.find((rate) => rate.id === "taipei-day-10h").amountTwd, null);
  assert.match(vanQuote.conditions.join("\n"), /半小時 300 元、1 小時 500 元/);
  assert.match(busQuote.conditions.join("\n"), /每小時 800 元/);
  assert.match(catalog.internalFleetReviewNotes("toyota-midibus").join("\n"), /30%/);
  assert.equal(catalog.FLEET_CATALOG_LINE_AUTO_QUOTE, false);
  assert.equal(vanQuote.lineAutoQuote, false);
});

test("fleet pages read the catalog, and LINE quote code does not", () => {
  const site = readFileSync(path.join(root, "lib/siteContent.ts"), "utf8");
  const detail = readFileSync(path.join(root, "app/fleet/[slug]/page.tsx"), "utf8");
  const fleet = readFileSync(path.join(root, "app/fleet/page.tsx"), "utf8");
  const line = readFileSync(path.join(root, "app/api/line/webhook/route.ts"), "utf8");
  const workflow = readFileSync(path.join(root, "lib/quoteWorkflow.ts"), "utf8");
  assert.match(site, /publicFleetProfiles/);
  assert.match(site, /\/fleet\/coach-42-exterior\.webp/);
  assert.match(detail, /publicFleetProfile/);
  assert.match(fleet, /vehicle\.slug !== "coach-42"/);
  assert.match(fleet, /midibus\.photos\.slice\(1, 3\)/);
  assert.match(fleet, /van\.photos\.slice\(1, 3\)/);
  assert.equal(fleet.includes("mercedes-van-exterior.webp"), false);
  assert.equal(fleet.includes("toyota-midibus-side.webp"), false);
  assert.equal(line.includes("fleetCatalog"), false);
  assert.equal(workflow.includes("fleetCatalog"), false);
  assert.equal(line.includes("mercedes-van"), false);
  assert.equal(workflow.includes("toyota-midibus"), false);
});
