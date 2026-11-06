import { prisma } from "@/lib/prisma";

/**
 * /highlights is the site's own page. A featured_spots draft whose title and
 * description match the approved operations title and body, character for
 * character, goes live with the approval. It does not wait for the social cron
 * or the live-publish switch.
 */
export function featuredDraftPublishWhere(title: string, body: string) {
  if (!title || !body) return null;
  return { status: "draft" as const, title, description: body };
}

/** The same text leaves /highlights when that approval is withdrawn and no other approval still covers it. */
export function featuredSpotUnpublishWhere(title: string, body: string) {
  if (!title || !body) return null;
  return { status: "published" as const, title, description: body };
}

export async function publishApprovedFeaturedDrafts(title: string, body: string) {
  const where = featuredDraftPublishWhere(title, body);
  if (!where) return 0;
  const updated = await prisma.featuredSpot.updateMany({ where, data: { status: "published" } });
  return updated.count;
}

export async function unpublishFeaturedSpots(title: string, body: string) {
  const where = featuredSpotUnpublishWhere(title, body);
  if (!where) return 0;
  const updated = await prisma.featuredSpot.updateMany({ where, data: { status: "draft" } });
  return updated.count;
}
