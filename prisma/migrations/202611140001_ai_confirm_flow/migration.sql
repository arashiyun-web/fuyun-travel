-- Incremental only: existing rows remain unchanged. Apply only with owner approval.
ALTER TABLE ai_bookings
  ADD COLUMN query_code_hash TEXT NULL CHECK (query_code_hash IS NULL OR query_code_hash ~ '^[0-9a-f]{64}$'),
  ADD COLUMN status_changed_at TIMESTAMPTZ(6) NULL,
  ADD COLUMN status_changed_by TEXT NULL;
ALTER TABLE ai_bookings DROP CONSTRAINT IF EXISTS ai_bookings_status_check;
ALTER TABLE ai_bookings ADD CONSTRAINT ai_bookings_status_check CHECK (status IN ('pending_review','confirmed','rejected','cancelled'));
ALTER TABLE api_rate_counters DROP CONSTRAINT IF EXISTS api_rate_counters_scope_check;
ALTER TABLE api_rate_counters ADD CONSTRAINT api_rate_counters_scope_check CHECK (scope IN ('minute','day','booking_hour','status_minute','status_fail_hour'));
CREATE TABLE ai_api_audit_logs (
  id TEXT NOT NULL PRIMARY KEY,
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  event_type TEXT NOT NULL CHECK (event_type IN ('tool_call','status_change','notification')),
  channel TEXT NOT NULL CHECK (channel IN ('rest','mcp','admin','system')),
  tool TEXT NULL,
  api_key_id TEXT NULL REFERENCES api_keys(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  booking_id TEXT NULL REFERENCES ai_bookings(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  outcome TEXT NOT NULL,
  http_status INTEGER NULL,
  duration_ms INTEGER NULL,
  from_status TEXT NULL,
  to_status TEXT NULL,
  actor TEXT NULL,
  detail JSONB NULL,
  request_id TEXT NULL
);
CREATE INDEX ai_api_audit_logs_booking_id_created_at_idx ON ai_api_audit_logs(booking_id,created_at);
CREATE INDEX ai_api_audit_logs_created_at_idx ON ai_api_audit_logs(created_at);
CREATE INDEX ai_api_audit_logs_api_key_id_created_at_idx ON ai_api_audit_logs(api_key_id,created_at);
