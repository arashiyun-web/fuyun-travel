-- Members already declared in schema.prisma but missing from earlier migrations.
-- Empty table only. Does not restore dispatch_orders and does not copy customer messages.
CREATE TABLE "line_users" (
    "id" TEXT NOT NULL,
    "line_uid" TEXT NOT NULL,
    "name" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "member_level" TEXT,
    "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "inquiry_history" JSONB,
    "quote_history" JSONB,
    "order_history" JSONB,
    "trip_history" JSONB,
    "coupon_history" JSONB,
    "repurchase_history" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "line_users_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "line_users_line_uid_key" ON "line_users"("line_uid");
