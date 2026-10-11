CREATE TABLE "dispatch_orders" (
  "id" TEXT NOT NULL,
  "trip_date" TEXT,
  "trip_time" TEXT,
  "license_plate" TEXT,
  "driver_name" TEXT,
  "driver_phone" TEXT,
  "destination" TEXT,
  "group_id" TEXT,
  "sender_user_id" TEXT,
  "raw_text" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "dispatch_orders_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "dispatch_orders_trip_date_idx" ON "dispatch_orders"("trip_date");
