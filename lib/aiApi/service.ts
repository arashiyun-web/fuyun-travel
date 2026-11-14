import { customerRange, dayTypeOf, rangeVehicle, MIDIBUS_TERMS_NOTE, SURCHARGE_NOTE } from '@/lib/quoteRange';
import { BUS_DRIVER_FEE } from '@/lib/busRangeTable';
import { validateInput, type Operation, type BookingInput, type TripInput, type QuoteResult, type StatusInput } from './schema.mjs';
import { AiApiError } from './errors';
import type { AuditEvent, CallContext } from './audit';
import type { AiStore, Identity } from './store';
const publicStatuses = { pending_review: 'pending', confirmed: 'confirmed_by_staff', rejected: 'rejected', cancelled: 'cancelled' } as const;
const statusLabels = { pending_review: '待專人確認', confirmed: '專人已確認', rejected: '已婉拒', cancelled: '已取消' } as const;
export class AiApiService {
  constructor(private store: AiStore, private notify: (id: string) => Promise<unknown>, private now: () => Date = () => new Date()) {}
  async authorize(request: Request, operation?: Operation): Promise<Identity> {
    const match = /^Bearer (fyk_[A-Za-z0-9_-]{43})$/i.exec(request.headers.get('Authorization') ?? '');
    if (!match) throw new AiApiError(401, 'A bearer API key is required');
    return this.store.authorize(match[1], this.now(), operation === 'get_booking_status');
  }
  validate(name: Operation, input: unknown) {
    const parsed = validateInput(name, input, this.now(), name === 'create_booking');
    if (!parsed.success) throw new AiApiError(400, 'Invalid input', undefined, parsed.error.issues.map(i => ({ path: i.path, message: i.message })));
    return parsed.data;
  }
  async audit(event: AuditEvent) { await this.store.audit(event).catch(() => {}); }
  async execute(name: Operation, raw: unknown, identity: Identity, idempotency: string | null, context: CallContext = {}) {
    const input = this.validate(name, raw);
    if (name === 'get_booking_status') {
      const row = await this.store.getBookingStatus(identity, input as StatusInput, this.now());
      context.bookingId = row.id;
      const confirmed = row.status === 'confirmed';
      return { booking_number: row.booking_number, status: publicStatuses[row.status], status_label: statusLabels[row.status],
        is_test: row.is_test, created_at: row.created_at.toISOString(), status_updated_at: (row.status_changed_at ?? row.created_at).toISOString(),
        trip: { date: row.date, end_date: row.end_date, time: row.time, passenger_count: row.passenger_count, vehicle: row.vehicle },
        requires_human_confirmation: true,
        disclaimer: '車況與價格一律待專人確認；此狀態不代表成交，正式報價與接單由專人另行聯繫確認。' + (confirmed ? '已由專人確認，正式報價與付款方式以專人聯繫為準，本接口不處理付款。' : ''),
        disclaimer_en: 'Vehicle availability and pricing always require staff confirmation. This status does not represent a sale; staff will contact you separately to confirm the formal quote and acceptance.' + (confirmed ? ' Confirmed by staff; the formal quote and payment arrangements are subject to direct staff contact. This API does not process payments.' : ''),
      };
    }
    if (name === 'get_quote') return this.quote(input as TripInput);
    if (name === 'check_availability') return { status: 'pending_human_confirmation', requires_human_confirmation: true,
      note: '車況待專人確認，目前未保留車輛。', note_en: 'Vehicle availability is pending human confirmation. No vehicle has been reserved.' };
    if (idempotency !== null && (!idempotency.trim() || idempotency.length > 200 || /[^\x21-\x7e]/.test(idempotency))) {
      throw new AiApiError(400, 'Invalid input', undefined, [{ path: ['Idempotency-Key'], message: 'Use 1–200 printable ASCII characters without spaces' }]);
    }
    const result = await this.store.createBooking(identity, input as BookingInput, idempotency, this.now());
    context.bookingId = result.booking.id;
    if (!result.replay) {
      try { await this.notify(result.booking.id); }
      catch { await this.store.notificationFailed(result.booking.id).catch(() => {}); }
    }
    return { booking_number: result.booking.booking_number, status: publicStatuses[result.booking.status], query_code: result.queryCode, query_code_note: '請妥善保存，僅此一次顯示；遺失可用單號＋電話末四碼查詢', replay: result.replay, is_test: result.booking.is_test,
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
