-- 登録済みの固定費と更新前の画面からの登録は、従来の日割り計算を引き継ぎます。
ALTER TABLE fixed_costs
  ADD COLUMN accrual_method TEXT NOT NULL DEFAULT 'daily'
  CHECK (accrual_method IN ('lump_sum', 'daily'));
