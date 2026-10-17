-- Remove LINE raw-event archive table (Owner 2026-10-17: LINE 原文不進 Neon).
-- Additive-safe: drops only this table + its indexes. Existing rows are zero (verified before drop).
DROP TABLE IF EXISTS "line_raw_events_paused";
DROP TABLE IF EXISTS "line_raw_events";
