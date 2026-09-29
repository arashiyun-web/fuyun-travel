-- Additive only: new tables for the operations backend and the Instagram token store.
CREATE TABLE "operations_contents" (
    "id" TEXT NOT NULL,
    "content_fingerprint" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "trip_date" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "images" JSONB NOT NULL,
    "selected_platforms" TEXT[],
    "status" TEXT NOT NULL,
    "approval_status" TEXT NOT NULL DEFAULT 'pending',
    "approved_at" TIMESTAMP(3),
    "approved_by" TEXT,
    "generation_mode" TEXT NOT NULL DEFAULT 'deterministic_template',
    "source" TEXT NOT NULL DEFAULT 'mobile',
    "revision_of" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "operations_contents_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "operations_contents_content_fingerprint_key" ON "operations_contents"("content_fingerprint");
CREATE INDEX "operations_contents_created_at_idx" ON "operations_contents"("created_at");

CREATE TABLE "operations_jobs" (
    "job_id" TEXT NOT NULL,
    "content_id" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "caption" TEXT NOT NULL,
    "image_url" TEXT,
    "image_urls" TEXT[],
    "status" TEXT NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "scheduled_at" TIMESTAMP(3),
    "locked_until" TIMESTAMP(3),
    "lock_owner" TEXT,
    "approval_hash" TEXT,
    "fact_check" JSONB,
    "external_id" TEXT,
    "post_url" TEXT,
    "last_error" TEXT,
    "verification" TEXT NOT NULL DEFAULT 'not_tested',
    "adapter" TEXT NOT NULL,
    "submission" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "operations_jobs_pkey" PRIMARY KEY ("job_id")
);
CREATE UNIQUE INDEX "operations_jobs_idempotency_key_key" ON "operations_jobs"("idempotency_key");
CREATE UNIQUE INDEX "operations_jobs_content_id_platform_key" ON "operations_jobs"("content_id", "platform");
CREATE INDEX "operations_jobs_status_scheduled_at_idx" ON "operations_jobs"("status", "scheduled_at");
ALTER TABLE "operations_jobs" ADD CONSTRAINT "operations_jobs_content_id_fkey" FOREIGN KEY ("content_id") REFERENCES "operations_contents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "operations_events" (
    "id" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "type" TEXT NOT NULL,
    "content_id" TEXT NOT NULL,
    "job_id" TEXT,
    "platform" TEXT,
    "detail" TEXT,
    CONSTRAINT "operations_events_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "operations_events_content_id_at_idx" ON "operations_events"("content_id", "at");

CREATE TABLE "instagram_login_tokens" (
    "slot" TEXT NOT NULL,
    "encrypted" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "instagram_login_tokens_pkey" PRIMARY KEY ("slot")
);
