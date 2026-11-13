import { z } from 'zod';
const d = (schema, description) => schema.describe(description);
const text = () => z.string().regex(/^[^\u0000]*$/, 'NUL characters are not supported');
const date = text().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD').refine(value => {
  const parsed = new Date(value + 'T00:00:00Z');
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}, 'Invalid calendar date').describe('Calendar date YYYY-MM-DD, today or later in Asia/Taipei.');
const tripShape = {
  pickup: d(text().trim().min(1).max(300), 'Pickup address or departure location.'),
  destination: d(text().trim().min(1).max(300), 'Destination address or route name.'),
  date,
  end_date: date.optional().describe('Optional inclusive trip end date; must be on or after date.'),
  passenger_count: d(z.number().int().min(1).max(60), 'Total passengers including adults and children, 1–60.'),
  vehicle: text().trim().min(1).max(100).optional().describe('Vehicle preference, e.g. 大巴, 中巴, 九人座. Omit to infer using existing quote rules.'),
  notes: d(text().trim().max(2000).optional(), 'Optional trip requirements; never an authoritative price.'),
};
export const quoteSchema = z.strictObject(tripShape).describe('Reference quote request; staff must confirm all prices.');
export const availabilitySchema = z.strictObject(tripShape).describe('Availability inquiry; always pending human confirmation, no live inventory.');
export const quoteResultSchema = z.strictObject({
  price_available: d(z.boolean(), 'Whether an approved reference range is available.'),
  low: d(z.number().nonnegative().nullable(), 'Reference lower price in TWD; null when staff pricing is needed.'),
  high: d(z.number().nonnegative().nullable(), 'Reference upper price in TWD; null when staff pricing is needed.'),
  currency: d(z.literal('TWD'), 'Currency: New Taiwan dollars.'),
  day_type: d(z.enum(['weekday', 'holiday']), 'Existing weekday/holiday classification; staff verify public holidays.'),
  vehicle: d(text().nullable(), 'Recommended vehicle label, if known.'),
  route: d(text().nullable(), 'Matched route label, if known.'),
  driver_fee: z.strictObject({
    included: d(z.literal(false), 'Driver service fee is always charged separately.'),
    weekday: d(z.literal(2500), 'Weekday reference driver service fee per day in TWD.'),
    holiday: d(z.literal(3500), 'Holiday reference driver service fee per day in TWD.'),
    amount: d(z.number().nullable(), 'Applicable daily driver fee, or null for multi-day verification.'),
    unit: d(z.literal('per_day'), 'Driver fee unit, per day.'),
    note: d(text(), 'Staff confirmation and driver service fee terms.'),
  }).describe('Separate driver service fee details; never included in the reference range.'),
  tax_note: d(text(), 'Tax and vehicle-specific terms requiring staff confirmation.'),
  requires_human_confirmation: d(z.literal(true), 'Always true; this is not a formal quote or reservation.'),
  note: d(text(), 'Traditional Chinese reference-price disclaimer.'),
  note_en: d(text(), 'English reference-price disclaimer.'),
  pricing_note: d(text().nullable(), 'Existing price-range explanation, surcharges or staff-pricing notice.'),
}).describe('Unchanged indicative customerRange quote result.');
export const availabilityResultSchema = z.strictObject({
  status: d(z.literal('pending_human_confirmation'), 'Always pending staff confirmation; no real-time availability is claimed.'),
  requires_human_confirmation: d(z.literal(true), 'Always true; no vehicle has been reserved.'),
  note: d(text(), 'Traditional Chinese pending-availability notice.'),
  note_en: d(text(), 'English pending-availability notice.'),
});
export const bookingSchema = z.strictObject({
  ...tripShape,
  contact_name: d(text().trim().min(1).max(100), 'Traveler or contact name.'),
  phone: d(text().trim().regex(/^\+?[0-9][0-9 ()-]{6,23}$/, 'Invalid phone format').refine(v => { const count = v.replace(/\D/g, '').length; return count >= 8 && count <= 15; }, 'Phone requires 8–15 digits'), 'Required contact phone with 8–15 digits; optional leading + and separators.'),
  email: d(z.email().max(254).optional(), 'Optional contact email address.'),
  time: d(text().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/, 'Use HH:mm'), 'Departure time HH:mm in Asia/Taipei.'),
  quote_range: quoteResultSchema.optional().describe('Optional reference quote only; never a confirmed fare.'),
});
export const bookingResultSchema = z.strictObject({
  booking_number: d(text(), 'Request number FY-YYYYMMDD-XXXX, or FY-TEST-… for a test request.'),
  status: d(z.enum(['pending_review', 'confirmed', 'rejected']), 'Review state; new requests are pending_review. Replays reflect current state.'),
  replay: d(z.boolean(), 'True when returning an existing request within the 24-hour idempotency window.'),
  is_test: d(z.boolean(), 'Whether the request is explicitly marked as a test.'),
  requires_human_confirmation: d(z.literal(true), 'Always true; staff provide the formal quote and payment link separately.'),
  note: d(text(), 'Traditional Chinese pending-review disclaimer.'),
  note_en: d(text(), 'English pending-review disclaimer.'),
});
export const errorSchema = z.object({
  error: d(text(), 'Safe public error message without credentials or private upstream details.'),
  issues: z.array(z.object({
    path: z.array(z.union([text(), z.number()])).describe('Path to the invalid input field, including nested indexes.'),
    message: d(text(), 'Validation issue for the indicated field.'),
  })).optional().describe('Field validation issues when available.'),
});
export const inputSchemas = { get_quote: quoteSchema, check_availability: availabilitySchema, create_booking: bookingSchema };
export const outputSchemas = { get_quote: quoteResultSchema, check_availability: availabilityResultSchema, create_booking: bookingResultSchema };
export function taipeiDate(now = new Date()) { return new Date(now.getTime() + 8 * 3600000).toISOString().slice(0, 10); }
export function validateInput(name, input, now = new Date(), allowPastDate = false) {
  const result = inputSchemas[name].safeParse(input);
  if (!result.success) return result;
  const issues = [];
  if (!allowPastDate && result.data.date < taipeiDate(now)) issues.push({ code: 'custom', path: ['date'], message: 'Date is before today in Asia/Taipei' });
  if (result.data.end_date && result.data.end_date < result.data.date) issues.push({ code: 'custom', path: ['end_date'], message: 'End date must be on or after date' });
  return issues.length ? { success: false, error: { issues } } : result;
}
