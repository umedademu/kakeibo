CREATE TABLE fixed_costs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 80),
  amount INTEGER NOT NULL CHECK (amount >= 0),
  payment_day INTEGER NOT NULL CHECK (payment_day BETWEEN 1 AND 31),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX fixed_costs_payment_day
  ON fixed_costs (payment_day, id);
