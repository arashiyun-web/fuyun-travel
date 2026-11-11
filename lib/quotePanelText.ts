/**
 * Lines of the staff box on /admin/quotes/[id] (AutoDraftPanel). Pure and client-safe. The page renders
 * exactly these lines and the send guard refuses any of them (with or without the 參考行情 prefix).
 */

function object(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

/** Every line in the staff box starts with 參考行情, so a pasted line is refused by the send guard. */
export function staffLine(line: string) {
  return line.startsWith("參考行情") ? line : `參考行情｜${line}`;
}

export const PANEL_TITLE = "內部參考（只在後台顯示，不會送給客人）";
export const PANEL_HANDOFF = "客人需求資料已齊，待真人客服：請專人確認行程後再報價。";
export const PANEL_RANGE_INFO = "下方正式報價內容是範圍報價（不是確定金額），可直接送出；內部參考的文字不能貼進去。";

export function isHandoff(options: unknown) {
  return object(object(options)?.handoff)?.status === "pending_human";
}

/** null when the row has no auto draft (the panel is not shown). */
export function panelLines(options: unknown): string[] | null {
  const meta = object(object(options)?.autoDraft);
  if (!meta) return null;
  const lines: string[] = [PANEL_TITLE];
  if (typeof meta.staffNote === "string") lines.push(meta.staffNote);
  if (typeof meta.vehicleLabel === "string" && meta.vehicleByCount) lines.push(`建議車型依人數推定：${meta.vehicleLabel}，請確認。`);
  if (Array.isArray(meta.staffLines)) for (const line of meta.staffLines) if (typeof line === "string") lines.push(line);
  lines.push(isHandoff(options) ? PANEL_HANDOFF : PANEL_RANGE_INFO);
  return lines.map(staffLine);
}
