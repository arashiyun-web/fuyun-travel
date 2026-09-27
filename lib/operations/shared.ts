import { createHash } from "crypto";
import { createInstagramLoginClientV2, InstagramV2Error } from "@/lib/social/instagram-login-v2";
import { clearStoredInstagramLoginTokenFromEnvironment, readStoredInstagramLoginTokenFromEnvironment } from "@/lib/social/instagram-oauth";
import { approvalHash, validateGenerated } from "./contentGuard";
import type { ContentIntakeInput, ContentRecord, JobStatus, OperationsPlatform, PlatformDraft } from "./types";

/** Logic shared by the local file store and the database store. */

export const MAX_IMAGES = 6;
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
export const MAX_TOTAL_IMAGE_BYTES = 20 * 1024 * 1024;
export const JOB_LEASE_MS = 5 * 60 * 1000;
export const DUE_BATCH_LIMIT = 20;
export const CLAIMABLE_STATUSES: JobStatus[] = ["queued", "scheduled", "retryable_failed", "awaiting_auth", "manual_required"];
/** manual_required waits for a person (Facebook group post, live switch off); it only re-runs when explicitly requested. */
export const AUTO_DUE_STATUSES: JobStatus[] = ["queued", "scheduled", "retryable_failed", "awaiting_auth"];

export type RunMode = "dry-run" | "live";
export type JobSubmission = NonNullable<PlatformDraft["submission"]>;
export type JobResult = { status: JobStatus; error?: string; externalId?: string; postUrl?: string; verification?: PlatformDraft["verification"] };
export type FactCheck = NonNullable<PlatformDraft["factCheck"]> & { acknowledgedBy?: string | null };

export class OperationsStorageUnavailableError extends Error {
  constructor(public readonly diagnostic: Record<string, boolean | string>) {
    super("營運資料的正式持久化尚未配置完成，已拒絕寫入以避免資料遺失");
    this.name = "OperationsStorageUnavailableError";
  }
}

export function nowIso() {
  return new Date().toISOString();
}

export function trimText(value: string, max: number) {
  return value.trim().slice(0, max);
}

export function safeFileExtension(mimeType: string) {
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  return "jpg";
}

export function getImageContentType(fileName: string) {
  if (fileName.endsWith(".png")) return "image/png";
  if (fileName.endsWith(".webp")) return "image/webp";
  return "image/jpeg";
}

export function parseImage(dataUrl: string) {
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=\r\n]+)$/.exec(dataUrl.trim());
  if (!match) throw new Error("圖片格式只接受 JPEG、PNG 或 WebP");
  const buffer = Buffer.from(match[2].replace(/\s/g, ""), "base64");
  if (!buffer.length || buffer.length > MAX_IMAGE_BYTES) throw new Error("單張圖片不可超過 8 MB");
  return { mimeType: match[1], buffer };
}

export function sha256Hex(buffer: Buffer | string) {
  return createHash("sha256").update(buffer).digest("hex");
}

/** Validate intake and return parsed images plus the dedupe fingerprint. */
export function prepareIntake(input: ContentIntakeInput) {
  if (!input.title.trim() || !input.body.trim() || !input.tripDate.trim()) throw new Error("標題、日期與行程文字必填");
  if (!input.images.length || input.images.length > MAX_IMAGES) throw new Error(`圖片數量需介於 1 到 ${MAX_IMAGES} 張`);
  const platforms = Array.from(new Set(input.selectedPlatforms));
  if (!platforms.length) throw new Error("至少選擇一個發布平台");
  const parsedImages = input.images.map((image) => parseImage(image.dataUrl));
  const totalBytes = parsedImages.reduce((total, image) => total + image.buffer.length, 0);
  if (totalBytes > MAX_TOTAL_IMAGE_BYTES) throw new Error("全部圖片不可超過 20 MB");
  const fingerprint = sha256Hex(JSON.stringify({
    title: trimText(input.title, 120),
    type: input.type,
    tripDate: trimText(input.tripDate, 40),
    body: trimText(input.body, 12000),
    selectedPlatforms: platforms.slice().sort(),
    images: parsedImages.map((image, index) => ({ sha256: sha256Hex(image.buffer), originalName: trimText(input.images[index].originalName || "", 120) })),
  }));
  return { platforms, parsedImages, fingerprint };
}

function topicTag(title: string) {
  const tag = title.replace(/[^一-鿿A-Za-z0-9]/g, "").slice(0, 16);
  return tag || "台灣旅遊";
}

export function makePlatformCaptions(input: ContentIntakeInput, contentId: string) {
  const dateLine = `出遊／預定出發日期：${input.tripDate}`;
  const inquiryLine = `詢價請提供內容編號：${contentId}`;
  const website = [`# ${input.title}`, "", input.body, "", dateLine, inquiryLine].join("\n");
  const facebook = [`【${input.title}】`, input.type === "回顧" ? "這次實際走過的行程分享：" : "行程招生資訊：", input.body, "", dateLine, inquiryLine].join("\n");
  const instagramBase = [input.title, input.body, dateLine].join("\n\n");
  const instagram = `${instagramBase}\n\n#浮雲輕鬆遊 #台灣包車 #團體旅遊 #${topicTag(input.title)}`.slice(0, 2100);
  return { website, facebook_group: facebook, instagram } satisfies Record<OperationsPlatform, string>;
}

export function adapterFor(platform: OperationsPlatform): PlatformDraft["adapter"] {
  if (platform === "website") return "website_preview";
  if (platform === "facebook_group") return "facebook_group_manual";
  return "instagram_login_v2";
}

/** Target account the approval is bound to; changing it invalidates earlier approvals. */
export function platformAccount(platform: OperationsPlatform) {
  if (platform === "instagram") return `instagram:${process.env.INSTAGRAM_LOGIN_ACCOUNT_ID?.trim() || "unset"}`;
  if (platform === "facebook_group") return "facebook_group:小羽旅遊趣";
  return "website:fuyuntravel.com";
}

export function jobApprovalHash(imageSha256s: string[], job: Pick<PlatformDraft, "caption" | "platform">) {
  return approvalHash({ text: job.caption, imageSha256s, platform: job.platform, account: platformAccount(job.platform) });
}

/** Captions are template output from staff input; the staff-entered trip date is the only approved date. */
export function captionFactCheck(caption: string, tripDate: string): FactCheck {
  return validateGenerated(caption, { version: "intake", dates: [tripDate.trim()], includes: [], excludes: [] });
}

/** Approval is refused while any selected platform has unacknowledged fact-check violations. */
export function assertFactCheckApprovable(content: ContentRecord, acknowledgeFactWarnings: boolean) {
  const failing = content.selectedPlatforms.filter((platform) => content.platforms[platform].factCheck?.ok === false);
  if (failing.length && !acknowledgeFactWarnings) {
    throw new Error(`內容事實檢查未通過（${failing.join("、")}）：價格、日期、名額或包含項目需有核准來源；請修改內容，或由核准人明確確認後再核准`);
  }
  return failing;
}

export function aggregateContentStatus(statuses: JobStatus[], current: ContentRecord["status"]): ContentRecord["status"] {
  if (statuses.every((status) => status === "published" || status === "dry_run_verified")) return "completed";
  if (statuses.some((status) => ["published", "dry_run_verified"].includes(status))) return "partial";
  return current;
}

export function defaultSubmission(): JobSubmission {
  return { phase: "not_started", containerIds: [], carouselContainerId: null, publishIntentAt: null, submittedAt: null };
}

export function validFacebookPostUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && ["facebook.com", "www.facebook.com", "m.facebook.com"].includes(url.hostname.toLowerCase()) &&
      Boolean(url.pathname) && !url.username && !url.password && !url.hash;
  } catch {
    return false;
  }
}

async function instagramV2Client() {
  if (process.env.OPERATIONS_INSTAGRAM_V2_ENABLED !== "true") throw new InstagramV2Error("configuration");
  const directAccountId = process.env.INSTAGRAM_LOGIN_ACCOUNT_ID?.trim() || "";
  const directAccessToken = process.env.INSTAGRAM_LOGIN_ACCESS_TOKEN?.trim() || "";
  let storedToken = null;
  if (!directAccessToken) {
    try {
      storedToken = await readStoredInstagramLoginTokenFromEnvironment();
    } catch {
      throw new InstagramV2Error("configuration");
    }
  }
  const accountId = directAccountId || storedToken?.accountId || "";
  const accessToken = directAccessToken || storedToken?.accessToken || "";
  const apiVersion = process.env.INSTAGRAM_LOGIN_API_VERSION?.trim() || "";
  const mediaOrigin = process.env.INSTAGRAM_LOGIN_MEDIA_ORIGIN?.trim() || "";
  if (!accountId || !accessToken || !apiVersion || !mediaOrigin) throw new InstagramV2Error("configuration");
  return createInstagramLoginClientV2({ accountId, accessToken, apiVersion, mediaOrigins: [mediaOrigin] });
}

export type ExecuteDeps = {
  /** Persist a submission phase before each external step so a crash never causes a blind resend. */
  markSubmission: (patch: Partial<JobSubmission>) => Promise<void>;
  /** Resolve HTTPS image URLs Instagram can fetch (e.g. short-lived presigned URLs). */
  instagramImageUrls: () => Promise<string[]>;
};

async function submitInstagramV2Job(job: PlatformDraft, deps: ExecuteDeps) {
  const client = await instagramV2Client();
  const imageUrls = (await deps.instagramImageUrls()).filter(Boolean);
  if (!imageUrls.length || imageUrls.length > 10 || imageUrls.some((url) => !url.startsWith("https://"))) throw new InstagramV2Error("input");
  const isCarousel = imageUrls.length > 1;

  await deps.markSubmission({ phase: "container_creating", containerIds: [], carouselContainerId: null, publishIntentAt: null, submittedAt: null });
  const childContainerIds: string[] = [];
  if (isCarousel) {
    for (const imageUrl of imageUrls) {
      const child = await client.createImageContainer({ imageUrl, mimeType: "image/jpeg", isCarouselItem: true });
      childContainerIds.push(child.containerId);
      await deps.markSubmission({ phase: "container_creating", containerIds: [...childContainerIds] });
    }
  } else {
    const image = await client.createImageContainer({ caption: job.caption, imageUrl: imageUrls[0], mimeType: "image/jpeg" });
    childContainerIds.push(image.containerId);
    await deps.markSubmission({ phase: "container_created", containerIds: [...childContainerIds] });
  }
  let publishContainerId = childContainerIds[0];
  if (isCarousel) {
    const carousel = await client.createCarouselContainer({ caption: job.caption, children: childContainerIds });
    publishContainerId = carousel.containerId;
    await deps.markSubmission({ phase: "container_created", containerIds: [...childContainerIds], carouselContainerId: publishContainerId });
  }
  const containerStatus = await client.getContainerStatus(publishContainerId);
  if (!["FINISHED", "PUBLISHED"].includes(containerStatus.status)) throw new InstagramV2Error("unknown");
  await deps.markSubmission({ phase: "publish_intent", publishIntentAt: nowIso() });
  const published = await client.publishContainer(publishContainerId);
  await deps.markSubmission({ phase: "submitted_pending_verification", submittedAt: nowIso() });
  const verified = await client.verifyPublishedMedia(published.mediaId, job.caption, isCarousel ? "CAROUSEL" : "IMAGE");
  return { externalId: published.mediaId, postUrl: verified.postUrl };
}

/** Decide and (in live mode) perform the external action for one already-claimed job. */
export async function executeJob(job: PlatformDraft, mode: RunMode, deps: ExecuteDeps): Promise<JobResult> {
  const factCheck = job.factCheck as FactCheck | undefined;
  if (mode === "dry-run") {
    return { status: "dry_run_verified", verification: "verified", error: `乾跑完成：${job.platform} adapter=${job.adapter}，未對外發布。` };
  }
  if (process.env.OPERATIONS_LIVE_PUBLISH_ENABLED !== "true") {
    return { status: "manual_required", verification: "pending", error: "正式發布總開關未啟用；已保留草稿與工作結果。" };
  }
  if (factCheck && factCheck.ok === false && !factCheck.acknowledgedBy) {
    return { status: "manual_required", verification: "pending", error: "內容事實檢查未通過且未經核准人確認；未對外發布。" };
  }
  if (job.platform === "facebook_group") {
    return { status: "manual_required", verification: "pending", error: "Facebook 社團不使用粉專 API；需老闆在核對社團身份後於正常介面送出。" };
  }
  if (job.platform === "website") {
    return { status: "manual_required", verification: "pending", error: "官網正式頁面尚未提供可逆 CMS 發布接口；本次只完成預覽與可交接草稿。" };
  }
  // Keep the in-memory submission in step with what was persisted, so the error path below
  // sees created containers and never classifies a possibly-sent job as retryable.
  const tracked: ExecuteDeps = {
    ...deps,
    markSubmission: async (patch) => {
      job.submission = { ...(job.submission || defaultSubmission()), ...patch };
      await deps.markSubmission(patch);
    },
  };
  try {
    const published = await submitInstagramV2Job(job, tracked);
    return { status: "published", externalId: published.externalId, postUrl: published.postUrl, verification: "verified" };
  } catch (error) {
    const v2Error = error instanceof InstagramV2Error ? error : null;
    if (v2Error?.kind === "authorization") await clearStoredInstagramLoginTokenFromEnvironment().catch(() => false);
    if (v2Error?.kind === "configuration" || v2Error?.kind === "authorization" || v2Error?.kind === "input") {
      return { status: "awaiting_auth", verification: "pending", error: "Instagram V2 尚未具備可用授權、公開 JPEG 圖片或正式設定；未對外重送。" };
    }
    if (v2Error?.mayHaveSucceeded || v2Error?.kind === "unknown" || job.submission?.containerIds.length || job.submission?.carouselContainerId) {
      return { status: "submitted_pending_verification", verification: "pending", error: "Instagram 回應結果不明或容器已建立；已保留提交狀態，未自動重送。" };
    }
    return { status: "retryable_failed", verification: "failed", error: "Instagram V2 拒絕此次發布；未將其標記為成功。" };
  }
}
