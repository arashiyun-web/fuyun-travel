CREATE TABLE IF NOT EXISTS "authorized_group_members" (
  "id" TEXT NOT NULL,
  "display_name" TEXT NOT NULL,
  "fb_identifier" TEXT,
  "note" TEXT,
  "added_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "authorized_group_members_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "content_sync_items" (
  "id" TEXT NOT NULL,
  "source_post_id" TEXT,
  "source_type" TEXT NOT NULL,
  "author_name" TEXT,
  "summary" TEXT NOT NULL,
  "post_url" TEXT,
  "posted_at" TIMESTAMP(3),
  "batch_label" TEXT NOT NULL,
  "raw_payload" JSONB,
  "selected" BOOLEAN NOT NULL DEFAULT false,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "content_draft_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "content_sync_items_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "content_sync_items_source_post_id_key" ON "content_sync_items"("source_post_id");
CREATE INDEX IF NOT EXISTS "content_sync_items_status_idx" ON "content_sync_items"("status");
CREATE INDEX IF NOT EXISTS "content_sync_items_batch_label_idx" ON "content_sync_items"("batch_label");
CREATE INDEX IF NOT EXISTS "content_sync_items_source_type_idx" ON "content_sync_items"("source_type");
