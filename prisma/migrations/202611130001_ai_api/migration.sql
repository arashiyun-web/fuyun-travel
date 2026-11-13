-- New tables only. Apply to production only after owner-approved Neon backup branch.
CREATE TABLE "api_keys" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "key_hash" TEXT NOT NULL CHECK (key_hash ~ '^[0-9a-f]{64}$'),
  "key_prefix" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "disabled_at" TIMESTAMPTZ(6),
  "last_used_at" TIMESTAMPTZ(6)
);
CREATE UNIQUE INDEX "api_keys_key_hash_key" ON "api_keys"("key_hash");
CREATE TABLE "ai_bookings" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "booking_number" TEXT NOT NULL,
  "api_key_id" TEXT NOT NULL REFERENCES "api_keys"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "contact_name" TEXT NOT NULL, "phone" TEXT NOT NULL, "email" TEXT,
  "date" TEXT NOT NULL, "end_date" TEXT, "time" TEXT NOT NULL,
  "pickup" TEXT NOT NULL, "destination" TEXT NOT NULL,
  "passenger_count" INTEGER NOT NULL CHECK (passenger_count BETWEEN 1 AND 60),
  "vehicle" TEXT, "notes" TEXT, "quote_range" JSONB,
  "status" TEXT NOT NULL DEFAULT 'pending_review' CHECK (status IN ('pending_review','confirmed','rejected')),
  "is_test" BOOLEAN NOT NULL DEFAULT false,
  "idempotency_key" TEXT, "idempotency_expires_at" TIMESTAMPTZ(6),
  "notification_status" TEXT NOT NULL DEFAULT 'pending' CHECK (notification_status IN ('pending','sent','failed')),
  "notification_attempts" INTEGER NOT NULL DEFAULT 0,
  "notification_last_error" TEXT, "notification_retry_key" TEXT NOT NULL,
  "notification_claim" TEXT, "notification_claim_expires_at" TIMESTAMPTZ(6),
  "notification_deliveries" JSONB,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "ai_bookings_booking_number_key" ON "ai_bookings"("booking_number");
CREATE UNIQUE INDEX "ai_bookings_api_key_id_idempotency_key_key" ON "ai_bookings"("api_key_id","idempotency_key");
CREATE INDEX "ai_bookings_created_at_idx" ON "ai_bookings"("created_at");
CREATE INDEX "ai_bookings_status_created_at_idx" ON "ai_bookings"("status","created_at");
CREATE TABLE "api_rate_counters" (
  "api_key_id" TEXT NOT NULL REFERENCES "api_keys"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "scope" TEXT NOT NULL CHECK (scope IN ('minute','day','booking_hour')),
  "window_start" TIMESTAMPTZ(6) NOT NULL,
  "count" INTEGER NOT NULL DEFAULT 0,
  "expires_at" TIMESTAMPTZ(6) NOT NULL,
  PRIMARY KEY ("api_key_id","scope","window_start")
);
CREATE INDEX "api_rate_counters_expires_at_idx" ON "api_rate_counters"("expires_at");
