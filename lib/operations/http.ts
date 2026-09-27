import { NextResponse } from "next/server";
import { OperationsStorageUnavailableError } from "./shared";

/** Map operations errors to responses without leaking configuration values. */
export function operationsErrorResponse(error: unknown, fallback: string, status = 400) {
  if (error instanceof OperationsStorageUnavailableError) {
    return NextResponse.json({ success: false, error: error.message, storage: error.diagnostic }, { status: 503 });
  }
  return NextResponse.json({ success: false, error: error instanceof Error ? error.message : fallback }, { status });
}
