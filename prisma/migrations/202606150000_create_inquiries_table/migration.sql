-- CreateTable
CREATE TABLE "inquiries" (
    "id" TEXT NOT NULL,
    "agency_id" TEXT,
    "customer_name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "line_id" TEXT,
    "email" TEXT,
    "trip_type" TEXT NOT NULL,
    "start_date" TIMESTAMP(3),
    "pickup_location" TEXT,
    "destination" TEXT,
    "passenger_count" INTEGER NOT NULL,
    "preferred_vehicle" TEXT[],
    "special_requests" TEXT,
    "source" TEXT,
    "status" TEXT NOT NULL DEFAULT 'New',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inquiries_pkey" PRIMARY KEY ("id")
);
