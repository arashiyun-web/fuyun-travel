import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const draft = createRequire(import.meta.url)("jiti")(fileURLToPath(import.meta.url), { alias: { "@": root }, interopDefault: true })("@/lib/fleetQuoteDraft");

test("a single checked trip can confirm the catalog fare and its own terms", () => {
  const van = draft.buildFleetQuoteDraft({ pickup: "台北車站", destination: "九份老街", vehicleHint: "賓士小車", hours: 10, passengerCount: 6 });
  assert.equal(van.amountTwd, 7000);
  assert.equal(van.totalAmountTwd, null);
  assert.equal(van.capacity, "clear");
  assert.equal(van.sendsToCustomer, false);
  assert.match(van.text, /基本車資/);
  assert.match(van.text, /不是總價/);
  assert.equal(van.text.includes("這筆車資可確認"), false);
  assert.match(van.known.join("\n"), /含油資、過路費、停車費/);
  assert.equal(van.pending.join("\n").includes("兒童"), false);
  assert.equal(van.pending.join("\n").includes("住宿"), false);
  assert.match(van.pending.join("\n"), /訂金/);
  assert.equal(van.text.includes("30%"), false);
  assert.equal(van.text.includes("昱境"), false);

  const bus = draft.buildFleetQuoteDraft({ pickup: "台北", destination: "九份", vehicleHint: "中巴", remark: "10小時", passengerCount: 12 });
  assert.equal(bus.amountTwd, 9000);
  assert.match(bus.text, /不是總價/);
  assert.match([...bus.known, ...bus.pending].join("\n"), /餐點|停車|稅金/);
  assert.match(bus.known.join("\n"), /含駕駛薪資、過橋過路費、油資/);
  assert.match(bus.known.join("\n"), /不含門票/);
  assert.equal(bus.pending.join("\n").includes("住宿"), false);
  assert.equal(bus.pending.join("\n").includes("一日遊價格未提供"), false);
  assert.equal(bus.text.includes("7000"), false);
});

test("missing hours, multi-stop, via-city, overload, and a 42-seat request do not confirm a fare", () => {
  const missingHours = draft.buildFleetQuoteDraft({ pickup: "台北車站", destination: "九份", vehicleHint: "賓士", passengerCount: 4 });
  assert.equal(missingHours.amountTwd, null);
  assert.match(missingHours.text, /僅供參考/);
  assert.match(missingHours.text, /不是可確認金額/);
  assert.equal(missingHours.text.includes("這筆車資可確認"), false);

  const multi = draft.buildFleetQuoteDraft({ pickup: "台北", destination: "九份、野柳", vehicleHint: "賓士", hours: 10, passengerCount: 4 });
  assert.equal(multi.amountTwd, null);
  assert.equal(multi.text.includes("7000"), false);
  assert.match(multi.text, /多點/);

  const via = draft.buildFleetQuoteDraft({ pickup: "高雄經台北", destination: "九份", vehicleHint: "中巴", hours: 10, passengerCount: 10 });
  assert.equal(via.amountTwd, null);
  assert.equal(via.text.includes("9000"), false);
  assert.equal(via.text.includes("7000"), false);

  const overload = draft.buildFleetQuoteDraft({ pickup: "台北", destination: "九份", vehicleHint: "賓士小車", hours: 10, passengerCount: 21 });
  assert.equal(overload.amountTwd, null);
  assert.equal(overload.text.includes("7000"), false);
  assert.match(overload.text, /超過九個座位/);

  const midibusOver = draft.buildFleetQuoteDraft({ pickup: "台北", destination: "九份", vehicleHint: "中巴", hours: 10, passengerCount: 21 });
  assert.equal(midibusOver.amountTwd, null);
  assert.equal(midibusOver.text.includes("9000"), false);
  assert.match(midibusOver.text, /不改顯示小車價格/);

  const vanTen = draft.buildFleetQuoteDraft({ pickup: "台北車站", destination: "九份", vehicleHint: "賓士", hours: 10, passengerCount: 10 });
  assert.equal(vanTen.amountTwd, null);
  assert.equal(vanTen.text.includes("7000"), false);

  const vanNine = draft.buildFleetQuoteDraft({ pickup: "台北車站", destination: "九份", vehicleHint: "賓士", hours: 10, passengerCount: 9 });
  assert.equal(vanNine.amountTwd, null);
  assert.equal(vanNine.capacity, "pending");
  assert.match(vanNine.text, /是否包含司機/);
  assert.equal(vanNine.text.includes("7000"), false);

  const vanUnknown = draft.buildFleetQuoteDraft({ pickup: "台北車站", destination: "九份", vehicleHint: "賓士", hours: 10 });
  assert.equal(vanUnknown.amountTwd, null);
  assert.equal(vanUnknown.capacity, "pending");

  const coach = draft.buildFleetQuoteDraft({ pickup: "台北", destination: "九份", vehicleHint: "42人座大巴", hours: 10, passengerCount: 30 });
  assert.equal(coach.amountTwd, null);
  assert.equal(coach.text.includes("7000"), false);
  assert.equal(coach.text.includes("9000"), false);
  assert.equal(coach.text.includes("14000"), false);
});

test("draft routes do not send LINE", () => {
  const quoteRoute = readFileSync(path.join(root, "app/api/admin/quotes/[id]/draft/route.ts"), "utf8");
  const inquiryRoute = readFileSync(path.join(root, "app/api/admin/inquiries/[id]/draft/route.ts"), "utf8");
  const sendRoute = readFileSync(path.join(root, "app/api/admin/quotes/[id]/send/route.ts"), "utf8");
  const generateRoute = readFileSync(path.join(root, "app/api/social/generate/route.ts"), "utf8");
  assert.equal(quoteRoute.includes("pushLineText"), false);
  assert.equal(inquiryRoute.includes("pushLineText"), false);
  assert.equal(inquiryRoute.includes("prisma.inquiry.update"), false);
  assert.match(sendRoute, /pushLineText/);
  assert.match(generateRoute, /createContentDraft/);
  assert.match(generateRoute, /publishBlocked: true/);
  assert.equal(generateRoute.includes("pushLineText"), false);
  assert.equal(generateRoute.includes("/api/social/publish"), false);
});
