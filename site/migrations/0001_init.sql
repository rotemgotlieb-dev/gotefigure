-- GoteFigure subscribers: the notify-me / pre-order list.
-- Owned in Cloudflare D1, no external email service.
CREATE TABLE IF NOT EXISTS subscribers (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  email      TEXT NOT NULL UNIQUE,
  source     TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
