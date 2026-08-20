-- CreateTable
CREATE TABLE "featured_spots" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "photo_url" TEXT,
    "source_url" TEXT,
    "source_item_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "featured_spots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "featured_spots_status_idx" ON "featured_spots"("status");
