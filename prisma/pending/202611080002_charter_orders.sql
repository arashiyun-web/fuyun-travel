-- PENDING REVIEW. Not in prisma/migrations, so migrate deploy will not apply it.
-- Passenger charter order. base_amount_twd is the package fare only.
-- total_amount_twd stays empty until a person approves a complete price.
-- Default status is pending_confirmation, not a customer-confirmed order.
CREATE TABLE "charter_orders" (
    "id" TEXT NOT NULL,
    "quote_id" TEXT NOT NULL,
    "line_uid" TEXT NOT NULL,
    "base_amount_twd" INTEGER NOT NULL,
    "total_amount_twd" INTEGER,
    "vehicle_label" TEXT NOT NULL,
    "route_label" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending_confirmation',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "charter_orders_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "charter_orders_quote_id_key" ON "charter_orders"("quote_id");
