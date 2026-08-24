import { localizedNotFoundResponse } from "@/lib/localized-not-found-response";

export function GET() {
  return localizedNotFoundResponse("zh-Hans");
}

export const POST = GET;
export const PUT = GET;
export const PATCH = GET;
export const DELETE = GET;
export const OPTIONS = GET;
