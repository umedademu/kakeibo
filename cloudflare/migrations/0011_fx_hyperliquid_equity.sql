ALTER TABLE fx_equity_sync_records
  ADD COLUMN hyperliquid_equity_usd REAL
  CHECK (hyperliquid_equity_usd IS NULL OR hyperliquid_equity_usd >= 0);
