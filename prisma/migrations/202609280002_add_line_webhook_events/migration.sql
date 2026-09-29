-- LINE webhook redelivery dedupe (additive only).
CREATE TABLE "line_webhook_events" (
    "webhook_event_id" TEXT NOT NULL,
    "handled_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "line_webhook_events_pkey" PRIMARY KEY ("webhook_event_id")
);

CREATE INDEX "line_webhook_events_handled_at_idx" ON "line_webhook_events"("handled_at");
