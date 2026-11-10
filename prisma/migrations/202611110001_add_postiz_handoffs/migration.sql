-- Additive only. Not applied to the production database by this change.
-- Records one Postiz draft handoff per approved content and social platform.
CREATE TABLE "postiz_handoffs" (
    "id" TEXT NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "content_id" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "postiz_post_id" TEXT,
    "last_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "postiz_handoffs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "postiz_handoffs_idempotency_key_key" ON "postiz_handoffs"("idempotency_key");
CREATE UNIQUE INDEX "postiz_handoffs_content_id_platform_key" ON "postiz_handoffs"("content_id", "platform");
