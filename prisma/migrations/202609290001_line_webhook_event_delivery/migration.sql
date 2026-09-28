-- LINE webhook: atomic per-event claim and separate delivery tracking (additive only).
-- Rows written before this migration were fully handled, so they default to 'replied'.
ALTER TABLE "line_webhook_events" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'replied';
ALTER TABLE "line_webhook_events" ADD COLUMN "reply_text" TEXT;
ALTER TABLE "line_webhook_events" ADD COLUMN "claimed_at" TIMESTAMP(3);
