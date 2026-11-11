/**
 * Every staff-only string /admin/quotes shows for one row: the list column summary and fleet references
 * (quoteEstimate), the detail staff box (panelLines) and the fleet-draft button hints (fleetDraftHints).
 * The send route passes these to sendBlock so none of them can be pasted into the customer text.
 * Server-only (imports the prefill builder); no network, env or DB access.
 */
import { savedFleetFare } from "@/lib/fleetFareInput";
import { buildFleetQuoteDraft, type FleetQuoteDraft } from "@/lib/fleetQuoteDraft";
import { panelLines } from "@/lib/quotePanelText";
import { quoteEstimate, type PrefillSource } from "@/lib/quotePrefill";

type StaffRow = PrefillSource & { recommendedVehicle?: string | null };

/** Hints returned by 「依已核對車資產生草稿」 (also shown to staff). */
export function fleetDraftHints(draft: Pick<FleetQuoteDraft, "staffHints" | "amountTwd" | "pending">) {
  return [
    ...draft.staffHints,
    draft.amountTwd == null ? "車隊表沒有可確認的基本車資。" : `內部核定用基本車資 ${draft.amountTwd} 元（單一定價，不寫進客人內文；客人看到的是範圍報價）。`,
    ...draft.pending,
  ];
}

function object(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

/** Stores the hints returned by the fleet-draft button in quoteOptions.fleetFare.staffHints. */
export function withStoredHints<T extends { fleetFare: Record<string, unknown> }>(options: T, hints: readonly string[]) {
  return { ...options, fleetFare: { ...options.fleetFare, staffHints: hints.slice() } };
}

/** Hints stored at button time (v8); every one stays staff-only. */
export function storedFleetHints(options: unknown): string[] {
  const hints = object(object(options).fleetFare).staffHints;
  return Array.isArray(hints) ? hints.filter((item): item is string => typeof item === "string") : [];
}

export function adminStaffStrings(quote: StaffRow): string[] {
  const out: string[] = [];
  try {
    const estimate = quoteEstimate(quote);
    if (estimate.summary) out.push(estimate.summary);
    for (const ref of estimate.references) out.push(ref, `參考行情 車隊表 ${ref}`);
  } catch {
    // An unreadable row still gets the marker checks in sendBlock.
  }
  out.push(...(panelLines(quote.quoteOptions) || []));
  out.push(...storedFleetHints(quote.quoteOptions));
  const fare = savedFleetFare(quote);
  if (fare.rateId || fare.hours) {
    const draft = buildFleetQuoteDraft({
      pickup: quote.pickup || "", destination: quote.destination || "", remark: quote.remark || "",
      vehicleHint: quote.recommendedVehicle || "", passengerCount: quote.passengerCount ?? null, hours: fare.hours, rateId: fare.rateId,
    });
    out.push(...fleetDraftHints(draft));
  }
  return out;
}
