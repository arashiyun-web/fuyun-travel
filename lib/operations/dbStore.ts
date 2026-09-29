import { randomUUID } from "crypto";
import os from "os";
import sharp from "sharp";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { deleteObjects, getObject, presignGet, putObject } from "./objectStore";
import {
  CLAIMABLE_STATUSES,
  DUE_BATCH_LIMIT,
  JOB_LEASE_MS,
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
  nowIso,
  prepareIntake,
  resolveApprovalAccounts,
  safeFileExtension,
  sha256Hex,
  trimText,
  validFacebookPostUrl,
  type FactCheck,
  type JobSubmission,
  type RunMode,
} from "./shared";
import type { ContentIntakeInput, ContentRecord, JobStatus, OperationsPlatform, PlatformDraft, StoredImage } from "./types";

/**
 * Database-backed operations store (Neon Postgres + private object storage).
 * All state transitions that must be exclusive are single conditional UPDATEs, so they are
 * atomic across processes and serverless instances.
 */

const LOCK_OWNER = `${os.hostname()}:${process.pid}:${randomUUID().slice(0, 8)}`;

type JobRow = Prisma.OperationsJobGetPayload<object>;
type ContentRow = Prisma.OperationsContentGetPayload<{ include: { jobs: true } }>;

function toDraft(row: JobRow): PlatformDraft {
  return {
    platform: row.platform as OperationsPlatform,
    caption: row.caption,
    imageUrl: row.imageUrl,
    imageUrls: row.imageUrls,
    status: row.status as JobStatus,
    jobId: row.jobId,
    idempotencyKey: row.idempotencyKey,
    attempts: row.attempts,
    scheduledAt: row.scheduledAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    lockedUntil: row.lockedUntil?.toISOString() ?? null,
    externalId: row.externalId,
    postUrl: row.postUrl,
    lastError: row.lastError,
    verification: row.verification as PlatformDraft["verification"],
    adapter: row.adapter as PlatformDraft["adapter"],
    approvalHash: row.approvalHash,
    factCheck: (row.factCheck as FactCheck | null) ?? undefined,
    submission: (row.submission as JobSubmission | null) ?? defaultSubmission(),
  };
}

function toRecord(row: ContentRow): ContentRecord {
  const platforms = {} as Record<OperationsPlatform, PlatformDraft>;
  for (const job of row.jobs) platforms[job.platform as OperationsPlatform] = toDraft(job);
  return {
    id: row.id,
    contentFingerprint: row.contentFingerprint,
    version: row.version,
    title: row.title,
    type: row.type as ContentRecord["type"],
    tripDate: row.tripDate,
    body: row.body,
    images: row.images as unknown as StoredImage[],
    selectedPlatforms: row.selectedPlatforms as OperationsPlatform[],
    platforms,
    status: row.status as ContentRecord["status"],
    approval: { status: row.approvalStatus as "pending" | "approved", approvedAt: row.approvedAt?.toISOString() ?? null, approvedBy: row.approvedBy },
    generationMode: "deterministic_template",
    source: "mobile",
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    revisionOf: row.revisionOf,
    storageMode: "database+r2",
  };
}

function imageShas(content: { images: Prisma.JsonValue }) {
  return (content.images as unknown as StoredImage[]).map((image) => image.sha256);
}

async function addEvent(tx: Prisma.TransactionClient | typeof prisma, event: { type: string; contentId: string; jobId?: string; platform?: string; detail?: string }) {
  await tx.operationsEvent.create({ data: { id: randomUUID(), ...event } });
}

export async function listContentRecords() {
  const rows = await prisma.operationsContent.findMany({ include: { jobs: true }, orderBy: { createdAt: "desc" }, take: 200 });
  return rows.map(toRecord);
}

export async function getContentRecord(contentId: string) {
  const row = await prisma.operationsContent.findUnique({ where: { id: contentId }, include: { jobs: true } });
  return row ? toRecord(row) : null;
}

export async function createContentDraft(input: ContentIntakeInput) {
  const { platforms, parsedImages, fingerprint } = prepareIntake(input);
  const existing = await prisma.operationsContent.findUnique({ where: { contentFingerprint: fingerprint }, include: { jobs: true } });
  if (existing) return toRecord(existing);

  const id = `FUYUN-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${randomUUID().slice(0, 8).toUpperCase()}`;
  // Every key is recorded before its upload starts, so a partly written object is cleaned up too.
  const uploadedKeys: string[] = [];
  let persisted = false;
  try {
    const images = await uploadIntakeImages(id, input, parsedImages, platforms.includes("instagram"), uploadedKeys);
    const winner = await persistDraft(id, input, platforms, fingerprint, images);
    persisted = !winner;
    return winner ?? (await getContentRecord(id))!;
  } finally {
    if (!persisted) await discardObjects(id, uploadedKeys);
  }
}

async function uploadIntakeImages(id: string, input: ContentIntakeInput, parsedImages: ReturnType<typeof prepareIntake>["parsedImages"], instagramSelected: boolean, uploadedKeys: string[]) {
  const images: StoredImage[] = [];
  for (let index = 0; index < parsedImages.length; index += 1) {
    const parsed = parsedImages[index];
    const fileName = `image-${index + 1}.${safeFileExtension(parsed.mimeType)}`;
    const key = `operations/${id}/${fileName}`;
    uploadedKeys.push(key);
    const stored = await putObject(key, parsed.buffer, parsed.mimeType);
    let instagramStorageKey: string | undefined;
    if (instagramSelected) {
      const jpeg = await sharp(parsed.buffer).jpeg({ quality: 88 }).toBuffer();
      instagramStorageKey = `operations/${id}/instagram/image-${index + 1}.jpg`;
      uploadedKeys.push(instagramStorageKey);
      await putObject(instagramStorageKey, jpeg, "image/jpeg");
    }
    images.push({
      id: randomUUID(),
      originalName: trimText(input.images[index].originalName || fileName, 120),
      mimeType: parsed.mimeType,
      bytes: parsed.buffer.length,
      sha256: stored.sha256,
      fileName,
      storageKey: stored.key,
      instagramStorageKey,
    });
  }
  return images;
}

/** Objects of an intake that never became a stored record (failure, or lost the fingerprint race). */
async function discardObjects(id: string, keys: string[]) {
  if (!keys.length) return;
  // A commit whose acknowledgement was lost must keep its images: delete only when the record is absent.
  const stored = await prisma.operationsContent.count({ where: { id } }).catch(() => -1);
  if (stored !== 0) {
    console.error("operations intake cleanup skipped", { contentId: id, reason: stored < 0 ? "record state unknown" : "record exists", keys });
    return;
  }
  const failed = await deleteObjects(keys).catch(() => keys);
  if (failed.length) console.error("operations intake cleanup incomplete", { contentId: id, leftKeys: failed });
}

/** Returns the winning record when a concurrent identical intake stored it first, otherwise null. */
async function persistDraft(id: string, input: ContentIntakeInput, platforms: OperationsPlatform[], fingerprint: string, images: StoredImage[]) {
  const captions = makePlatformCaptions(input, id);
  const adminImageUrls = images.map((image) => `/api/operations/content/${id}/images/${image.fileName}`);
  try {
    await prisma.$transaction(async (tx) => {
      await tx.operationsContent.create({
        data: {
          id,
          contentFingerprint: fingerprint,
          title: trimText(input.title, 120),
          type: input.type,
          tripDate: trimText(input.tripDate, 40),
          body: trimText(input.body, 12000),
          images: images as unknown as Prisma.InputJsonValue,
          selectedPlatforms: platforms,
          status: "pending_approval",
        },
      });
      for (const platform of platforms) {
        await tx.operationsJob.create({
          data: {
            jobId: `${id}:${platform}:v1`,
            contentId: id,
            platform,
            caption: captions[platform],
            imageUrl: adminImageUrls[0] ?? null,
            imageUrls: adminImageUrls,
            status: "pending_approval",
            idempotencyKey: sha256Hex(`${id}:v1:${platform}`),
            adapter: adapterFor(platform),
            factCheck: captionFactCheck(captions[platform], input.tripDate) as unknown as Prisma.InputJsonValue,
            submission: defaultSubmission() as unknown as Prisma.InputJsonValue,
          },
        });
      }
      await addEvent(tx, { type: "content_created", contentId: id, detail: "mobile intake" });
    });
  } catch (error) {
    // A concurrent identical intake won the unique fingerprint; return that record instead.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const winner = await prisma.operationsContent.findUnique({ where: { contentFingerprint: fingerprint }, include: { jobs: true } });
      if (winner) return toRecord(winner);
    }
    throw error;
  }
  return null;
}

export async function approveContent(contentId: string, approvedBy: string, scheduledAt?: string | null, acknowledgeFactWarnings = false) {
  const record = await getContentRecord(contentId);
  if (!record) throw new Error("找不到內容");
  if (record.approval.status === "approved") return record;
  const failing = assertFactCheckApprovable(record, acknowledgeFactWarnings);
  const schedule = scheduledAt ? new Date(scheduledAt) : null;
  if (schedule && Number.isNaN(schedule.getTime())) throw new Error("排程日期格式錯誤");
  const approver = trimText(approvedBy || "admin", 80);
  const shas = record.images.map((image) => image.sha256);
  const accounts = await resolveApprovalAccounts();
  await prisma.$transaction(async (tx) => {
    const updated = await tx.operationsContent.updateMany({
      where: { id: contentId, approvalStatus: "pending" },
      data: { approvalStatus: "approved", approvedAt: new Date(), approvedBy: approver, status: "approved" },
    });
    if (updated.count !== 1) return;
    for (const platform of record.selectedPlatforms) {
      const job = record.platforms[platform];
      const factCheck = { ...(job.factCheck as FactCheck), acknowledgedBy: failing.includes(platform) ? approver : null };
      await tx.operationsJob.updateMany({
        where: { jobId: job.jobId, caption: job.caption, status: "pending_approval" },
        data: {
          status: schedule && schedule.getTime() > Date.now() ? "scheduled" : "queued",
          scheduledAt: schedule,
          approvalHash: jobApprovalHash(shas, job, accounts),
          factCheck: factCheck as unknown as Prisma.InputJsonValue,
        },
      });
    }
    if (failing.length) await addEvent(tx, { type: "fact_warnings_acknowledged", contentId, detail: `${approver}: ${failing.join(",")}` });
    await addEvent(tx, { type: "content_approved", contentId, detail: schedule ? `scheduled:${schedule.toISOString()}` : "approved" });
  });
  return (await getContentRecord(contentId))!;
}

/** Withdraw the content approval and return every not-yet-executed job to pending_approval. */
async function invalidateApproval(contentId: string, changedJob: JobRow) {
  await prisma.$transaction(async (tx) => {
    const content = await tx.operationsContent.updateMany({
      where: { id: contentId, approvalStatus: "approved" },
      data: { approvalStatus: "pending", approvedAt: null, approvedBy: null, status: "pending_approval" },
    });
    if (content.count !== 1) return;
    await tx.operationsJob.updateMany({
      where: { contentId, status: { in: CLAIMABLE_STATUSES } },
      data: { status: "pending_approval", approvalHash: null, lastError: "核准後內容、圖片或目標帳號已變更；原核准失效，需重新核准。" },
    });
    await addEvent(tx, { type: "approval_invalidated", contentId, jobId: changedJob.jobId, platform: changedJob.platform, detail: "approval hash mismatch" });
  });
}

/** Atomic claim: exactly one caller can move a job into processing. */
async function claimJob(jobId: string, statuses: string[] = CLAIMABLE_STATUSES) {
  const job = await prisma.operationsJob.findUnique({ where: { jobId }, include: { content: { include: { jobs: true } } } });
  if (!job || job.content.approvalStatus !== "approved") return null;
  // Every not-yet-executed job of the content must still match its approval snapshot.
  const shas = imageShas(job.content);
  const accounts = await resolveApprovalAccounts();
  const changed = job.content.jobs.find((sibling) =>
    CLAIMABLE_STATUSES.includes(sibling.status as JobStatus) &&
    (!sibling.approvalHash || sibling.approvalHash !== jobApprovalHash(shas, { caption: sibling.caption, platform: sibling.platform as OperationsPlatform }, accounts)),
  );
  if (changed) {
    await invalidateApproval(job.contentId, changed);
    return null;
  }
  const expectedHash = jobApprovalHash(shas, { caption: job.caption, platform: job.platform as OperationsPlatform }, accounts);
  const now = new Date();
  const claimed = await prisma.operationsJob.updateMany({
    where: {
      jobId,
      caption: job.caption,
      approvalHash: expectedHash,
      status: { in: statuses },
      OR: [{ lockedUntil: null }, { lockedUntil: { lt: now } }],
      AND: [{ OR: [{ scheduledAt: null }, { scheduledAt: { lte: now } }] }],
      content: { approvalStatus: "approved" },
    },
    data: { status: "processing", attempts: { increment: 1 }, lockedUntil: new Date(now.getTime() + JOB_LEASE_MS), lockOwner: LOCK_OWNER },
  });
  if (claimed.count !== 1) return null;
  await addEvent(prisma, { type: "job_claimed", contentId: job.contentId, jobId, platform: job.platform, detail: `${job.idempotencyKey} owner=${LOCK_OWNER}` });
  const fresh = await prisma.operationsJob.findUnique({ where: { jobId }, include: { content: true } });
  return fresh ? { row: fresh, accounts } : null;
}

export async function recoverExpiredProcessingJobs() {
  const expired = await prisma.operationsJob.findMany({ where: { status: "processing", lockedUntil: { lt: new Date() } }, take: 100 });
  let recovered = 0;
  for (const job of expired) {
    const submission = { ...((job.submission as JobSubmission | null) ?? defaultSubmission()), phase: "submitted_pending_verification" as const };
    const changed = await prisma.operationsJob.updateMany({
      where: { jobId: job.jobId, status: "processing", lockedUntil: { lt: new Date() } },
      data: {
        status: "submitted_pending_verification",
        verification: "pending",
        lockedUntil: null,
        lockOwner: null,
        lastError: "程序或工作鎖已逾時；外部結果可能已成功，已停止自動重送，請先人工核對。",
        submission: submission as unknown as Prisma.InputJsonValue,
      },
    });
    if (changed.count === 1) {
      recovered += 1;
      await addEvent(prisma, { type: "job_recovered_ambiguous", contentId: job.contentId, jobId: job.jobId, platform: job.platform, detail: "lease expired; manual reconciliation required" });
    }
  }
  return recovered;
}

export async function runJob(jobId: string, mode: RunMode = "dry-run", statuses: string[] = CLAIMABLE_STATUSES) {
  const claim = await claimJob(jobId, statuses);
  if (!claim) return { success: false, status: "not_claimed", error: "工作不存在、未核准、尚在鎖定中或尚未到排程時間" };
  const claimed = claim.row;
  const draft = toDraft(claimed);
  const images = claimed.content.images as unknown as StoredImage[];
  const result = await executeJob(draft, mode, {
    markSubmission: async (patch) => {
      const current = await prisma.operationsJob.findUnique({ where: { jobId }, select: { submission: true } });
      const next = { ...((current?.submission as JobSubmission | null) ?? defaultSubmission()), ...patch };
      await prisma.operationsJob.updateMany({ where: { jobId, lockOwner: LOCK_OWNER, status: "processing" }, data: { submission: next as unknown as Prisma.InputJsonValue } });
    },
    instagramImageUrls: async () => Promise.all(images.map((image) => presignGet(image.instagramStorageKey || image.storageKey || ""))),
    approvedInstagramAccount: claim.accounts.instagram,
  });
  const plan = nextAttemptPlan(result, claimed.attempts);

  const finished = await prisma.operationsJob.updateMany({
    where: { jobId, lockOwner: LOCK_OWNER, status: "processing" },
    data: {
      status: plan.status,
      ...(plan.scheduledAt !== undefined ? { scheduledAt: plan.scheduledAt } : {}),
      lastError: plan.error ?? null,
      externalId: result.externalId ?? claimed.externalId,
      postUrl: result.postUrl ?? claimed.postUrl,
      verification: result.verification ?? "not_tested",
      lockedUntil: null,
      lockOwner: null,
    },
  });
  if (finished.count !== 1) return { success: false, status: "lease_lost", error: "工作鎖已被回收；結果未寫入，請人工核對" };
  const siblings = await prisma.operationsJob.findMany({ where: { contentId: claimed.contentId }, select: { status: true } });
  await prisma.operationsContent.update({
    where: { id: claimed.contentId },
    data: { status: aggregateContentStatus(siblings.map((s) => s.status as JobStatus), claimed.content.status as ContentRecord["status"]) },
  });
  await addEvent(prisma, { type: "job_result", contentId: claimed.contentId, jobId, platform: claimed.platform, detail: plan.error || plan.status });
  const job = await prisma.operationsJob.findUnique({ where: { jobId } });
  return { success: plan.status === "dry_run_verified" || plan.status === "published", status: plan.status, job: job ? toDraft(job) : null, content: await getContentRecord(claimed.contentId) };
}

export async function runDueJobs(mode: RunMode) {
  await recoverExpiredProcessingJobs();
  const statuses = dueStatusesFor(mode);
  const due = await prisma.operationsJob.findMany({
    where: {
      status: { in: statuses },
      OR: [{ scheduledAt: null }, { scheduledAt: { lte: new Date() } }],
      content: { approvalStatus: "approved" },
    },
    orderBy: { createdAt: "asc" },
    take: DUE_BATCH_LIMIT,
    select: { jobId: true },
  });
  const results = [];
  for (const job of due) results.push(await runJob(job.jobId, mode, statuses));
  return results;
}

/** New credentials were stored: parked awaiting_auth jobs for that platform become due again. */
export async function requeueAwaitingAuth(platform: OperationsPlatform) {
  const jobs = await prisma.operationsJob.findMany({ where: { platform, status: "awaiting_auth" }, select: { jobId: true, contentId: true } });
  let requeued = 0;
  for (const job of jobs) {
    const changed = await prisma.operationsJob.updateMany({ where: { jobId: job.jobId, status: "awaiting_auth" }, data: { status: "queued", scheduledAt: null, lastError: null } });
    if (changed.count === 1) {
      requeued += 1;
      await addEvent(prisma, { type: "job_requeued_after_auth", contentId: job.contentId, jobId: job.jobId, platform, detail: "credentials changed" });
    }
  }
  return requeued;
}

export async function getJob(jobId: string) {
  const job = await prisma.operationsJob.findUnique({ where: { jobId } });
  if (!job) return null;
  return { content: await getContentRecord(job.contentId), job: toDraft(job) };
}

export async function recordFacebookManualResult(jobId: string, externalId: string, postUrl: string) {
  const safeExternalId = trimText(externalId, 240);
  const safePostUrl = postUrl.trim();
  if (!safeExternalId || /[\r\n]/.test(safeExternalId) || !validFacebookPostUrl(safePostUrl)) {
    throw new Error("請填入 Facebook 貼文外部 ID 與有效的 HTTPS 貼文網址");
  }
  const job = await prisma.operationsJob.findUnique({ where: { jobId }, include: { content: true } });
  if (!job || job.platform !== "facebook_group") throw new Error("找不到 Facebook 社團工作");
  if (job.content.approvalStatus !== "approved") throw new Error("內容尚未核准，不能回填外部貼文");
  await prisma.operationsJob.update({
    where: { jobId },
    data: { externalId: safeExternalId, postUrl: safePostUrl, status: "manual_required", verification: "pending", lockedUntil: null, lockOwner: null, lastError: "已回填 Facebook 社團貼文連結；請人工開啟網址核對內容、照片與社團身份。" },
  });
  await addEvent(prisma, { type: "manual_result_recorded", contentId: job.contentId, jobId, platform: "facebook_group", detail: "external URL recorded; manual verification pending" });
  return getJob(jobId);
}

export async function readImage(contentId: string, fileName: string) {
  const record = await getContentRecord(contentId);
  const image = record?.images.find((item) => item.fileName === fileName);
  if (!image?.storageKey) return null;
  const object = await getObject(image.storageKey);
  if (object.sha256 !== image.sha256) return null;
  return { buffer: object.buffer, contentType: getImageContentType(fileName) };
}

export const DB_LOCK_OWNER = LOCK_OWNER;
export { nowIso };
