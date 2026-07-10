-- Sprint 2 hard gate: durable sliding-window rate limit for /api/gate.
-- Rows are failures only; /api/gate deletes rows older than an hour opportunistically.
CREATE TABLE IF NOT EXISTS gate_attempts (
  ip TEXT NOT NULL,
  ts INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_gate_attempts_ip_ts ON gate_attempts (ip, ts);
