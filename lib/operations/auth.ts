import { timingSafeEqual } from "crypto";
import { verifyAdminMutationRequest, verifyAdminRequest } from "@/lib/adminAuth";

export function verifyOperationsAdminRequest(request: Request) {
  return Boolean(verifyAdminRequest(request));
}

function bearerToken(request: Request) {
  const authHeader = request.headers.get("authorization") || "";
  return authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
}

function tokenMatches(configured: string, supplied: string) {
  if (!configured || !supplied) return false;
  const expected = Buffer.from(configured);
  const actual = Buffer.from(supplied);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function verifyOperationsWorkerRequest(request: Request) {
  if (verifyAdminMutationRequest(request)) return true;
  const supplied = bearerToken(request);
  // Vercel Cron sends Authorization: Bearer $CRON_SECRET. The external worker uses OPERATIONS_CRON_TOKEN.
  if (tokenMatches(process.env.OPERATIONS_CRON_TOKEN || "", supplied)) return true;
  return tokenMatches(process.env.CRON_SECRET || "", supplied);
}
