import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const draft = createRequire(import.meta.url)("jiti")(fileURLToPath(import.meta.url), { alias: { "@": root }, interopDefault: true })("@/lib/fleetQuoteDraft");

test("matched van and midibus fares come from the checked rate book", () => {
  const van = draft.buildFleetQuoteDraft({ pickup: "台北車站", destination: "九份", vehicleHint: "賓士小車", hours: 10, passengerCount: 6 });
  assert.equal(van.amountTwd, 7000);
  assert.equal(van.sendsToCustomer, false);
  assert.match(van.text, /7000 元/);
  assert.match(van.text, /待確認/);
  assert.equal(van.text.includes("30%"), false);
  assert.equal(van.text.includes("昱境"), false);

  const bus = draft.buildFleetQuoteDraft({ pickup: "台北", destination: "九份老街", vehicleHint: "中巴", remark: "10小時" });
  assert.equal(bus.amountTwd, 9000);
  assert.match(bus.pending.join("\n"), /住宿補貼：待確認/);
});

test("unknown route, wrong hours, and coach do not invent a fare", () => {
  const other = draft.buildFleetQuoteDraft({ pickup: "高雄", destination: "墾丁", vehicleHint: "賓士", hours: 10 });
  assert.equal(other.amountTwd, null);
  assert.match(other.text, /沒有已核對車資/);

  const long = draft.buildFleetQuoteDraft({ pickup: "台北", destination: "九份", vehicleHint: "小車", hours: 12 });
  assert.equal(long.amountTwd, null);
  assert.match(long.text, /不套用該車資/);

  const coach = draft.buildFleetQuoteDraft({ pickup: "台北", destination: "九份", vehicleHint: "42人座大巴", hours: 10 });
  assert.equal(coach.amountTwd, null);
  assert.equal(coach.text.includes("14000"), false);
  assert.equal(coach.text.includes("14,000"), false);
});

test("draft routes do not send LINE", () => {
  const quoteRoute = readFileSync(path.join(root, "app/api/admin/quotes/[id]/draft/route.ts"), "utf8");
  const inquiryRoute = readFileSync(path.join(root, "app/api/admin/inquiries/[id]/draft/route.ts"), "utf8");
  const sendRoute = readFileSync(path.join(root, "app/api/admin/quotes/[id]/send/route.ts"), "utf8");
  assert.equal(quoteRoute.includes("pushLineText"), false);
  assert.equal(inquiryRoute.includes("pushLineText"), false);
  assert.equal(inquiryRoute.includes("prisma.inquiry.update"), false);
  assert.match(sendRoute, /pushLineText/);
});
