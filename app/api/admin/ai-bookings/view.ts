import type { AiBooking } from "@prisma/client";

/** Public admin fields only; never serialize credentials, idempotency or LINE delivery internals. */
export const BOOKING_SELECT = {
  source: true, contactChannel: true, contactId: true, luggageCount: true,
  id: true, bookingNumber: true, contactName: true, phone: true, email: true,
  date: true, endDate: true, time: true, pickup: true, destination: true,
  passengerCount: true, vehicle: true, notes: true, quoteRange: true,
  status: true, isTest: true, notificationStatus: true, notificationAttempts: true,
  notificationLastError: true, createdAt: true, updatedAt: true,
} as const;
type ReviewBooking = Pick<AiBooking, keyof typeof BOOKING_SELECT>;

export function adminBookingView(booking: ReviewBooking): ReviewBooking {
  const { id, bookingNumber, contactName, phone, email, date, endDate, time, pickup, destination,
    source, contactChannel, contactId, luggageCount, passengerCount, vehicle, notes, quoteRange, status, isTest, notificationStatus,
    notificationAttempts, notificationLastError, createdAt, updatedAt } = booking;
  return { id, bookingNumber, contactName, phone, email, date, endDate, time, pickup, destination,
    source, contactChannel, contactId, luggageCount, passengerCount, vehicle, notes, quoteRange, status, isTest, notificationStatus,
    notificationAttempts, notificationLastError, createdAt, updatedAt };
}
