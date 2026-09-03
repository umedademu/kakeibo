CREATE TABLE current_balances (
  account_id TEXT PRIMARY KEY,
  amount INTEGER NOT NULL DEFAULT 0 CHECK (amount >= 0),
  updated_at TEXT,
  sort_order INTEGER NOT NULL
);

CREATE TABLE balance_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id TEXT NOT NULL,
  amount INTEGER NOT NULL CHECK (amount >= 0),
  recorded_at TEXT NOT NULL
);

CREATE INDEX balance_events_account_time
  ON balance_events (account_id, recorded_at);

CREATE TABLE daily_balance_snapshots (
  balance_date TEXT NOT NULL,
  account_id TEXT NOT NULL,
  amount INTEGER NOT NULL CHECK (amount >= 0),
  recorded_at TEXT NOT NULL,
  PRIMARY KEY (balance_date, account_id)
);

INSERT INTO current_balances (account_id, amount, updated_at, sort_order) VALUES
  ('wallet', 0, NULL, 1),
  ('paypay', 0, NULL, 2),
  ('paypay_bank', 0, NULL, 3),
  ('pachinko', 0, NULL, 4),
  ('fx', 0, NULL, 5);
