-- S6 orders: order metadata written ONLY by the signature-verified Fourthwall
-- webhook handler (POST /api/orders/webhook). NO card data, ever: Fourthwall is
-- Merchant of Record, card entry never touches this codebase (SAQ A posture,
-- Safe Backend Doctrine payments section). fw_id is the idempotency key: a
-- replayed webhook upserts the same row, never a second one.
CREATE TABLE IF NOT EXISTS orders (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  fw_id           TEXT NOT NULL UNIQUE,        -- Fourthwall order id (idempotency key)
  friendly_id     TEXT,                        -- Fourthwall human-facing order reference
  email           TEXT,
  line_items      TEXT NOT NULL DEFAULT '[]',  -- JSON array (name/variant/qty/unit price); no card fields exist in this schema
  shipping_status TEXT NOT NULL DEFAULT 'unknown',
  raw_event       TEXT,                        -- last verified FW payload, for reconciliation against FW as source of truth
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders (created_at);
