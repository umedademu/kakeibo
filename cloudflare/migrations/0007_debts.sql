CREATE TABLE debts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 80),
  amount INTEGER NOT NULL CHECK (amount >= 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
