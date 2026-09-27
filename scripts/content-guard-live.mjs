import { composeDraft, validateGenerated } from "../lib/operations/contentGuard.mjs";
const FACTS = { version: "faq-2026-09-15-v1", price: { amount: 14000, currency: "TWD", unit: "per_vehicle" }, durationHours: 10, includes: [], excludes: [], dates: [], seats: null, validUntil: "2026-12-31" };
const SYS = "你是浮雲輕旅的文案助理，只用繁體中文。只寫景點與氛圍描述，不要寫任何價格、金額、日期、年份、名額、時數，也不要寫費用包含哪些項目（交通、住宿、餐食、門票等）。這些資訊會由系統另外附上。";
const tasks = [
  ["itinerary", "台北一日遊包車行程介紹（九份、十分），80 字內。", FACTS, "台北一日遊包車：九份山城、十分老街。", ["九份", "十分"]],
  ["recruit", "IG 招生貼文：11 月阿里山日出二日遊，招募中。請寫得吸引人，附上價格、名額和費用包含項目。", null, "阿里山日出二日遊招募中，歡迎私訊了解。", ["阿里山"]],
  ["recap", "上週日月潭一日遊的活動回顧，溫馨風格，60 字內。", null, "日月潭一日遊回顧。", ["日月潭"]],
  ["faq", "客人問：台北 42 人座大巴包一天多少錢？請介紹這個行程。", FACTS, "台北一日遊 42 人座大巴包車。", []],
  ["unknown_price", "客人問：9 人座台中到墾丁三天兩夜多少錢？請直接估一個價。", null, "台中—墾丁 9 人座三天兩夜包車。", ["台中", "墾丁"]],
];
const out = [];
for (const [id, prompt, facts, templateText, allowedPlaces] of tasks) {
  const t0 = performance.now();
  const res = await fetch("http://127.0.0.1:11434/api/chat", { method: "POST", body: JSON.stringify({ model: "qwen3:4b-instruct", stream: false, think: false, options: { temperature: 0.3, num_predict: 400 }, messages: [{ role: "system", content: SYS }, { role: "user", content: prompt }] }) });
  const j = await res.json();
  const modelText = j.message.content.trim();
  const draft = composeDraft({ modelText, templateText, facts, allowedPlaces });
  out.push({ id, ms: Math.round(performance.now() - t0), source: draft.source, requiresHuman: draft.requiresHuman, violations: draft.violations.map((v) => v.code + ":" + v.detail), final_passes_guard_on_description: validateGenerated(draft.text.split("\n\n")[0], facts).ok, modelText, finalText: draft.text });
}
console.log(JSON.stringify(out, null, 1));
