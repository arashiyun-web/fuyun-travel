import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { HandoffRecord, HandoffStatus, HandoffStore } from "@/lib/postiz/handoff";

type HandoffRow = {
  idempotencyKey: string;
  contentId: string;
  platform: string;
  status: string;
  postizPostId: string | null;
  lastError: string | null;
  updatedAt: Date;
};

export type PostizHandoffClient = {
  postizHandoff: {
    create(args: { data: { idempotencyKey: string; contentId: string; platform: string; status: string } }): Promise<HandoffRow>;
    findUnique(args: { where: { idempotencyKey: string } | { contentId_platform: { contentId: string; platform: string } } }): Promise<HandoffRow | null>;
    updateMany(args: { where: { idempotencyKey: string; status?: string }; data: { status?: string; postizPostId?: string | null; lastError?: string | null } }): Promise<{ count: number }>;
  };
};

function toRecord(row: HandoffRow): HandoffRecord {
  return {
    idempotencyKey: row.idempotencyKey,
    contentId: row.contentId,
    platform: row.platform,
    status: row.status as HandoffStatus,
    postizPostId: row.postizPostId,
    lastError: row.lastError,
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function readExisting(client: PostizHandoffClient, idempotencyKey: string, contentId: string, platform: string) {
  const byKey = await client.postizHandoff.findUnique({ where: { idempotencyKey } });
  if (byKey) return byKey;
  return client.postizHandoff.findUnique({ where: { contentId_platform: { contentId, platform } } });
}

/** Production handoff store. The unique indexes decide the winner; a P2002 loser reads the existing row and does not send. */
export function prismaHandoffStore(client: PostizHandoffClient = prisma): HandoffStore {
  return {
    async claim(idempotencyKey, contentId, platform) {
      try {
        const row = await client.postizHandoff.create({
          data: { idempotencyKey, contentId, platform, status: "sending" },
        });
        return { record: toRecord(row), created: true };
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
          const existing = await readExisting(client, idempotencyKey, contentId, platform);
          if (!existing) {
            return {
              record: {
                idempotencyKey,
                contentId,
                platform,
                status: "needs_manual_confirmation",
                postizPostId: null,
                lastError: "需要人工確認：交接紀錄衝突但讀不到既有列，不會自動重送。",
                updatedAt: new Date(0).toISOString(),
              },
              created: false,
            };
          }
          return { record: toRecord(existing), created: false };
        }
        throw error;
      }
    },
    async markDraft(idempotencyKey, postizPostId) {
      const updated = await client.postizHandoff.updateMany({
        where: { idempotencyKey, status: "sending" },
        data: { status: "draft_created", postizPostId, lastError: null },
      });
      return updated.count === 1;
    },
    async markFailed(idempotencyKey, error) {
      const updated = await client.postizHandoff.updateMany({
        where: { idempotencyKey, status: "sending" },
        data: { status: "failed", lastError: error },
      });
      return updated.count === 1;
    },
    async markNeedsManual(idempotencyKey, error) {
      const updated = await client.postizHandoff.updateMany({
        where: { idempotencyKey, status: "sending" },
        data: { status: "needs_manual_confirmation", lastError: error },
      });
      return updated.count === 1;
    },
  };
}

export function defaultHandoffStore(): HandoffStore {
  return prismaHandoffStore();
}
