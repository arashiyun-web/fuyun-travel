-- Remove LINE dispatch-parse table (Owner 2026-10-19: 派車解析已從 webhook 移除，司機個資與誤收的客人私訊不留在 Neon).
-- Full table (2 rows) exported to the owner's machine before drop; backup SHA-256 6742f31512bfc522c5bd73976e792e3e2d26439d3f9b31931c4b742927034588.
DROP TABLE IF EXISTS "dispatch_orders";
