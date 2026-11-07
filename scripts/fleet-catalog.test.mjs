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

test("public copy keeps prices and uncertainty without staff notes", () => {
  const mercedes = catalog.publicFleetProfile("mercedes-van");
  const toyota = catalog.publicFleetProfile("toyota-midibus");
  const mercedesText = JSON.stringify(mercedes);
  const toyotaText = JSON.stringify(toyota);
  const shown = publicText();
  const banned = ["頁面不把", "只用於這台", "不填0", "不填 0", "參考景點", "不自動算出", "資料沒有寫死", "未提供", "未知", "不沿用", "昱境", "自有", "尚未提供", "施工"];
  for (const phrase of banned) assert.equal(shown.includes(phrase), false, phrase);
  assert.match(mercedesText, /7,000 元/);
  assert.match(mercedesText, /座位與行李配置請於預訂時確認/);
  assert.match(mercedesText, /訂金及取消改期規則請於預訂時確認/);
  assert.match(mercedesText, /夜間加價依行程另行確認/);
  assert.match(mercedesText, /兒童安全座椅請預先告知需求，費用另行確認/);
  assert.match(mercedesText, /超時費半小時 300 元、1 小時 500 元，超過約定時間半小時以上計收；具體計費請於預訂時確認/);
  assert.match(toyotaText, /9,000 元/);
  assert.match(toyotaText, /含司機 21 座，最多 20 位乘客，建議保留座位以維持舒適度；行李依實際人數及尺寸確認/);
  assert.match(toyotaText, /台北一日遊費用請於預訂時確認/);
  assert.equal(toyotaText.includes("1,500"), false);
  assert.equal(shown.includes("30%"), false);
  assert.equal(shown.includes("不得取消"), false);
  assert.equal(shown.includes("免責"), false);
  const midibusNotes = catalog.internalFleetReviewNotes("toyota-midibus").join("\n");
  const vanNotes = catalog.internalFleetReviewNotes("mercedes-van").join("\n");
  assert.match(midibusNotes, /30%/);
  assert.match(midibusNotes, /昱境通運公司/);
  assert.match(midibusNotes, /1,500/);
  assert.match(vanNotes, /不得從照片推測/);
  assert.match(vanNotes, /不得自動計費/);
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
