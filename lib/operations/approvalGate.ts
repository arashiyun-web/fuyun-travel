/** The only actor allowed to mark copy approved. Set by POST /api/operations/content/:id/approve. */
export const OPERATIONS_OWNER_APPROVER = "operations-owner";

export type OwnerApproval = {
  status: string;
  approvedBy?: string | null;
  approvedAt?: string | Date | null;
};

/** True only after the owner pressed approve in /admin/operations. A bare status flag is not enough. */
export function hasExplicitOwnerApproval(approval: OwnerApproval): boolean {
  return approval.status === "approved"
    && approval.approvedBy === OPERATIONS_OWNER_APPROVER
    && Boolean(approval.approvedAt);
}

export function hasOwnerApprovalEvent(events: { type: string; contentId: string }[], contentId: string): boolean {
  return events.some((event) => event.contentId === contentId && event.type === "content_approved");
}

const FROZEN_JOB_STATUSES = new Set(["published", "processing", "submitted_pending_verification", "withdrawn"]);

type RevisableJob = {
  caption: string;
  status: string;
  approvalHash?: string | null;
  lastError?: string | null;
};

type RevisableContent = {
  approval: { status: string; approvedAt: string | null; approvedBy: string | null };
  status: string;
  selectedPlatforms: string[];
  platforms: Record<string, RevisableJob>;
};

/**
 * Copy that changed after an owner approval goes back to pending review.
 * Already-published jobs keep the text that was sent.
 */
export function reviseCaptionsAfterApproval<T extends RevisableContent>(content: T, nextCaptions: Record<string, string>): { reset: boolean; captionUpdated: boolean } {
  const editable = content.selectedPlatforms.filter((platform) => {
    const job = content.platforms[platform];
    return Boolean(job) && job.caption !== (nextCaptions[platform] ?? "") && !FROZEN_JOB_STATUSES.has(job.status);
  });
  if (!editable.length) return { reset: false, captionUpdated: false };
  const wasApproved = content.approval.status === "approved";
  for (const platform of editable) content.platforms[platform].caption = nextCaptions[platform];
  if (!wasApproved) return { reset: false, captionUpdated: true };
  content.approval = { status: "pending", approvedAt: null, approvedBy: null };
  content.status = "pending_approval";
  for (const platform of content.selectedPlatforms) {
    const job = content.platforms[platform];
    if (!job || FROZEN_JOB_STATUSES.has(job.status)) continue;
    job.status = "pending_approval";
    job.approvalHash = null;
    job.lastError = "核准後文案已修改，需重新核准。";
  }
  return { reset: true, captionUpdated: true };
}
