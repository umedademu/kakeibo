CREATE TABLE fx_sync_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  balance_usd REAL NOT NULL CHECK (balance_usd >= 0),
  usd_jpy_rate REAL NOT NULL CHECK (usd_jpy_rate > 0),
  balance_jpy INTEGER NOT NULL CHECK (balance_jpy >= 0),
  rate_symbol TEXT NOT NULL,
  source_recorded_at TEXT NOT NULL,
  rate_recorded_at TEXT NOT NULL,
  received_at TEXT NOT NULL
);

CREATE INDEX fx_sync_records_received_at
  ON fx_sync_records (received_at);
