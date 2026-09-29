export const OPERATIONS_PLATFORMS = ["website", "facebook_group", "instagram"] as const;
export type OperationsPlatform = (typeof OPERATIONS_PLATFORMS)[number];

export const CONTENT_TYPES = ["招生", "回顧"] as const;
export type ContentType = (typeof CONTENT_TYPES)[number];

export const JOB_STATUSES = [
  "draft",
  "pending_approval",
  "approved",
  "queued",
  "scheduled",
  "processing",
  "submitted_pending_verification",
  "published",
  "awaiting_auth",
  "retryable_failed",
  "manual_required",
  "blocked_platform",
  "dry_run_verified",
  /** Published website article taken down by an admin; never picked up again. */
  "withdrawn",
] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export interface StoredImage {
  id: string;
  originalName: string;
  mimeType: string;
  bytes: number;
  sha256: string;
  fileName: string;
  publicUrl?: string;
  instagramPublicUrl?: string;
  /** Object-store key (database mode); objects are private and served through the admin route. */
  storageKey?: string;
  instagramStorageKey?: string;
}

export interface PlatformDraft {
  platform: OperationsPlatform;
  caption: string;
  imageUrl: string | null;
  imageUrls?: string[];
  status: JobStatus;
  jobId: string;
  idempotencyKey: string;
  attempts: number;
  scheduledAt: string | null;
  createdAt: string;
  updatedAt: string;
  lockedUntil: string | null;
  externalId: string | null;
  postUrl: string | null;
  lastError: string | null;
  verification: "not_tested" | "pending" | "verified" | "failed";
  adapter: "website_article" | "website_preview" | "facebook_group_manual" | "instagram_graph" | "instagram_login_v2";
  /** sha256 over the exact caption, image hashes, platform and target account at approval time. */
  approvalHash?: string | null;
  /** Deterministic fact check of the caption (lib/operations/contentGuard.mjs). */
  factCheck?: { ok: boolean; violations: { code: string; detail: string }[] };
  submission?: {
    phase: "not_started" | "container_creating" | "container_created" | "publish_intent" | "submitted_pending_verification";
    containerIds: string[];
    carouselContainerId: string | null;
    publishIntentAt: string | null;
    submittedAt: string | null;
  };
}

export interface ContentRecord {
  id: string;
  contentFingerprint: string;
  version: number;
  title: string;
  type: ContentType;
  tripDate: string;
  body: string;
  images: StoredImage[];
  selectedPlatforms: OperationsPlatform[];
  platforms: Record<OperationsPlatform, PlatformDraft>;
  status: "draft" | "pending_approval" | "approved" | "partial" | "completed";
  approval: {
    status: "pending" | "approved";
    approvedAt: string | null;
    approvedBy: string | null;
  };
  generationMode: "deterministic_template";
  source: "mobile";
  createdAt: string;
  updatedAt: string;
  revisionOf: string | null;
  storageMode?: "local_json" | "database+r2";
}

export interface OperationsEvent {
  id: string;
  at: string;
  type: string;
  contentId: string;
  jobId?: string;
  platform?: OperationsPlatform;
  detail?: string;
}

export interface OperationsState {
  schemaVersion: 1;
  contents: ContentRecord[];
  events: OperationsEvent[];
}

export interface IntakeImage {
  dataUrl: string;
  originalName?: string;
}

export interface ContentIntakeInput {
  title: string;
  type: ContentType;
  tripDate: string;
  body: string;
  selectedPlatforms: OperationsPlatform[];
  images: IntakeImage[];
  publicImageUrls?: string[];
}
