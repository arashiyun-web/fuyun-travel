ALTER TABLE "charter_quotes"
  ADD COLUMN IF NOT EXISTS "quote_draft_text" TEXT,
  ADD COLUMN IF NOT EXISTS "quote_status" TEXT NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN IF NOT EXISTS "sent_at" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "charter_quotes_quote_status_idx" ON "charter_quotes"("quote_status");
