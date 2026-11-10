-- Canonical additive migration. Safe to re-run when an identical table already exists.
-- Passenger charter order. base_amount_twd is the package fare only.
-- total_amount_twd is empty until staff prices each open item.
-- pending_confirmation is not customer consent. staff_priced is an internal total only.
CREATE TABLE IF NOT EXISTS "charter_orders" (
    "id" TEXT NOT NULL,
    "quote_id" TEXT NOT NULL,
    "line_uid" TEXT NOT NULL,
    "base_amount_twd" INTEGER NOT NULL,
    "total_amount_twd" INTEGER,
    "vehicle_label" TEXT NOT NULL,
    "route_label" TEXT NOT NULL,
    "quote_fingerprint" TEXT NOT NULL,
    "review_json" JSONB,
    "status" TEXT NOT NULL DEFAULT 'pending_confirmation',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "charter_orders_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "charter_orders_quote_id_key" ON "charter_orders"("quote_id");
