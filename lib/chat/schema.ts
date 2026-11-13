import { z } from 'zod';
import { quoteSchema } from '@/lib/aiApi/schema.mjs';
export type ChatLocale = 'zh-TW' | 'zh-CN' | 'en';
const text = z.string().trim().min(1).max(100).regex(/^[^\u0000\r\n]*$/);
export const chatBookingSchema = z.strictObject({
  trip: quoteSchema.describe('Trip details; dates and price use the existing quote service.'),
  contact_name: text.describe('Contact name.'),
  contact_channel: z.enum(['phone', 'line', 'whatsapp', 'wechat']).describe('Preferred personal contact channel.'),
  phone: z.string().trim().regex(/^\+?[0-9][0-9 ()-]{6,23}$/).refine(v => { const n = v.replace(/\D/g, '').length; return n >= 8 && n <= 15; }).optional().describe('Phone number with 8–15 digits, if provided.'),
  contact_id: text.optional().describe('LINE, WhatsApp or WeChat ID; required for messaging channels.'),
  time: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/).describe('Departure time HH:mm in Taiwan.'),
  luggage_count: z.number().int().min(0).max(100).describe('Number of luggage pieces, 0–100.'),
  customer_confirmed: z.literal(true).describe('True only after showing all details and receiving explicit customer confirmation.'),
}).superRefine((v, ctx) => {
  if (v.contact_channel === 'phone' ? !v.phone : !v.contact_id) ctx.addIssue({ code: 'custom', path: [v.contact_channel === 'phone' ? 'phone' : 'contact_id'], message: 'Contact information required for the selected channel' });
});
export type ChatBooking = z.infer<typeof chatBookingSchema>;
