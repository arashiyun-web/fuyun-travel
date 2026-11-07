import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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
  const amounts = catalog.publicFleetProfiles().flatMap((profile) => profile.rates.map((rate) => rate.amountTwd));
  assert.equal(amounts.includes(0), false);
  assert.equal(catalog.FLEET_CATALOG_LINE_AUTO_QUOTE, false);
  for (const profile of catalog.publicFleetProfiles()) {
    assert.equal(profile.lineAutoQuote, false);
    assert.deepEqual(profile.photos, []);
    assert.equal(profile.photosReady, false);
    assert.equal(profile.readyForLaunch, false);
    assert.equal(catalog.fleetLaunchBlocked(profile.slug), true);
  }
});

test("public pages omit seat guesses, the van overtime calculator, and unreviewed legal text", () => {
  const mercedes = catalog.publicFleetProfile("mercedes-van");
  const toyota = catalog.publicFleetProfile("toyota-midibus");
  const mercedesText = JSON.stringify(mercedes);
  const toyotaText = JSON.stringify(toyota);
  assert.match(mercedesText, /座位數：尚未提供/);
  assert.match(mercedesText, /不自動算出超時費/);
  assert.match(mercedesText, /訂金金額洽詢/);
  assert.match(mercedesText, /是否收費未知/);
  assert.match(mercedesText, /加價金額未定/);
  assert.match(toyotaText, /最多 20 位乘客/);
  assert.match(toyotaText, /台北一日遊價格未提供/);
  assert.match(toyotaText, /住宿補貼金額未提供，洽詢/);
  assert.equal(toyotaText.includes("1,500"), false);
  assert.equal(toyotaText.includes("1500"), false);
  assert.equal(publicText().includes("30%"), false);
  assert.equal(publicText().includes("不得取消"), false);
  assert.equal(publicText().includes("免責"), false);
  assert.match(catalog.internalFleetReviewNotes("toyota-midibus").join("\n"), /30%/);
  assert.match(catalog.internalFleetReviewNotes("toyota-midibus").join("\n"), /內部待審/);
  assert.deepEqual(catalog.internalFleetReviewNotes("mercedes-van"), []);
});

test("fleet pages read the catalog, and LINE quote code does not", () => {
  const site = readFileSync(path.join(root, "lib/siteContent.ts"), "utf8");
  const detail = readFileSync(path.join(root, "app/fleet/[slug]/page.tsx"), "utf8");
  const fleet = readFileSync(path.join(root, "app/fleet/page.tsx"), "utf8");
  const line = readFileSync(path.join(root, "app/api/line/webhook/route.ts"), "utf8");
  const workflow = readFileSync(path.join(root, "lib/quoteWorkflow.ts"), "utf8");
  assert.match(site, /publicFleetProfiles/);
  assert.match(detail, /publicFleetProfile/);
  assert.match(fleet, /vehicle\.slug !== "coach-42"/);
  assert.equal(line.includes("fleetCatalog"), false);
  assert.equal(workflow.includes("fleetCatalog"), false);
  assert.equal(line.includes("mercedes-van"), false);
  assert.equal(workflow.includes("toyota-midibus"), false);
});
