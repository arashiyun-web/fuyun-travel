CREATE TABLE "ai_conversations" (
  "id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "session_id" TEXT,
  "source" TEXT NOT NULL,
  "user_id" TEXT,
  "query" TEXT NOT NULL,
  "intent" TEXT NOT NULL,
  "reply" TEXT NOT NULL,
  "route" TEXT,
  "people_count" INTEGER,
  "luggage_count" INTEGER,
  "estimated_price" INTEGER,
  "status" TEXT NOT NULL DEFAULT 'answered',

  CONSTRAINT "ai_conversations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ai_conversations_created_at_idx" ON "ai_conversations"("created_at");
CREATE INDEX "ai_conversations_source_idx" ON "ai_conversations"("source");
CREATE INDEX "ai_conversations_intent_idx" ON "ai_conversations"("intent");
CREATE INDEX "ai_conversations_route_idx" ON "ai_conversations"("route");
