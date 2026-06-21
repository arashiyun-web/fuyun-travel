CREATE TABLE IF NOT EXISTS "articles" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "excerpt" TEXT,
  "category" TEXT NOT NULL,
  "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "location" TEXT,
  "seo_json" JSONB,
  "schema_json" JSONB,
  "fb_post_id" TEXT,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "published_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "articles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "articles_slug_key" ON "articles"("slug");
CREATE UNIQUE INDEX IF NOT EXISTS "articles_fb_post_id_key" ON "articles"("fb_post_id");
CREATE INDEX IF NOT EXISTS "articles_status_published_at_idx" ON "articles"("status", "published_at");
