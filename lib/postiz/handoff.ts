import { hasExplicitOwnerApproval, type OwnerApproval } from "@/lib/operations/approvalGate";
import { PostizRejectedError, PostizUncertainError, createPostizDraft } from "@/lib/postiz/adapter";
import { isPostizSocialPlatform, postizSettings, publishOutlet, type PostizSocialPlatform } from "@/lib/postiz/config";

/** A sending row older than the request timeout is treated as stuck, not as an in-flight peer. */
export const POSTIZ_STUCK_AFTER_MS = 20_000;

export type HandoffStatus = "sending" | "draft_created" | "failed" | "needs_manual_confirmation";

export type HandoffRecord = {
  idempotencyKey: string;
  contentId: string;
  platform: string;
  status: HandoffStatus;
  postizPostId: string | null;
  lastError: string | null;
  updatedAt: string;
};

export interface HandoffStore {
  claim(idempotencyKey: string, contentId: string, platform: string): Promise<{ record: HandoffRecord; created: boolean }>;
  /** Returns false when the row is no longer the sending claim this caller owns. */
  markDraft(idempotencyKey: string, postizPostId: string): Promise<boolean>;
  markFailed(idempotencyKey: string, error: string): Promise<boolean>;
  markNeedsManual(idempotencyKey: string, error: string): Promise<boolean>;
}

function stamp(record: HandoffRecord, patch: Partial<HandoffRecord>) {
  Object.assign(record, patch, { updatedAt: new Date().toISOString() });
}

export function memoryHandoffStore(): HandoffStore {
  const records = new Map<string, HandoffRecord>();
  let chain = Promise.resolve();
  return {
    claim(idempotencyKey, contentId, platform) {
      const run = chain.then(() => {
        const existing = records.get(idempotencyKey);
        if (existing) return { record: existing, created: false };
        const record: HandoffRecord = {
          idempotencyKey,
          contentId,
          platform,
          status: "sending",
          postizPostId: null,
          lastError: null,
          updatedAt: new Date().toISOString(),
        };
        records.set(idempotencyKey, record);
        return { record, created: true };
      });
      chain = run.then(() => undefined, () => undefined);
      return run;
    },
    async markDraft(idempotencyKey, postizPostId) {
      const record = records.get(idempotencyKey);
      if (!record || record.status !== "sending") return false;
      stamp(record, { status: "draft_created", postizPostId, lastError: null });
      return true;
    },
    async markFailed(idempotencyKey, error) {
      const record = records.get(idempotencyKey);
      if (!record || record.status !== "sending") return false;
      stamp(record, { status: "failed", lastError: error });
      return true;
    },
    async markNeedsManual(idempotencyKey, error) {
      const record = records.get(idempotencyKey);
      if (!record || record.status !== "sending") return false;
      stamp(record, { status: "needs_manual_confirmation", lastError: error });
      return true;
    },
  };
}

export type ApprovedSocialPiece = {
  contentId: string;
  platform: string;
  caption: string;
  imageUrl?: string | null;
  approval: OwnerApproval;
};

export type HandoffResult = {
  ok: boolean;
  state: "draft_created" | "未完成" | "需要人工確認" | "refused";
  error?: string;
  postizPostId?: string | null;
  sent: boolean;
  duplicate?: boolean;
};

function storeFailure(error: unknown) {
  const code = typeof error === "object" && error && "code" in error ? String((error as { code: unknown }).code) : "";
  if (code === "P2021" || code === "P2010" || code === "P1001" || code === "P1000") return "未完成：Postiz 交接表尚未建立。";
  if (error instanceof Error && error.name === "PrismaClientInitializationError") return "未完成：Postiz 交接資料庫尚未就緒。";
  return "未完成：Postiz 交接紀錄無法寫入。";
}

function duplicateResult(record: HandoffRecord): HandoffResult {
  if (record.status === "draft_created") {
    return { ok: true, state: "draft_created", postizPostId: record.postizPostId, sent: false, duplicate: true };
  }
  if (record.status === "needs_manual_confirmation") {
    return { ok: false, state: "需要人工確認", error: record.lastError || "需要人工確認：Postiz 結果不明，不會自動重送。", sent: false, duplicate: true };
  }
  if (record.status === "failed") {
    return { ok: false, state: "未完成", error: record.lastError || "未完成：先前的 Postiz 草稿沒有建立，不會自動重送。", sent: false, duplicate: true };
  }
  return { ok: false, state: "未完成", error: "未完成：同一篇正在送出，沒有重送。", sent: false, duplicate: true };
}

/** Sends one owner-approved social piece to Postiz as a draft. Does not publish it. */
export async function handoffApprovedPiece(piece: ApprovedSocialPiece, store: HandoffStore, options?: { fetchImpl?: typeof fetch; timeoutMs?: number }): Promise<HandoffResult> {
  if (publishOutlet() !== "postiz") {
    return { ok: false, state: "未完成", error: "未完成：發布出口未設成 postiz。", sent: false };
  }
  if (!isPostizSocialPlatform(piece.platform)) {
    return { ok: false, state: "refused", error: "這個平台不走 Postiz。", sent: false };
  }
  if (!hasExplicitOwnerApproval(piece.approval)) {
    return { ok: false, state: "未完成", error: "未完成：內容尚未由老闆核准，不送 Postiz。", sent: false };
  }
  const settings = postizSettings();
  if (!settings.ready) {
    return { ok: false, state: "未完成", error: `未完成：Postiz 設定未完成：${settings.missing.join("、")}`, sent: false };
  }
  const platform = piece.platform as PostizSocialPlatform;
  const idempotencyKey = `${piece.contentId}:${platform}`;
  let claimed: { record: HandoffRecord; created: boolean };
  try {
    claimed = await store.claim(idempotencyKey, piece.contentId, platform);
  } catch (error) {
    return { ok: false, state: "未完成", error: storeFailure(error), sent: false };
  }
  if (!claimed.created) {
    if (claimed.record.status === "sending") {
      const age = Date.now() - new Date(claimed.record.updatedAt).getTime();
      if (Number.isFinite(age) && age >= POSTIZ_STUCK_AFTER_MS) {
        const error = "需要人工確認：Postiz 送出狀態卡住，不知道對方有沒有收到，不會自動重送。";
        await store.markNeedsManual(idempotencyKey, error).catch(() => false);
        return { ok: false, state: "需要人工確認", error, sent: false, duplicate: true };
      }
    }
    return duplicateResult(claimed.record);
  }
  try {
    const created = await createPostizDraft({
      apiUrl: settings.apiUrl,
      apiKey: settings.apiKey,
      platform,
      integrationId: settings.integrations[platform],
      content: piece.caption,
      imageUrl: piece.imageUrl,
    }, options);
    const marked = await store.markDraft(idempotencyKey, created.postId);
    if (!marked) {
      return { ok: false, state: "需要人工確認", error: "需要人工確認：草稿回應和交接狀態不一致，不會自動重送。", sent: true, duplicate: false };
    }
    return { ok: true, state: "draft_created", postizPostId: created.postId, sent: true, duplicate: false };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Postiz 沒有建立草稿";
    if (error instanceof PostizUncertainError || (error instanceof Error && error.name === "PostizUncertainError")) {
      const errorText = `需要人工確認：${message}，不會自動重送。`;
      await store.markNeedsManual(idempotencyKey, errorText).catch(() => false);
      return { ok: false, state: "需要人工確認", error: errorText, sent: true, duplicate: false };
    }
    const errorText = `未完成：${error instanceof PostizRejectedError ? message : message}`;
    await store.markFailed(idempotencyKey, errorText).catch(() => false);
    return { ok: false, state: "未完成", error: errorText, sent: true, duplicate: false };
  }
}
