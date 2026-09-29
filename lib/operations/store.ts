import { randomUUID } from "crypto";
import { mkdir, open, readFile, rename, unlink, writeFile } from "fs/promises";
import path from "path";
import * as db from "./dbStore";
import { objectStoreConfigured } from "./objectStore";
import {
  CLAIMABLE_STATUSES,
  DUE_BATCH_LIMIT,
  JOB_LEASE_MS,
  MAX_IMAGES,
  MAX_IMAGE_BYTES,
  MAX_TOTAL_IMAGE_BYTES,
  OperationsStorageUnavailableError,
  adapterFor,
  aggregateContentStatus,
  assertFactCheckApprovable,
  captionFactCheck,
  defaultSubmission,
  dueStatusesFor,
  executeJob,
  getImageContentType,
  jobApprovalHash,
  makePlatformCaptions,
  nextAttemptPlan,
  nowIso as now,
  prepareIntake,
  resolveApprovalAccounts,
  safeFileExtension,
  sha256Hex,
  trimText,
  validFacebookPostUrl,
  type FactCheck,
  type RunMode,
} from "./shared";
import type { ContentIntakeInput, ContentRecord, JobStatus, OperationsEvent, OperationsPlatform, OperationsState, PlatformDraft, StoredImage } from "./types";

export { OperationsStorageUnavailableError, getImageContentType };

/**
 * Operations store entry point.
 *
 *   OPERATIONS_PERSISTENCE_MODE=database  Neon (operations_* tables) + private object storage.
 *                                         Required on Vercel/serverless and in production.
 *   OPERATIONS_PERSISTENCE_MODE=file      Local JSON under an explicit OPERATIONS_DATA_DIR, for
 *                                         isolated tests on a single host only. Refused on Vercel.
 *   unset / incomplete                    Fail closed: every call throws OperationsStorageUnavailableError.
 */

const LOCK_STALE_MS = 10 * 60 * 1000;

function databaseConfigured() {
  const value = process.env.DATABASE_URL?.trim() || "";
  return Boolean(value && !value.includes("replace-with-existing"));
}

export function getOperationsStorageInfo() {
  const requested = process.env.OPERATIONS_PERSISTENCE_MODE?.trim() || "";
  const serverless = Boolean(process.env.VERCEL);
  const dataDirSet = Boolean(process.env.OPERATIONS_DATA_DIR?.trim());
  const database = databaseConfigured();
  const objectStorage = objectStoreConfigured();
  let mode: "database" | "file" | "unavailable" = "unavailable";
  let reason = "OPERATIONS_PERSISTENCE_MODE 未設定";
  if (requested === "database") {
    if (database && objectStorage) {
      mode = "database";
      reason = "ok";
    } else {
      reason = !database ? "資料庫連線未設定" : "物件儲存未設定";
    }
  } else if (requested === "file") {
    if (serverless) reason = "serverless 環境不允許本機檔案模式";
    else if (!dataDirSet) reason = "file 模式需明確設定 OPERATIONS_DATA_DIR";
    else {
      mode = "file";
      reason = "ok (local isolated test mode)";
    }
  } else if (requested) {
    reason = "OPERATIONS_PERSISTENCE_MODE 值無效";
  }
  return {
    mode,
    durable: mode === "database",
    reason,
    requestedMode: requested || "unset",
    serverless,
    databaseConfigured: database,
    objectStorageConfigured: objectStorage,
  } as const;
}

function backend() {
  const info = getOperationsStorageInfo();
  if (info.mode === "unavailable") {
    throw new OperationsStorageUnavailableError({
      reason: info.reason,
      requestedMode: info.requestedMode,
      serverless: info.serverless,
      databaseConfigured: info.databaseConfigured,
      objectStorageConfigured: info.objectStorageConfigured,
    });
  }
  return info.mode;
}

export function getOperationsLimits() {
  return { maxImages: MAX_IMAGES, maxImageBytes: MAX_IMAGE_BYTES, maxTotalImageBytes: MAX_TOTAL_IMAGE_BYTES };
}

// ─── file mode (isolated single-host tests) ─────────────────────────────────

function fileDirs() {
  const dataDir = path.resolve(process.env.OPERATIONS_DATA_DIR!.trim());
  return { dataDir, uploadDir: path.join(dataDir, "uploads"), statePath: path.join(dataDir, "state.json"), lockPath: path.join(dataDir, "state.lock") };
}

let queue = Promise.resolve();

async function withFileLock<T>(work: () => Promise<T>) {
  const { uploadDir, lockPath } = fileDirs();
  await mkdir(uploadDir, { recursive: true });
  let handle: Awaited<ReturnType<typeof open>> | null = null;
  for (let attempt = 0; attempt < 120; attempt += 1) {
    try {
      handle = await open(lockPath, "wx");
      await handle.writeFile(`${process.pid}:${Date.now()}`, "utf8");
      break;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      try {
        const lockAt = Number((await readFile(lockPath, "utf8")).split(":").at(-1));
        if (Number.isFinite(lockAt) && Date.now() - lockAt > LOCK_STALE_MS) await unlink(lockPath);
      } catch (readError) {
        if ((readError as NodeJS.ErrnoException).code !== "ENOENT") throw readError;
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }
  if (!handle) throw new Error("營運資料目前被另一個程序鎖定，請稍後再試");
  try {
    return await work();
  } finally {
    await handle.close();
    await unlink(lockPath).catch(() => undefined);
  }
}

function serialize<T>(work: () => Promise<T>): Promise<T> {
  const next = queue.then(() => withFileLock(work), () => withFileLock(work));
  queue = next.then(() => undefined, () => undefined);
  return next;
}

async function readState(): Promise<OperationsState> {
  const { statePath } = fileDirs();
  try {
    const parsed = JSON.parse(await readFile(statePath, "utf8")) as OperationsState;
    if (parsed.schemaVersion !== 1 || !Array.isArray(parsed.contents) || !Array.isArray(parsed.events)) throw new Error("invalid operations state");
    return parsed;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return { schemaVersion: 1, contents: [], events: [] };
    console.error("[operations] state read failed", error);
    throw new Error("營運資料檔案無法讀取，未執行任何變更");
  }
}

async function writeState(state: OperationsState) {
  const { statePath } = fileDirs();
  const tempPath = `${statePath}.${randomUUID()}.tmp`;
  await writeFile(tempPath, JSON.stringify(state, null, 2), "utf8");
  await rename(tempPath, statePath);
}

function addEvent(state: OperationsState, event: Omit<OperationsEvent, "id" | "at">) {
  state.events.unshift({ id: randomUUID(), at: now(), ...event });
  state.events = state.events.slice(0, 5000);
}

function findJob(state: OperationsState, jobId: string) {
  for (const content of state.contents) {
    for (const platform of content.selectedPlatforms) {
      const job = content.platforms[platform];
      if (job.jobId === jobId) return { content, job };
    }
  }
  return null;
}

async function fileCreateContentDraft(input: ContentIntakeInput) {
  return serialize(async () => {
    const { platforms, parsedImages, fingerprint } = prepareIntake(input);
    const state = await readState();
    const existing = state.contents.find((item) => item.contentFingerprint === fingerprint);
    if (existing) return existing;

    const id = `FUYUN-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${randomUUID().slice(0, 8).toUpperCase()}`;
    const contentUploadDir = path.join(fileDirs().uploadDir, id);
    await mkdir(contentUploadDir, { recursive: true });
    const storedImages: StoredImage[] = [];
    for (let index = 0; index < parsedImages.length; index += 1) {
      const parsed = parsedImages[index];
      const fileName = `image-${index + 1}.${safeFileExtension(parsed.mimeType)}`;
      await writeFile(path.join(contentUploadDir, fileName), parsed.buffer);
      storedImages.push({
        id: randomUUID(),
        originalName: trimText(input.images[index].originalName || fileName, 120),
        mimeType: parsed.mimeType,
        bytes: parsed.buffer.length,
        sha256: sha256Hex(parsed.buffer),
        fileName,
      });
    }

    const timestamp = now();
    const imageUrls = storedImages.map((image) => `/api/operations/content/${id}/images/${image.fileName}`);
    const captions = makePlatformCaptions(input, id);
    const platformsRecord = {} as Record<OperationsPlatform, PlatformDraft>;
    for (const platform of platforms) {
      platformsRecord[platform] = {
        platform,
        caption: captions[platform],
        imageUrl: imageUrls[0] ?? null,
        imageUrls,
        status: "pending_approval",
        jobId: `${id}:${platform}:v1`,
        idempotencyKey: sha256Hex(`${id}:v1:${platform}`),
        attempts: 0,
        scheduledAt: null,
        createdAt: timestamp,
        updatedAt: timestamp,
        lockedUntil: null,
        externalId: null,
        postUrl: null,
        lastError: null,
        verification: "not_tested",
        adapter: adapterFor(platform),
        approvalHash: null,
        factCheck: captionFactCheck(captions[platform], input.tripDate),
        submission: defaultSubmission(),
      };
    }
    const content: ContentRecord = {
      id,
      contentFingerprint: fingerprint,
      version: 1,
      title: trimText(input.title, 120),
      type: input.type,
      tripDate: trimText(input.tripDate, 40),
      body: trimText(input.body, 12000),
      images: storedImages,
      selectedPlatforms: platforms,
      platforms: platformsRecord,
      status: "pending_approval",
      approval: { status: "pending", approvedAt: null, approvedBy: null },
      generationMode: "deterministic_template",
      source: "mobile",
      createdAt: timestamp,
      updatedAt: timestamp,
      revisionOf: null,
      storageMode: "local_json",
    };
    state.contents.unshift(content);
    addEvent(state, { type: "content_created", contentId: id, detail: "mobile intake" });
    await writeState(state);
    return content;
  });
}

async function fileApproveContent(contentId: string, approvedBy: string, scheduledAt: string | null | undefined, acknowledgeFactWarnings: boolean) {
  const accounts = await resolveApprovalAccounts();
  return serialize(async () => {
    const state = await readState();
    const content = state.contents.find((item) => item.id === contentId);
    if (!content) throw new Error("找不到內容");
    if (content.approval.status === "approved") return content;
    const failing = assertFactCheckApprovable(content, acknowledgeFactWarnings);
    const schedule = scheduledAt ? new Date(scheduledAt) : null;
    if (schedule && Number.isNaN(schedule.getTime())) throw new Error("排程日期格式錯誤");
    const timestamp = now();
    const approver = trimText(approvedBy || "admin", 80);
    content.approval = { status: "approved", approvedAt: timestamp, approvedBy: approver };
    content.status = "approved";
    content.updatedAt = timestamp;
    const shas = content.images.map((image) => image.sha256);
    for (const platform of content.selectedPlatforms) {
      const job = content.platforms[platform];
      job.status = schedule && schedule.getTime() > Date.now() ? "scheduled" : "queued";
      job.scheduledAt = schedule?.toISOString() || null;
      job.approvalHash = jobApprovalHash(shas, job, accounts);
      job.factCheck = { ...(job.factCheck as FactCheck), acknowledgedBy: failing.includes(platform) ? approver : null } as FactCheck;
      job.updatedAt = timestamp;
    }
    if (failing.length) addEvent(state, { type: "fact_warnings_acknowledged", contentId, detail: `${approver}: ${failing.join(",")}` });
    addEvent(state, { type: "content_approved", contentId, detail: schedule ? `scheduled:${schedule.toISOString()}` : "approved" });
    await writeState(state);
    return content;
  });
}

async function fileClaimJob(jobId: string, statuses: JobStatus[]) {
  const accounts = await resolveApprovalAccounts();
  return serialize(async () => {
    const state = await readState();
    const found = findJob(state, jobId);
    if (!found) return null;
    const { content, job } = found;
    const lockActive = job.lockedUntil && new Date(job.lockedUntil).getTime() > Date.now();
    if (lockActive || !statuses.includes(job.status)) return null;
    if (job.scheduledAt && new Date(job.scheduledAt).getTime() > Date.now()) return null;
    if (content.approval.status !== "approved") return null;
    // Every not-yet-executed job of the content must still match its approval snapshot.
    const shas = content.images.map((image) => image.sha256);
    const changed = content.selectedPlatforms
      .map((platform) => content.platforms[platform])
      .find((sibling) => CLAIMABLE_STATUSES.includes(sibling.status) && (!sibling.approvalHash || sibling.approvalHash !== jobApprovalHash(shas, sibling, accounts)));
    if (changed) {
      for (const platform of content.selectedPlatforms) {
        const sibling = content.platforms[platform];
        if (!CLAIMABLE_STATUSES.includes(sibling.status)) continue;
        sibling.status = "pending_approval";
        sibling.approvalHash = null;
        sibling.lastError = "核准後內容、圖片或目標帳號已變更；原核准失效，需重新核准。";
        sibling.updatedAt = now();
      }
      content.approval = { status: "pending", approvedAt: null, approvedBy: null };
      content.status = "pending_approval";
      addEvent(state, { type: "approval_invalidated", contentId: content.id, jobId: changed.jobId, platform: changed.platform, detail: "approval hash mismatch" });
      await writeState(state);
      return null;
    }
    job.status = "processing";
    job.attempts += 1;
    job.lockedUntil = new Date(Date.now() + JOB_LEASE_MS).toISOString();
    job.updatedAt = now();
    addEvent(state, { type: "job_claimed", contentId: content.id, jobId, platform: job.platform, detail: job.idempotencyKey });
    await writeState(state);
    return { content, job, accounts };
  });
}

async function fileRecoverExpired() {
  return serialize(async () => {
    const state = await readState();
    let recovered = 0;
    for (const content of state.contents) {
      for (const platform of content.selectedPlatforms) {
        const job = content.platforms[platform];
        if (job.status !== "processing" || !job.lockedUntil || new Date(job.lockedUntil).getTime() > Date.now()) continue;
        job.status = "submitted_pending_verification";
        job.verification = "pending";
        job.lockedUntil = null;
        job.lastError = "程序或工作鎖已逾時；外部結果可能已成功，已停止自動重送，請先人工核對。";
        job.submission = { ...(job.submission || defaultSubmission()), phase: "submitted_pending_verification" };
        job.updatedAt = now();
        addEvent(state, { type: "job_recovered_ambiguous", contentId: content.id, jobId: job.jobId, platform, detail: "lease expired; manual reconciliation required" });
        recovered += 1;
      }
    }
    if (recovered) await writeState(state);
    return recovered;
  });
}

async function fileRunJob(jobId: string, mode: RunMode, statuses: JobStatus[]) {
  const claimed = await fileClaimJob(jobId, statuses);
  if (!claimed) return { success: false, status: "not_claimed", error: "工作不存在、未核准、尚在鎖定中或尚未到排程時間" };
  const result = await executeJob(claimed.job, mode, {
    markSubmission: async (patch) => {
      await serialize(async () => {
        const state = await readState();
        const found = findJob(state, jobId);
        if (!found) return;
        found.job.submission = { ...(found.job.submission || defaultSubmission()), ...patch };
        found.job.updatedAt = now();
        await writeState(state);
      });
    },
    // File mode has no public object storage; Instagram publishing requires database mode.
    instagramImageUrls: async () => [],
    approvedInstagramAccount: claimed.accounts.instagram,
  });
  const plan = nextAttemptPlan(result, claimed.job.attempts);
  return serialize(async () => {
    const state = await readState();
    const current = findJob(state, jobId);
    if (!current) return { success: false, status: "missing", error: "工作在執行期間消失" };
    current.job.status = plan.status;
    if (plan.scheduledAt !== undefined) current.job.scheduledAt = plan.scheduledAt?.toISOString() ?? null;
    current.job.lastError = plan.error || null;
    current.job.externalId = result.externalId || current.job.externalId;
    current.job.postUrl = result.postUrl || current.job.postUrl;
    current.job.verification = result.verification || "not_tested";
    current.job.lockedUntil = null;
    current.job.updatedAt = now();
    current.content.status = aggregateContentStatus(current.content.selectedPlatforms.map((platform) => current.content.platforms[platform].status), current.content.status);
    current.content.updatedAt = now();
    addEvent(state, { type: "job_result", contentId: current.content.id, jobId, platform: current.job.platform, detail: plan.error || plan.status });
    await writeState(state);
    return { success: plan.status === "dry_run_verified" || plan.status === "published", status: plan.status, job: current.job, content: current.content };
  });
}

// ─── public API (dispatches to the configured backend) ──────────────────────

export async function listContentRecords() {
  return backend() === "database" ? db.listContentRecords() : serialize(async () => (await readState()).contents);
}

export async function getContentRecord(contentId: string) {
  if (backend() === "database") return db.getContentRecord(contentId);
  return serialize(async () => (await readState()).contents.find((content) => content.id === contentId) || null);
}

export async function createContentDraft(input: ContentIntakeInput) {
  return backend() === "database" ? db.createContentDraft(input) : fileCreateContentDraft(input);
}

export async function approveContent(contentId: string, approvedBy: string, scheduledAt?: string | null, acknowledgeFactWarnings = false) {
  return backend() === "database"
    ? db.approveContent(contentId, approvedBy, scheduledAt, acknowledgeFactWarnings)
    : fileApproveContent(contentId, approvedBy, scheduledAt, acknowledgeFactWarnings);
}

export async function runJob(jobId: string, mode: RunMode = "dry-run") {
  return backend() === "database" ? db.runJob(jobId, mode, CLAIMABLE_STATUSES) : fileRunJob(jobId, mode, CLAIMABLE_STATUSES);
}

export async function getJob(jobId: string) {
  if (backend() === "database") return db.getJob(jobId);
  return serialize(async () => {
    const found = findJob(await readState(), jobId);
    return found ? { content: found.content, job: found.job } : null;
  });
}

export async function recordFacebookManualResult(jobId: string, externalId: string, postUrl: string) {
  if (backend() === "database") return db.recordFacebookManualResult(jobId, externalId, postUrl);
  const safeExternalId = trimText(externalId, 240);
  const safePostUrl = postUrl.trim();
  if (!safeExternalId || /[\r\n]/.test(safeExternalId) || !validFacebookPostUrl(safePostUrl)) {
    throw new Error("請填入 Facebook 貼文外部 ID 與有效的 HTTPS 貼文網址");
  }
  return serialize(async () => {
    const state = await readState();
    const found = findJob(state, jobId);
    if (!found || found.job.platform !== "facebook_group") throw new Error("找不到 Facebook 社團工作");
    if (found.content.approval.status !== "approved") throw new Error("內容尚未核准，不能回填外部貼文");
    found.job.externalId = safeExternalId;
    found.job.postUrl = safePostUrl;
    found.job.status = "manual_required";
    found.job.verification = "pending";
    found.job.lastError = "已回填 Facebook 社團貼文連結；請人工開啟網址核對內容、照片與社團身份。";
    found.job.lockedUntil = null;
    found.job.updatedAt = now();
    found.content.updatedAt = now();
    addEvent(state, { type: "manual_result_recorded", contentId: found.content.id, jobId, platform: "facebook_group", detail: "external URL recorded; manual verification pending" });
    await writeState(state);
    return { content: found.content, job: found.job };
  });
}

/** Website takedown exists only in database mode, where published articles are created. */
export async function withdrawWebsiteJob(jobId: string, by: string) {
  if (backend() !== "database") throw new Error("此儲存模式沒有官網文章可下架");
  return db.withdrawWebsiteJob(jobId, by);
}

export async function runDueJobs(mode: RunMode = process.env.OPERATIONS_LIVE_PUBLISH_ENABLED === "true" ? "live" : "dry-run") {
  if (backend() === "database") return db.runDueJobs(mode);
  await fileRecoverExpired();
  const statuses = dueStatusesFor(mode);
  const state = await serialize(() => readState());
  const due = state.contents
    .filter((content) => content.approval.status === "approved")
    .flatMap((content) => content.selectedPlatforms.map((platform) => content.platforms[platform]))
    .filter((job) => statuses.includes(job.status) && (!job.scheduledAt || new Date(job.scheduledAt).getTime() <= Date.now()));
  const results = [];
  for (const job of due.slice(0, DUE_BATCH_LIMIT)) results.push(await fileRunJob(job.jobId, mode, statuses));
  return results;
}

/** New credentials were stored: parked awaiting_auth jobs for that platform become due again. */
export async function requeueAwaitingAuth(platform: OperationsPlatform) {
  if (backend() === "database") return db.requeueAwaitingAuth(platform);
  return serialize(async () => {
    const state = await readState();
    let requeued = 0;
    for (const content of state.contents) {
      const job = content.platforms[platform];
      if (!job || job.status !== "awaiting_auth") continue;
      job.status = "queued";
      job.scheduledAt = null;
      job.lastError = null;
      job.updatedAt = now();
      addEvent(state, { type: "job_requeued_after_auth", contentId: content.id, jobId: job.jobId, platform, detail: "credentials changed" });
      requeued += 1;
    }
    if (requeued) await writeState(state);
    return requeued;
  });
}

/** Image bytes for the authenticated admin route (object storage in database mode). */
export async function readImage(contentId: string, fileName: string) {
  if (backend() === "database") return db.readImage(contentId, fileName);
  const record = await getContentRecord(contentId);
  const image = record?.images.find((item) => item.fileName === fileName);
  if (!image) return null;
  const buffer = await readFile(path.join(fileDirs().uploadDir, contentId, fileName));
  if (sha256Hex(buffer) !== image.sha256) return null;
  return { buffer, contentType: getImageContentType(fileName) };
}

export function isValidJobStatus(status: string): status is JobStatus {
  return ["draft", "pending_approval", "approved", "queued", "scheduled", "processing", "submitted_pending_verification", "published", "awaiting_auth", "retryable_failed", "manual_required", "blocked_platform", "dry_run_verified"].includes(status as JobStatus);
}
