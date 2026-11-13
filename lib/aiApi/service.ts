import { customerRange, dayTypeOf, rangeVehicle, MIDIBUS_TERMS_NOTE, SURCHARGE_NOTE } from '@/lib/quoteRange';
import { BUS_DRIVER_FEE } from '@/lib/busRangeTable';
import { validateInput, type Operation, type BookingInput, type TripInput, type QuoteResult } from './schema.mjs';
import { AiApiError } from './errors';
import type { AiStore, Identity } from './store';
export class AiApiService {
  constructor(private store: AiStore, private notify: (id: string) => Promise<unknown>, private now: () => Date = () => new Date()) {}
  async authorize(request: Request): Promise<Identity> {
    const match = /^Bearer (fyk_[A-Za-z0-9_-]{43})$/i.exec(request.headers.get('Authorization') ?? '');
    if (!match) throw new AiApiError(401, 'A bearer API key is required');
    return this.store.authorize(match[1], this.now());
  }
  validate(name: Operation, input: unknown) {
    const parsed = validateInput(name, input, this.now(), name === 'create_booking');
    if (!parsed.success) throw new AiApiError(400, 'Invalid input', undefined, parsed.error.issues.map(i => ({ path: i.path, message: i.message })));
    return parsed.data;
  }
  async execute(name: Operation, raw: unknown, identity: Identity, idempotency: string | null) {
    const input = this.validate(name, raw);
    if (name === 'get_quote') return this.quote(input);
    if (name === 'check_availability') return { status: 'pending_human_confirmation', requires_human_confirmation: true,
      note: '車況待專人確認，目前未保留車輛。', note_en: 'Vehicle availability is pending human confirmation. No vehicle has been reserved.' };
    if (idempotency !== null && (!idempotency.trim() || idempotency.length > 200 || /[^\x21-\x7e]/.test(idempotency))) {
      throw new AiApiError(400, 'Invalid input', undefined, [{ path: ['Idempotency-Key'], message: 'Use 1–200 printable ASCII characters without spaces' }]);
    }
    const result = await this.store.createBooking(identity, input as BookingInput, idempotency, this.now());
    if (!result.replay) {
      try { await this.notify(result.booking.id); }
      catch { await this.store.notificationFailed(result.booking.id).catch(() => {}); }
    }
    return { booking_number: result.booking.booking_number, status: result.booking.status, replay: result.replay, is_test: result.booking.is_test,
      requires_human_confirmation: true, note: '這不是成交，專人確認後會聯絡您並提供正式報價',
      note_en: 'This is not a confirmed booking. Our team will contact you after review and provide a formal quote.' };
  }
  private quote(input: TripInput): QuoteResult {
    const date = input.end_date ? `${input.date} ~ ${input.end_date}` : input.date;
    const aliases: Record<string, string> = { bus: '大巴', midibus: '中巴', van: '九人座' };
    const hint = input.vehicle ? aliases[input.vehicle] ?? input.vehicle : undefined;
    const range = customerRange({ pickup: input.pickup, destination: input.destination, date, passengerCount: input.passenger_count, recommendedVehicle: hint, remark: input.notes }, this.now());
    const knownHint = !hint || rangeVehicle({ recommendedVehicle: hint }) !== null;
    const span = input.end_date ? (Date.parse(input.end_date) - Date.parse(input.date)) / 86400000 : 0;
    const available = knownHint && span < 14 && range.low != null && range.high != null;
    const day = dayTypeOf(date, this.now())?.dayType ?? 'weekday';
    return { price_available: available, low: available ? range.low : null, high: available ? range.high : null,
      currency: 'TWD', day_type: day, vehicle: range.vehicleLabel, route: range.routeLabel,
      driver_fee: { included: false, weekday: BUS_DRIVER_FEE.weekday, holiday: BUS_DRIVER_FEE.holiday, amount: span > 0 ? null : BUS_DRIVER_FEE[day], unit: 'per_day', note: '司機服務費另計，平日每日 2,500、假日每日 3,500；國定假日及跨日明細由專人確認。' },
      tax_note: range.vehicle === 'midibus' ? MIDIBUS_TERMS_NOTE : '稅金是否適用及最終費用由專人確認。',
      requires_human_confirmation: true, note: '此為參考範圍價，須專人確認車輛與最終價格',
      note_en: 'This is an indicative price range. Vehicle availability and the final price require human confirmation.',
      pricing_note: available ? [range.note, SURCHARGE_NOTE].filter(Boolean).join(' ') : '將由專人報價' };
  }
}
