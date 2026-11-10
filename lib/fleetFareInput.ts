import { isFareHours, isFleetRateId } from "@/lib/fleetQuoteDraft";
import type { FleetRateId } from "@/lib/fleetCatalog";

type TripSource = { pickup?: string | null; destination?: string | null; remark?: string | null };
type FareInput = { rateId: FleetRateId | null; hours: number | null };

function object(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function source(quote: TripSource) {
  return { pickup: quote.pickup || "", destination: quote.destination || "", remark: quote.remark || "" };
}

/** Changed itinerary requires a new staff selection. Editable draft prose is never read. */
export function savedFleetFare(quote: TripSource & { quoteOptions?: unknown }): FareInput {
  const saved = object(object(quote.quoteOptions).fleetFare);
  const original = object(saved.source);
  const current = source(quote);
  if (saved.version !== 1 || original.pickup !== current.pickup || original.destination !== current.destination || original.remark !== current.remark) {
    return { rateId: null, hours: null };
  }
  return { rateId: isFleetRateId(saved.rateId) ? saved.rateId : null, hours: isFareHours(saved.hours) ? saved.hours : null };
}

export function withFleetFare(quote: TripSource & { quoteOptions?: unknown }, fare: FareInput) {
  const existing = quote.quoteOptions;
  const options = Array.isArray(existing) ? { legacyOptions: existing } : object(existing);
  return { ...options, fleetFare: { version: 1, ...fare, source: source(quote) } };
}
