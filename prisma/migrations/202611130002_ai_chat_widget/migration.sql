-- Apply only after owner approval. Existing business tables are untouched.
ALTER TABLE ai_bookings ALTER COLUMN api_key_id DROP NOT NULL;
ALTER TABLE ai_bookings ALTER COLUMN phone DROP NOT NULL;
ALTER TABLE ai_bookings ADD COLUMN source TEXT NOT NULL DEFAULT 'api' CHECK (source IN ('api','web_chat'));
ALTER TABLE ai_bookings ADD COLUMN contact_channel TEXT NOT NULL DEFAULT 'phone' CHECK (contact_channel IN ('phone','line','whatsapp','wechat'));
ALTER TABLE ai_bookings ADD COLUMN contact_id TEXT;
ALTER TABLE ai_bookings ADD COLUMN luggage_count INTEGER CHECK (luggage_count BETWEEN 0 AND 100);
ALTER TABLE ai_bookings ADD CONSTRAINT ai_bookings_api_source_key CHECK (source <> 'api' OR api_key_id IS NOT NULL);
ALTER TABLE ai_bookings ADD CONSTRAINT ai_bookings_contact_required CHECK (NULLIF(BTRIM(phone),'') IS NOT NULL OR NULLIF(BTRIM(contact_id),'') IS NOT NULL);
-- Prisma 6 cannot express partial indexes; SQL owns this index.
CREATE UNIQUE INDEX ai_bookings_web_chat_idempotency_key ON ai_bookings(idempotency_key) WHERE source='web_chat';
CREATE TABLE chat_rate_counters (
  subject TEXT NOT NULL, scope TEXT NOT NULL, window_start TIMESTAMPTZ(6) NOT NULL,
  count INTEGER NOT NULL DEFAULT 0 CHECK (count >= 0), expires_at TIMESTAMPTZ(6) NOT NULL,
  PRIMARY KEY(subject,scope,window_start)
);
CREATE INDEX chat_rate_counters_expires_at_idx ON chat_rate_counters(expires_at);
CREATE TABLE ai_tool_events (
  id TEXT PRIMARY KEY, created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  source TEXT NOT NULL CHECK (source IN ('api','mcp','web_chat')),
  tool TEXT NOT NULL CHECK (tool IN ('get_quote','check_availability','create_booking')),
  outcome TEXT NOT NULL CHECK (outcome IN ('ok','invalid','limited','error')),
  latency_ms INTEGER NOT NULL CHECK (latency_ms >= 0),
  prompt_version TEXT, model_id TEXT, subject TEXT, booking_id TEXT,
  input_digest TEXT NOT NULL CHECK (input_digest ~ '^[0-9a-f]{64}$'), error_code TEXT,
  CHECK (source='web_chat' OR (prompt_version IS NULL AND model_id IS NULL))
);
CREATE INDEX ai_tool_events_created_at_idx ON ai_tool_events(created_at);
CREATE INDEX ai_tool_events_source_tool_created_at_idx ON ai_tool_events(source,tool,created_at);
