CREATE TABLE IF NOT EXISTS "charter_quotes" (
  "id" TEXT NOT NULL,
  "line_user_id" TEXT NOT NULL,
  "line_name" TEXT,
  "trip_date" TEXT,
  "passenger_count" INTEGER,
  "pickup" TEXT,
  "destination" TEXT,
  "remark" TEXT,
  "recommended_vehicle" TEXT,
  "quote_options" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "charter_quotes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "charter_quotes_line_user_id_idx" ON "charter_quotes"("line_user_id");
CREATE INDEX IF NOT EXISTS "charter_quotes_created_at_idx" ON "charter_quotes"("created_at");

CREATE TABLE IF NOT EXISTS "line_sessions" (
  "user_id" TEXT NOT NULL,
  "state" TEXT NOT NULL,
  "draft_json" JSONB,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "line_sessions_pkey" PRIMARY KEY ("user_id")
);
