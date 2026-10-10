-- 一括の固定費を「何月分まで支払済か」で記録します。登録済みの固定費は未払から始めます。
ALTER TABLE fixed_costs
  ADD COLUMN paid_month TEXT
  CHECK (paid_month IS NULL OR paid_month GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]');
