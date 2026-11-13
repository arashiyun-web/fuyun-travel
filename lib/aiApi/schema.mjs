import { z } from 'zod';

const text = () => z.string().regex(/^[^\u0000]*$/, 'NUL characters are not supported');
const date = text().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD').refine(value => {
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}, 'Invalid calendar date').describe('Calendar date YYYY-MM-DD, today or later in Asia/Taipei.');
const tripShape = {
  pickup: text().trim().min(1).max(300),
  destination: text().trim().min(1).max(300),
  date,
  end_date: date.optional().describe('Optional inclusive trip end date; must be on or after date.'),
  passenger_count: z.number().int().min(1).max(60),
  vehicle: text().trim().min(1).max(100).optional().describe('Vehicle preference, e.g. 大巴, 中巴, 九人座. Omit to infer using existing quote rules.'),
  notes: text().trim().max(2000).optional(),
};
export const quoteSchema = z.strictObject(tripShape);
export const availabilitySchema = z.strictObject(tripShape);
export const quoteResultSchema = z.strictObject({
  price_available: z.boolean(), low: z.number().nonnegative().nullable(), high: z.number().nonnegative().nullable(),
  currency: z.literal('TWD'), day_type: z.enum(['weekday', 'holiday']),
  vehicle: text().nullable(), route: text().nullable(),
  driver_fee: z.strictObject({ included: z.literal(false), weekday: z.literal(2500), holiday: z.literal(3500), amount: z.number().nullable(), unit: z.literal('per_day'), note: text() }),
  tax_note: text(), requires_human_confirmation: z.literal(true), note: text(), note_en: text(),
  pricing_note: text().nullable(),
});
export const availabilityResultSchema = z.strictObject({ status: z.literal('pending_human_confirmation'), requires_human_confirmation: z.literal(true), note: text(), note_en: text() });
export const bookingSchema = z.strictObject({
  ...tripShape,
  contact_name: text().trim().min(1).max(100),
  phone: text().trim().regex(/^\+?[0-9][0-9 ()-]{6,23}$/, 'Invalid phone format').refine(v => { const count = v.replace(/\D/g, '').length; return count >= 8 && count <= 15; }, 'Phone requires 8–15 digits'),
  email: z.email().max(254).optional(),
  time: text().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/, 'Use HH:mm'),
  quote_range: quoteResultSchema.optional().describe('Optional reference quote only; never a confirmed fare.'),
});
export const bookingResultSchema = z.strictObject({ booking_number: text(), status: z.enum(['pending_review', 'confirmed', 'rejected']), replay: z.boolean(), is_test: z.boolean(), requires_human_confirmation: z.literal(true), note: text(), note_en: text() });
export const errorSchema = z.object({ error: text(), issues: z.array(z.object({ path: z.array(z.union([text(), z.number()])), message: text() })).optional() });
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
