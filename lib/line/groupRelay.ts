/**
 * Group/room events → the second machine's line-event-receiver (Owner 2026-10-20).
 *
 * The raw body and x-line-signature are forwarded unchanged so the receiver verifies the same LINE
 * signature itself. The forward runs after the response (waitUntil), times out after 1.5 s and is never
 * retried: LINE times out at 2 s, and a slow or offline receiver must never affect customer DMs.
 * Unset LINE_GROUP_RELAY_URL → nothing is sent.
 */
import { waitUntil } from "@vercel/functions";

export const RELAY_TIMEOUT_MS = 1500;

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
  const url = process.env.LINE_GROUP_RELAY_URL;
  if (!url || !hasGroupEvent(events)) return false;
  waitUntil(forward(url, body, signature));
  return true;
}
