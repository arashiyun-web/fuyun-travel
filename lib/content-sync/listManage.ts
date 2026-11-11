// /admin/content-sync「本週待選清單」的分頁籤、分頁與移除（軟刪除）規則。
// 移除只把 ContentSyncItem.status 改成 "archived"，資料不刪；可以還原回 "pending"。
// 首頁「這裡真好玩」的 FeaturedSpot 是獨立資料，移除清單項目不會動到它。

export const ARCHIVED_STATUS = "archived";
export const PENDING_STATUS = "pending";
export const LIST_PAGE_SIZE = 10;
export const MAX_LIST_PAGE_SIZE = 50;

export const LIST_TABS = ["pending", "featured", "archived"] as const;
export type ListTab = (typeof LIST_TABS)[number];

export function parseListTab(value: string | null | undefined): ListTab {
  return value === "featured" || value === "archived" ? value : "pending";
}

export function parsePositiveInt(value: string | null | undefined, fallback: number, max?: number) {
  const n = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return max ? Math.min(n, max) : n;
}

/**
 * 每個分頁籤的 Prisma where 條件。
 * - pending：還沒處理、也還沒上首頁的項目。
 * - featured：已經有首頁卡片（FeaturedSpot.sourceItemId 指向它）且沒被移除的項目。
 * - archived：已移除的項目。
 */
export function tabWhere(tab: ListTab, featuredItemIds: string[]) {
  if (tab === "archived") return { status: ARCHIVED_STATUS };
  if (tab === "featured") return { status: { not: ARCHIVED_STATUS }, id: { in: featuredItemIds } };
  return { status: PENDING_STATUS, id: { notIn: featuredItemIds } };
}

/** 舊版 ?status= 查詢：status=all 也不含已移除的項目。 */
export function legacyStatusWhere(status: string) {
  return status === "all" ? { status: { not: ARCHIVED_STATUS } } : { status };
}

export function pageWindow(total: number, requestedPage: number, pageSize: number) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(1, requestedPage), totalPages);
  return { page, totalPages, skip: (page - 1) * pageSize, take: pageSize };
}

export function uniqueIds(values: Array<string | null | undefined>) {
  const seen: Record<string, true> = {};
  const out: string[] = [];
  for (const value of values) {
    if (!value || seen[value]) continue;
    seen[value] = true;
    out.push(value);
  }
  return out;
}
