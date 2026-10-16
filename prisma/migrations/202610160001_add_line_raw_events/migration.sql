-- LINE raw event full-capture table (additive only, no changes to existing tables).
CREATE TABLE "line_raw_events" (
  "id" TEXT NOT NULL,
  "line_event_id" TEXT,
  "message_id" TEXT,
  "content_hash" TEXT NOT NULL,
  "source_type" TEXT NOT NULL DEFAULT 'LINE',
  "source_user_id" TEXT,
  "source_message_id" TEXT,
  "source_text" TEXT NOT NULL,
  "source_timestamp" TIMESTAMP(3),
  "source_sender" TEXT,
  "raw_payload" TEXT NOT NULL,
  "processing_status" TEXT NOT NULL DEFAULT 'RECEIVED',
  "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "line_raw_events_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "line_raw_events_line_event_id_key" ON "line_raw_events"("line_event_id");
CREATE UNIQUE INDEX "line_raw_events_message_id_key" ON "line_raw_events"("message_id");
CREATE INDEX "line_raw_events_content_hash_idx" ON "line_raw_events"("content_hash");
CREATE INDEX "line_raw_events_processing_status_idx" ON "line_raw_events"("processing_status");
