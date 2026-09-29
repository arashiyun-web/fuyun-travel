import { timingSafeEqual } from "crypto";
import { verifyAdminMutationRequest, verifyAdminRequest } from "@/lib/adminAuth";

export function verifyOperationsAdminRequest(request: Request) {
  return Boolean(verifyAdminRequest(request));
}

export function verifyOperationsWorkerRequest(request: Request) {
  if (verifyAdminMutationRequest(request)) return true;
  const configured = process.env.OPERATIONS_CRON_TOKEN || "";
  const authHeader = request.headers.get("authorization");
  const supplied = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!configured || !supplied) return false;
  const expected = Buffer.from(configured);
  const actual = Buffer.from(supplied);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
