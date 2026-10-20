/**
 * Group/room events → the second machine's line-event-receiver (Owner 2026-10-20).
 *
 * The raw body and x-line-signature are forwarded unchanged so the receiver verifies the same LINE
 * signature itself. The forward runs after the response (waitUntil), times out after 1.5 s and is never
 * retried: LINE times out at 2 s, and a slow or offline receiver must never affect customer DMs.
 * LINE_GROUP_RELAY_URL overrides the default receiver URL.
 */
import { waitUntil } from "@vercel/functions";

export const RELAY_TIMEOUT_MS = 1500;
// 老闆 2026-10-20 核准；公開 repo 看得到網址，靠 LINE 簽章擋（接收端只收 HH channel secret 簽過的 body）
export const DEFAULT_RELAY_URL = "https://gx10-worker-02.tailde7162.ts.net/api/line/events/ingest";

type RelayEvent = { source?: { type?: string } };

export function hasGroupEvent(events: RelayEvent[] | undefined) {
  return (events || []).some((event) => event?.source?.type === "group" || event?.source?.type === "room");
}

async function forward(url: string, body: string, signature: string) {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", "x-line-signature": signature },
      body,
      signal: AbortSignal.timeout(RELAY_TIMEOUT_MS),
    });
    console.info("line-webhook group-relay", { status: response.status });
  } catch (error) {
    console.warn("line-webhook group-relay failed", { error: String(error).slice(0, 120) });
  }
}

/** Schedules the forward; returns whether one was scheduled. */
export function relayGroupEvents(body: string, signature: string, events: RelayEvent[] | undefined) {
  const url = process.env.LINE_GROUP_RELAY_URL || DEFAULT_RELAY_URL;
  if (!hasGroupEvent(events)) return false;
  waitUntil(forward(url, body, signature));
  return true;
}
