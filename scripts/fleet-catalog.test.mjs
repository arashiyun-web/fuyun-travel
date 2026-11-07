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
  const amounts = catalog.publicFleetProfiles().flatMap((profile) => profile.rates.map((rate) => rate.amountTwd));
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

test("public pages omit seat guesses, the van overtime calculator, and unreviewed legal text", () => {
  const mercedes = catalog.publicFleetProfile("mercedes-van");
  const toyota = catalog.publicFleetProfile("toyota-midibus");
  const mercedesText = JSON.stringify(mercedes);
  const toyotaText = JSON.stringify(toyota);
  assert.equal(mercedesText.includes("尚未建檔"), false);
  assert.equal(toyotaText.includes("尚未建檔"), false);
  assert.equal(mercedesText.includes("toyota-midibus"), false);
  assert.match(toyotaText, /昱境通運公司/);
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
