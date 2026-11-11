-- Additive and repeatable. The primary key makes each Taipei date unique.
-- No changes to existing tables, and no deployment is performed by application code.
CREATE TABLE IF NOT EXISTS "friday_reminder_sends" (
  "reminder_date" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "friday_reminder_sends_pkey" PRIMARY KEY ("reminder_date")
);
