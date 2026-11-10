import { hasExplicitOwnerApproval, type OwnerApproval } from "@/lib/operations/approvalGate";
import { createPostizDraft } from "@/lib/postiz/adapter";
import { isPostizSocialPlatform, postizSettings, publishOutlet, type PostizSocialPlatform } from "@/lib/postiz/config";

export type HandoffRecord = {
  idempotencyKey: string;
  contentId: string;
  platform: string;
  status: "sending" | "draft_created" | "failed";
  postizPostId: string | null;
  lastError: string | null;
};

export interface HandoffStore {
  claim(idempotencyKey: string, contentId: string, platform: string): Promise<{ record: HandoffRecord; created: boolean }>;
  markDraft(idempotencyKey: string, postizPostId: string): Promise<void>;
  markFailed(idempotencyKey: string, error: string): Promise<void>;
}

export function memoryHandoffStore(): HandoffStore {
  const records = new Map<string, HandoffRecord>();
  let chain = Promise.resolve();
  return {
    claim(idempotencyKey, contentId, platform) {
      const run = chain.then(() => {
        const existing = records.get(idempotencyKey);
        if (existing) return { record: existing, created: false };
        const record: HandoffRecord = { idempotencyKey, contentId, platform, status: "sending", postizPostId: null, lastError: null };
        records.set(idempotencyKey, record);
        return { record, created: true };
      });
      chain = run.then(() => undefined, () => undefined);
      return run;
    },
    async markDraft(idempotencyKey, postizPostId) {
      const record = records.get(idempotencyKey);
      if (!record) return;
      record.status = "draft_created";
      record.postizPostId = postizPostId;
      record.lastError = null;
    },
    async markFailed(idempotencyKey, error) {
      const record = records.get(idempotencyKey);
      if (!record) return;
      record.status = "failed";
      record.lastError = error;
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

/** Sends one owner-approved social piece to Postiz as a draft. Does not publish it. */
export async function handoffApprovedPiece(piece: ApprovedSocialPiece, store: HandoffStore, options?: { fetchImpl?: typeof fetch; timeoutMs?: number }) {
  if (publishOutlet() !== "postiz") {
    return { ok: false as const, state: "未完成" as const, error: "發布出口未設成 postiz。", sent: false };
  }
  if (!isPostizSocialPlatform(piece.platform)) {
    return { ok: false as const, state: "refused" as const, error: "這個平台不走 Postiz。", sent: false };
  }
  if (!hasExplicitOwnerApproval(piece.approval)) {
    return { ok: false as const, state: "refused" as const, error: "內容尚未由老闆核准，不送 Postiz。", sent: false };
  }
  const settings = postizSettings();
  if (!settings.ready) {
    return { ok: false as const, state: "未完成" as const, error: `Postiz 設定未完成：${settings.missing.join("、")}`, sent: false };
  }
  const platform = piece.platform as PostizSocialPlatform;
  const idempotencyKey = `${piece.contentId}:${platform}`;
  const claimed = await store.claim(idempotencyKey, piece.contentId, platform);
  if (!claimed.created) {
    return { ok: claimed.record.status === "draft_created", state: claimed.record.status, postizPostId: claimed.record.postizPostId, sent: false, duplicate: true as const };
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
    await store.markDraft(idempotencyKey, created.postId);
    return { ok: true as const, state: "draft_created" as const, postizPostId: created.postId, sent: true, duplicate: false as const };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Postiz 沒有建立草稿";
    await store.markFailed(idempotencyKey, message);
    return { ok: false as const, state: "failed" as const, error: message, sent: true, duplicate: false as const };
  }
}
