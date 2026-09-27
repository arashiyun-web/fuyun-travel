import { createHash, randomUUID } from "crypto";
import { mkdir, open, readFile, rename, unlink, writeFile } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/prisma";
import { uploadToR2 } from "@/lib/storage/r2";
import { createInstagramLoginClientV2, InstagramV2Error } from "@/lib/social/instagram-login-v2";
import { clearStoredInstagramLoginTokenFromEnvironment, readStoredInstagramLoginTokenFromEnvironment } from "@/lib/social/instagram-oauth";
import sharp from "sharp";
import { approvalHash, validateGenerated } from "./contentGuard";
import type {
  ContentIntakeInput,
  ContentRecord,
  JobStatus,
  OperationsEvent,
  OperationsPlatform,
  OperationsState,
  PlatformDraft,
  StoredImage,
} from "./types";

const MAX_IMAGES = 6;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_TOTAL_IMAGE_BYTES = 20 * 1024 * 1024;
const JOB_LEASE_MS = 5 * 60 * 1000;
const LOCK_STALE_MS = 10 * 60 * 1000;

const dataDir = process.env.OPERATIONS_DATA_DIR || path.join(process.cwd(), "data", "operations");
const uploadDir = path.join(dataDir, "uploads");
const statePath = path.join(dataDir, "state.json");
const lockPath = path.join(dataDir, "state.lock");
let queue = Promise.resolve();

async function withFileLock<T>(work: () => Promise<T>) {
  await ensureStorage();
  let handle: Awaited<ReturnType<typeof open>> | null = null;
  for (let attempt = 0; attempt < 120; attempt += 1) {
    try {
      handle = await open(lockPath, "wx");
      await handle.writeFile(`${process.pid}:${Date.now()}`, "utf8");
      break;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      try {
        const lockStat = await readFile(lockPath, "utf8");
        const lockAt = Number(lockStat.split(":").at(-1));
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

function now() {
  return new Date().toISOString();
}

function defaultState(): OperationsState {
  return { schemaVersion: 1, contents: [], events: [] };
}

async function ensureStorage() {
  await mkdir(uploadDir, { recursive: true });
}

async function readState(): Promise<OperationsState> {
  await ensureStorage();
  try {
    const raw = await readFile(statePath, "utf8");
    const parsed = JSON.parse(raw) as OperationsState;
    if (parsed.schemaVersion !== 1 || !Array.isArray(parsed.contents) || !Array.isArray(parsed.events)) {
      throw new Error("invalid operations state");
    }
    return parsed;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return defaultState();
    console.error("[operations] state read failed", error);
    throw new Error("營運資料檔案無法讀取，未執行任何變更");
  }
}

async function writeState(state: OperationsState) {
  await ensureStorage();
  const tempPath = `${statePath}.${randomUUID()}.tmp`;
  await writeFile(tempPath, JSON.stringify(state, null, 2), "utf8");
  await rename(tempPath, statePath);
}

function databaseConfigured() {
  const value = process.env.DATABASE_URL?.trim() || "";
  return Boolean(value && !value.includes("replace-with-existing"));
}

function r2Configured() {
  return Boolean(process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY && process.env.R2_BUCKET_NAME && process.env.R2_PUBLIC_URL);
}

function databaseMode() {
  return process.env.OPERATIONS_PERSISTENCE_MODE === "database";
}

export function getOperationsStorageInfo() {
  const durable = databaseMode() && databaseConfigured() && r2Configured();
  const mode = databaseMode() ? (durable ? "database+r2" : "database_unavailable") : "local_json";
  return {
    mode,
    durable,
    databaseConfigured: databaseConfigured(),
    objectStorageConfigured: r2Configured(),
    requireDurable: process.env.OPERATIONS_REQUIRE_DURABLE_STORAGE === "true",
    dataDir,
  } as const;
}

function operationRecord(value: unknown): ContentRecord | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Partial<ContentRecord>;
  if (typeof record.id !== "string" || typeof record.title !== "string" || !record.platforms || typeof record.platforms !== "object") return null;
  return record as ContentRecord;
}

async function readDatabaseContents() {
  const rows = await prisma.contentDraft.findMany({ orderBy: { createdAt: "desc" }, take: 500 });
  return rows
    .filter((row) => Boolean((row.inputJson as { _operations?: boolean } | null)?._operations))
    .map((row) => operationRecord(row.outputJson))
    .filter((record): record is ContentRecord => Boolean(record));
}

async function upsertDatabaseContent(content: ContentRecord) {
  const serialized = JSON.parse(JSON.stringify(content));
  await prisma.contentDraft.upsert({
    where: { id: content.id },
    create: {
      id: content.id,
      tripTitle: content.title,
      inputJson: { _operations: true, type: content.type, tripDate: content.tripDate, source: content.source },
      outputJson: serialized,
      imageUrls: content.images.map((image) => image.publicUrl || ""),
      coverImageUrl: content.images[0]?.publicUrl || null,
      status: content.status,
      createdAt: new Date(content.createdAt),
      updatedAt: new Date(content.updatedAt),
    },
    update: {
      tripTitle: content.title,
      outputJson: serialized,
      imageUrls: content.images.map((image) => image.publicUrl || ""),
      coverImageUrl: content.images[0]?.publicUrl || null,
      status: content.status,
      updatedAt: new Date(content.updatedAt),
    },
  });
}

async function persistState(state: OperationsState) {
  if (databaseMode()) {
    if (!databaseConfigured() || !r2Configured()) throw new Error("database 模式需要既有 DATABASE_URL 與 R2 物件儲存設定");
    for (const content of state.contents) await upsertDatabaseContent(content);
    return;
  }
  await writeState(state);
}

function addEvent(state: OperationsState, event: Omit<OperationsEvent, "id" | "at">) {
  state.events.unshift({ id: randomUUID(), at: now(), ...event });
  state.events = state.events.slice(0, 5000);
}

function safeFileExtension(mimeType: string) {
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  return "jpg";
}

function parseImage(dataUrl: string) {
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=\r\n]+)$/.exec(dataUrl.trim());
  if (!match) throw new Error("圖片格式只接受 JPEG、PNG 或 WebP");
  const buffer = Buffer.from(match[2].replace(/\s/g, ""), "base64");
  if (!buffer.length || buffer.length > MAX_IMAGE_BYTES) throw new Error("單張圖片不可超過 8 MB");
  return { mimeType: match[1], buffer };
}

function trimText(value: string, max: number) {
  return value.trim().slice(0, max);
}

function topicTag(title: string) {
  const tag = title.replace(/[^\u4e00-\u9fffA-Za-z0-9]/g, "").slice(0, 16);
  return tag || "台灣旅遊";
}

function makePlatformCaptions(input: ContentIntakeInput, contentId: string, imageUrl: string | null) {
  const dateLine = `出遊／預定出發日期：${input.tripDate}`;
  const inquiryLine = `詢價請提供內容編號：${contentId}`;
  const website = [`# ${input.title}`, "", input.body, "", dateLine, inquiryLine].join("\n");
  const facebook = [`【${input.title}】`, input.type === "回顧" ? "這次實際走過的行程分享：" : "行程招生資訊：", input.body, "", dateLine, inquiryLine].join("\n");
  const instagramBase = [input.title, input.body, dateLine].join("\n\n");
  const instagram = `${instagramBase}\n\n#浮雲輕鬆遊 #台灣包車 #團體旅遊 #${topicTag(input.title)}`.slice(0, 2100);
  return {
    website: { caption: website, imageUrl },
    facebook_group: { caption: facebook, imageUrl },
    instagram: { caption: instagram, imageUrl },
  } satisfies Record<OperationsPlatform, { caption: string; imageUrl: string | null }>;
}

/** Target account the approval is bound to; changing it invalidates earlier approvals. */
function platformAccount(platform: OperationsPlatform) {
  if (platform === "instagram") return `instagram:${process.env.INSTAGRAM_LOGIN_ACCOUNT_ID?.trim() || "unset"}`;
  if (platform === "facebook_group") return "facebook_group:小羽旅遊趣";
  return "website:fuyuntravel.com";
}

function jobApprovalHash(content: ContentRecord, job: PlatformDraft) {
  return approvalHash({
    text: job.caption,
    imageSha256s: content.images.map((image) => image.sha256),
    platform: job.platform,
    account: platformAccount(job.platform),
  });
}

/** Captions are template output from staff input; the staff-entered trip date is the only approved date. */
function captionFactCheck(caption: string, tripDate: string) {
  return validateGenerated(caption, { version: "intake", dates: [tripDate.trim()], includes: [], excludes: [] });
}

function adapterFor(platform: OperationsPlatform): PlatformDraft["adapter"] {
  if (platform === "website") return "website_preview";
  if (platform === "facebook_group") return "facebook_group_manual";
  return "instagram_login_v2";
}

export function getOperationsLimits() {
  return { maxImages: MAX_IMAGES, maxImageBytes: MAX_IMAGE_BYTES, maxTotalImageBytes: MAX_TOTAL_IMAGE_BYTES };
}

export async function listContentRecords() {
  return serialize(async () => databaseMode() ? await readDatabaseContents() : (await readState()).contents);
}

export async function getContentRecord(contentId: string) {
  return serialize(async () => {
    const contents = databaseMode() ? await readDatabaseContents() : (await readState()).contents;
    return contents.find((content) => content.id === contentId) || null;
  });
}

export async function createContentDraft(input: ContentIntakeInput) {
  return serialize(async () => {
    if (!input.title.trim() || !input.body.trim() || !input.tripDate.trim()) throw new Error("標題、日期與行程文字必填");
    if (!input.images.length || input.images.length > MAX_IMAGES) throw new Error(`圖片數量需介於 1 到 ${MAX_IMAGES} 張`);
    const platforms = Array.from(new Set(input.selectedPlatforms));
    if (!platforms.length) throw new Error("至少選擇一個發布平台");
    const storage = getOperationsStorageInfo();
    if ((storage.requireDurable || databaseMode()) && !storage.durable) throw new Error("目前尚未配置可跨程序／跨實例的正式持久化，已拒絕收件以避免資料遺失");

    const parsedImages = input.images.map((image) => parseImage(image.dataUrl));
    const totalBytes = parsedImages.reduce((total, image) => total + image.buffer.length, 0);
    if (totalBytes > MAX_TOTAL_IMAGE_BYTES) throw new Error("全部圖片不可超過 20 MB");
    const contentFingerprint = createHash("sha256")
      .update(JSON.stringify({
        title: trimText(input.title, 120),
        type: input.type,
        tripDate: trimText(input.tripDate, 40),
        body: trimText(input.body, 12000),
        selectedPlatforms: platforms.slice().sort(),
        images: parsedImages.map((image, index) => ({ sha256: createHash("sha256").update(image.buffer).digest("hex"), originalName: trimText(input.images[index].originalName || "", 120) })),
      }))
      .digest("hex");
    const state = databaseMode() ? { schemaVersion: 1 as const, contents: await readDatabaseContents(), events: [] } : await readState();
    const existing = state.contents.find((item) => item.contentFingerprint === contentFingerprint);
    if (existing) return existing;

    const id = `FUYUN-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${randomUUID().slice(0, 8).toUpperCase()}`;
    const contentUploadDir = path.join(uploadDir, id);
    await mkdir(contentUploadDir, { recursive: true });

    const storedImages: StoredImage[] = [];
    const instagramSelected = platforms.includes("instagram");
    for (let index = 0; index < input.images.length; index += 1) {
      const parsed = parsedImages[index];
      const fileName = `image-${index + 1}.${safeFileExtension(parsed.mimeType)}`;
      await writeFile(path.join(contentUploadDir, fileName), parsed.buffer);
      const publicUrl = input.publicImageUrls?.[index] || (storage.durable ? (await uploadToR2(`operations/${id}/${fileName}`, parsed.buffer, parsed.mimeType)) || undefined : undefined);
      if (storage.durable && !publicUrl) throw new Error("R2 圖片保存失敗，未建立草稿");
      const instagramBuffer = instagramSelected ? await sharp(parsed.buffer).jpeg({ quality: 88 }).toBuffer() : null;
      const instagramPublicUrl = instagramBuffer && storage.durable
        ? (await uploadToR2(`operations/${id}/instagram/image-${index + 1}.jpg`, instagramBuffer, "image/jpeg")) || undefined
        : undefined;
      if (storage.durable && instagramSelected && !instagramPublicUrl) throw new Error("Instagram JPEG 物件保存失敗，未建立草稿");
      storedImages.push({
        id: randomUUID(),
        originalName: trimText(input.images[index].originalName || fileName, 120),
        mimeType: parsed.mimeType,
        bytes: parsed.buffer.length,
        sha256: createHash("sha256").update(parsed.buffer).digest("hex"),
        fileName,
        publicUrl,
        instagramPublicUrl,
      });
    }

    const timestamp = now();
    const firstImage = storedImages[0];
    const localImageUrl = firstImage ? `/api/operations/content/${id}/images/${firstImage.fileName}` : null;
    const publicImageUrl = firstImage?.publicUrl || localImageUrl;
    const regularImageUrls = storedImages.map((image) => image.publicUrl || `/api/operations/content/${id}/images/${image.fileName}`);
    const instagramImageUrls = storedImages.map((image) => image.instagramPublicUrl || "");
    const captions = makePlatformCaptions(input, id, publicImageUrl);
    const platformsRecord = {} as Record<OperationsPlatform, PlatformDraft>;
    for (const platform of platforms) {
      const jobId = `${id}:${platform}:v1`;
      platformsRecord[platform] = {
        platform,
        caption: captions[platform].caption,
        imageUrl: captions[platform].imageUrl,
        imageUrls: platform === "instagram" ? instagramImageUrls : regularImageUrls,
        status: "pending_approval",
        jobId,
        idempotencyKey: createHash("sha256").update(`${id}:v1:${platform}`).digest("hex"),
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
        factCheck: captionFactCheck(captions[platform].caption, input.tripDate),
        submission: {
          phase: "not_started",
          containerIds: [],
          carouselContainerId: null,
          publishIntentAt: null,
          submittedAt: null,
        },
      };
    }

    const content: ContentRecord = {
      id,
      contentFingerprint,
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
      storageMode: storage.durable ? "database+r2" : "local_json",
    };
    state.contents.unshift(content);
    addEvent(state, { type: "content_created", contentId: id, detail: "mobile intake" });
    await persistState(state);
    return content;
  });
}

export async function approveContent(contentId: string, approvedBy: string, scheduledAt?: string | null) {
  return serialize(async () => {
    const state = databaseMode() ? { schemaVersion: 1 as const, contents: await readDatabaseContents(), events: [] } : await readState();
    const content = state.contents.find((item) => item.id === contentId);
    if (!content) throw new Error("找不到內容");
    if (content.approval.status === "approved") return content;
    const timestamp = now();
    const schedule = scheduledAt ? new Date(scheduledAt) : null;
    if (schedule && Number.isNaN(schedule.getTime())) throw new Error("排程日期格式錯誤");
    content.approval = { status: "approved", approvedAt: timestamp, approvedBy: trimText(approvedBy || "admin", 80) };
    content.status = "approved";
    content.updatedAt = timestamp;
    for (const platform of content.selectedPlatforms) {
      const job = content.platforms[platform];
      job.status = schedule && schedule.getTime() > Date.now() ? "scheduled" : "queued";
      job.scheduledAt = schedule?.toISOString() || null;
      job.approvalHash = jobApprovalHash(content, job);
      job.updatedAt = timestamp;
    }
    addEvent(state, { type: "content_approved", contentId, detail: schedule ? `scheduled:${schedule.toISOString()}` : "approved" });
    await persistState(state);
    return content;
  });
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

async function claimJob(jobId: string) {
  return serialize(async () => {
    const state = databaseMode() ? { schemaVersion: 1 as const, contents: await readDatabaseContents(), events: [] } : await readState();
    const found = findJob(state, jobId);
    if (!found) return null;
    const { content, job } = found;
    const lockActive = job.lockedUntil && new Date(job.lockedUntil).getTime() > Date.now();
    if (lockActive || ["processing", "published", "submitted_pending_verification"].includes(job.status)) return null;
    if (!["queued", "scheduled", "retryable_failed", "awaiting_auth", "manual_required"].includes(job.status)) return null;
    if (job.scheduledAt && new Date(job.scheduledAt).getTime() > Date.now()) return null;
    if (content.approval.status !== "approved") return null;
    if (!job.approvalHash || job.approvalHash !== jobApprovalHash(content, job)) {
      // Caption, images or target account changed after approval: the approval no longer applies.
      job.status = "pending_approval";
      job.approvalHash = null;
      job.lastError = "核准後內容、圖片或目標帳號已變更；原核准失效，需重新核准。";
      job.updatedAt = now();
      content.approval = { status: "pending", approvedAt: null, approvedBy: null };
      content.status = "pending_approval";
      addEvent(state, { type: "approval_invalidated", contentId: content.id, jobId, platform: job.platform, detail: "approval hash mismatch" });
      await persistState(state);
      return null;
    }
    job.status = "processing";
    job.attempts += 1;
    job.lockedUntil = new Date(Date.now() + JOB_LEASE_MS).toISOString();
    job.updatedAt = now();
    addEvent(state, { type: "job_claimed", contentId: content.id, jobId, platform: job.platform, detail: job.idempotencyKey });
    await persistState(state);
    return { contentId: content.id, content, job };
  });
}

type RunMode = "dry-run" | "live";

type JobSubmission = NonNullable<PlatformDraft["submission"]>;

function defaultSubmission(): JobSubmission {
  return {
    phase: "not_started",
    containerIds: [],
    carouselContainerId: null,
    publishIntentAt: null,
    submittedAt: null,
  };
}

async function updateJobSubmission(jobId: string, patch: Partial<JobSubmission>) {
  return serialize(async () => {
    const state = databaseMode() ? { schemaVersion: 1 as const, contents: await readDatabaseContents(), events: [] } : await readState();
    const found = findJob(state, jobId);
    if (!found) return null;
    const current = found.job.submission || defaultSubmission();
    found.job.submission = { ...current, ...patch };
    found.job.updatedAt = now();
    await persistState(state);
    return found.job.submission;
  });
}

async function markJobSubmission(jobId: string, job: PlatformDraft, patch: Partial<JobSubmission>) {
  const submission = await updateJobSubmission(jobId, patch);
  if (submission) job.submission = submission;
  return submission;
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

async function submitInstagramV2Job(jobId: string, job: PlatformDraft) {
  const client = await instagramV2Client();
  const imageUrls = (job.imageUrls?.length ? job.imageUrls : job.imageUrl ? [job.imageUrl] : []).filter(Boolean);
  if (!imageUrls.length || imageUrls.length > 10 || imageUrls.some((url) => !url.startsWith("https://"))) {
    throw new InstagramV2Error("input");
  }
  const isCarousel = imageUrls.length > 1;
  if (isCarousel && imageUrls.length < 2) throw new InstagramV2Error("input");

  await markJobSubmission(jobId, job, { phase: "container_creating", containerIds: [], carouselContainerId: null, publishIntentAt: null, submittedAt: null });
  const childContainerIds: string[] = [];
  if (isCarousel) {
    for (const imageUrl of imageUrls) {
      const child = await client.createImageContainer({ imageUrl, mimeType: "image/jpeg", isCarouselItem: true });
      childContainerIds.push(child.containerId);
      await markJobSubmission(jobId, job, { phase: "container_creating", containerIds: [...childContainerIds] });
    }
  } else {
    const image = await client.createImageContainer({ caption: job.caption, imageUrl: imageUrls[0], mimeType: "image/jpeg" });
    childContainerIds.push(image.containerId);
    await markJobSubmission(jobId, job, { phase: "container_created", containerIds: [...childContainerIds] });
  }

  let publishContainerId = childContainerIds[0];
  if (isCarousel) {
    const carousel = await client.createCarouselContainer({ caption: job.caption, children: childContainerIds });
    publishContainerId = carousel.containerId;
    await markJobSubmission(jobId, job, { phase: "container_created", containerIds: [...childContainerIds], carouselContainerId: publishContainerId });
  }

  const containerStatus = await client.getContainerStatus(publishContainerId);
  if (!["FINISHED", "PUBLISHED"].includes(containerStatus.status)) throw new InstagramV2Error("unknown");
  await markJobSubmission(jobId, job, { phase: "publish_intent", publishIntentAt: now() });
  const published = await client.publishContainer(publishContainerId);
  await markJobSubmission(jobId, job, { phase: "submitted_pending_verification", submittedAt: now() });
  const verified = await client.verifyPublishedMedia(published.mediaId, job.caption, isCarousel ? "CAROUSEL" : "IMAGE");
  return { externalId: published.mediaId, postUrl: verified.postUrl };
}

async function recoverExpiredProcessingJobs() {
  return serialize(async () => {
    const state = databaseMode() ? { schemaVersion: 1 as const, contents: await readDatabaseContents(), events: [] } : await readState();
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
    if (recovered) await persistState(state);
    return recovered;
  });
}

export async function runJob(jobId: string, mode: RunMode = "dry-run") {
  const claimed = await claimJob(jobId);
  if (!claimed) return { success: false, status: "not_claimed", error: "工作不存在、未核准、尚在鎖定中或尚未到排程時間" };
  const { content, job } = claimed;
  let result: { status: JobStatus; error?: string; externalId?: string; postUrl?: string; verification?: PlatformDraft["verification"] };

  if (mode === "dry-run") {
    result = {
      status: "dry_run_verified",
      verification: "verified",
      error: `乾跑完成：${job.platform} adapter=${job.adapter}，未對外發布。`,
    };
  } else if (process.env.OPERATIONS_LIVE_PUBLISH_ENABLED !== "true") {
    result = { status: "manual_required", verification: "pending", error: "正式發布總開關未啟用；已保留草稿與工作結果。" };
  } else if (job.platform === "facebook_group") {
    result = { status: "manual_required", verification: "pending", error: "Facebook 社團不使用粉專 API；需老闆在核對社團身份後於正常介面送出。" };
  } else if (job.platform === "website") {
    result = { status: "manual_required", verification: "pending", error: "官網正式頁面尚未提供可逆 CMS 發布接口；本次只完成預覽與可交接草稿。" };
  } else {
    try {
      const published = await submitInstagramV2Job(jobId, job);
      result = { status: "published", externalId: published.externalId, postUrl: published.postUrl, verification: "verified" };
    } catch (error) {
      const v2Error = error instanceof InstagramV2Error ? error : null;
      if (v2Error?.kind === "authorization") {
        await clearStoredInstagramLoginTokenFromEnvironment().catch(() => false);
      }
      if (v2Error?.kind === "configuration" || v2Error?.kind === "authorization" || v2Error?.kind === "input") {
        result = { status: "awaiting_auth", verification: "pending", error: "Instagram V2 尚未具備可用授權、公開 JPEG 圖片或正式設定；未對外重送。" };
      } else if (v2Error?.mayHaveSucceeded || v2Error?.kind === "unknown" || job.submission?.containerIds.length || job.submission?.carouselContainerId) {
        result = { status: "submitted_pending_verification", verification: "pending", error: "Instagram 回應結果不明或容器已建立；已保留提交狀態，未自動重送。" };
      } else {
        result = { status: "retryable_failed", verification: "failed", error: "Instagram V2 拒絕此次發布；未將其標記為成功。" };
      }
    }
  }

  return serialize(async () => {
    const state = databaseMode() ? { schemaVersion: 1 as const, contents: await readDatabaseContents(), events: [] } : await readState();
    const current = findJob(state, jobId);
    if (!current) return { success: false, status: "missing", error: "工作在執行期間消失" };
    current.job.status = result.status;
    current.job.lastError = result.error || null;
    current.job.externalId = result.externalId || current.job.externalId;
    current.job.postUrl = result.postUrl || current.job.postUrl;
    current.job.verification = result.verification || "not_tested";
    current.job.lockedUntil = null;
    current.job.updatedAt = now();
    const statuses = current.content.selectedPlatforms.map((platform) => current.content.platforms[platform].status);
    current.content.status = statuses.every((status) => status === "published" || status === "dry_run_verified")
      ? "completed"
      : statuses.some((status) => ["published", "dry_run_verified"].includes(status))
        ? "partial"
        : current.content.status;
    current.content.updatedAt = now();
    addEvent(state, { type: "job_result", contentId: current.content.id, jobId, platform: current.job.platform, detail: result.error || result.status });
    await persistState(state);
    return { success: result.status === "dry_run_verified" || result.status === "published", status: result.status, job: current.job, content: current.content };
  });
}

export async function getJob(jobId: string) {
  return serialize(async () => {
    const state = databaseMode() ? { schemaVersion: 1 as const, contents: await readDatabaseContents(), events: [] } : await readState();
    const found = findJob(state, jobId);
    return found ? { content: found.content, job: found.job } : null;
  });
}

function validFacebookPostUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && ["facebook.com", "www.facebook.com", "m.facebook.com"].includes(url.hostname.toLowerCase()) &&
      Boolean(url.pathname) && !url.username && !url.password && !url.hash;
  } catch {
    return false;
  }
}

export async function recordFacebookManualResult(jobId: string, externalId: string, postUrl: string) {
  const safeExternalId = trimText(externalId, 240);
  const safePostUrl = postUrl.trim();
  if (!safeExternalId || /[\r\n]/.test(safeExternalId) || !validFacebookPostUrl(safePostUrl)) {
    throw new Error("請填入 Facebook 貼文外部 ID 與有效的 HTTPS 貼文網址");
  }
  return serialize(async () => {
    const state = databaseMode() ? { schemaVersion: 1 as const, contents: await readDatabaseContents(), events: [] } : await readState();
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
    await persistState(state);
    return { content: found.content, job: found.job };
  });
}

export async function runDueJobs(mode: RunMode = process.env.OPERATIONS_LIVE_PUBLISH_ENABLED === "true" ? "live" : "dry-run") {
  await recoverExpiredProcessingJobs();
  const state = await serialize(() => databaseMode() ? readDatabaseContents().then((contents) => ({ schemaVersion: 1 as const, contents, events: [] })) : readState());
  const due = state.contents.flatMap((content) => content.selectedPlatforms.map((platform) => content.platforms[platform])).filter((job) =>
    // manual_required waits for a person (e.g. Facebook group post, disabled live switch); it is only re-run explicitly.
    ["queued", "scheduled", "retryable_failed", "awaiting_auth"].includes(job.status) && (!job.scheduledAt || new Date(job.scheduledAt).getTime() <= Date.now()),
  );
  const results = [];
  for (const job of due.slice(0, 20)) results.push(await runJob(job.jobId, mode));
  return results;
}

export async function getImagePath(contentId: string, fileName: string) {
  const record = await getContentRecord(contentId);
  if (!record || !record.images.some((image) => image.fileName === fileName)) return null;
  return path.join(uploadDir, contentId, fileName);
}

export function getImageContentType(fileName: string) {
  if (fileName.endsWith(".png")) return "image/png";
  if (fileName.endsWith(".webp")) return "image/webp";
  return "image/jpeg";
}

export function isValidJobStatus(status: string): status is JobStatus {
  return ["draft", "pending_approval", "approved", "queued", "scheduled", "processing", "submitted_pending_verification", "published", "awaiting_auth", "retryable_failed", "manual_required", "blocked_platform", "dry_run_verified"].includes(status as JobStatus);
}
