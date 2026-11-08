-- PENDING REVIEW. Not in prisma/migrations, so migrate deploy will not apply it.
-- Passenger charter order only. Columns are the quote link, LINE user id, amount, vehicle, and route.
CREATE TABLE "charter_orders" (
    "id" TEXT NOT NULL,
    "quote_id" TEXT NOT NULL,
    "line_uid" TEXT NOT NULL,
    "amount_twd" INTEGER NOT NULL,
    "vehicle_label" TEXT NOT NULL,
    "route_label" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'confirmed',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "charter_orders_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "charter_orders_quote_id_key" ON "charter_orders"("quote_id");
