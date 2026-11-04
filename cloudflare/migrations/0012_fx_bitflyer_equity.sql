ALTER TABLE fx_equity_sync_records
  ADD COLUMN bitflyer_equity_jpy REAL
  CHECK (bitflyer_equity_jpy IS NULL OR bitflyer_equity_jpy >= 0);
