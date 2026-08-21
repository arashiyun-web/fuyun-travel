-- AlterTable
ALTER TABLE "featured_spots" ADD COLUMN     "photo_urls" TEXT[] DEFAULT ARRAY[]::TEXT[];
