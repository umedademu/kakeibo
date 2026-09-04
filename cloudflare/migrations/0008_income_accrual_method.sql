ALTER TABLE incomes
  ADD COLUMN accrual_method TEXT NOT NULL DEFAULT 'lump_sum'
  CHECK (accrual_method IN ('lump_sum', 'daily'));

UPDATE incomes
SET accrual_method = 'daily';
