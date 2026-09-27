import assert from "node:assert/strict";
import test from "node:test";
import { createAssetForecast } from "../app/lib/asset-forecast.ts";

const balances = [{ amount: 100000 }];
const item = (amount, paymentDay, accrualMethod) => ({ amount, paymentDay, accrualMethod });
const pointAt = (forecast, date) => forecast.points.find((point) => point.date === date);

test("一括の固定費は支払日にだけ全額を差し引く", () => {
  const forecast = createAssetForecast(balances, [item(30000, 15, "lump_sum")], [], new Date("2026-09-13T00:00:00+09:00"));
  assert.equal(pointAt(forecast, "2026-09-14").dailyFixedCost, 0);
  assert.equal(pointAt(forecast, "2026-09-15").dailyFixedCost, 30000);
  assert.equal(pointAt(forecast, "2026-09-16").dailyFixedCost, 0);
  assert.equal(forecast.points.at(-1).total, 70000);
  assert.equal(forecast.monthlyFixedCost, 30000);
});

test("日割りは月をまたぐとその月の日数に合わせ、計算途中で丸めない", () => {
  const forecast = createAssetForecast(balances, [item(31000, 25, "daily")], [], new Date("2026-04-29T00:00:00+09:00"));
  assert.equal(pointAt(forecast, "2026-04-30").dailyFixedCost, 1033);
  assert.equal(pointAt(forecast, "2026-05-01").dailyFixedCost, 1000);
  assert.equal(forecast.points.at(-1).total, Math.round(100000 - 31000 / 30 - 29000));
});

test("一括と日割りを混在させ、同日の収入も合わせて反映する", () => {
  const forecast = createAssetForecast(
    balances,
    [item(30000, 15, "lump_sum"), item(3000, 1, "daily")],
    [item(60000, 15, "lump_sum"), item(6000, 1, "daily")],
    new Date("2026-09-14T00:00:00+09:00"),
  );
  assert.deepEqual(forecast.points[0], { date: "2026-09-15", dailyIncome: 60200, dailyFixedCost: 30100, total: 130100 });
  assert.equal(forecast.points[1].dailyFixedCost, 100);
  assert.equal(forecast.points[1].total, 130200);
});

for (const [baseDate, monthEnd] of [["2027-02-01", "2027-02-28"], ["2028-02-01", "2028-02-29"], ["2026-04-01", "2026-04-30"]]) {
  test(`${monthEnd}が月末のとき、存在しない支払日を月末へ繰り上げる`, () => {
    const forecast = createAssetForecast(balances, [item(1000, 31, "lump_sum")], [], new Date(`${baseDate}T00:00:00+09:00`));
    assert.equal(pointAt(forecast, monthEnd).dailyFixedCost, 1000);
    assert.equal(forecast.points.reduce((sum, point) => sum + point.dailyFixedCost, 0), 1000);
  });
}

test("日本時間の当日分は再計上せず、90日間の各月の支払日に反映する", () => {
  const forecast = createAssetForecast(balances, [item(1000, 31, "lump_sum")], [], new Date("2026-01-30T16:00:00Z"), 90);
  assert.equal(forecast.baseDate, "2026-01-31");
  assert.equal(forecast.points.length, 90);
  assert.equal(forecast.points[0].date, "2026-02-01");
  assert.deepEqual(forecast.points.filter((point) => point.dailyFixedCost).map((point) => point.date), ["2026-02-28", "2026-03-31", "2026-04-30"]);
  assert.equal(forecast.points.at(-1).total, 97000);
});

test("反映方法のない旧固定費は日割りを引き継ぐ", () => {
  const forecast = createAssetForecast(balances, [{ amount: 30000, paymentDay: 15 }], [], new Date("2026-09-01T00:00:00+09:00"));
  assert.equal(forecast.points[0].dailyFixedCost, 1000);
  assert.equal(forecast.points[0].total, 99000);
});

test("丸め誤差を積み重ねず、日割り1か月で月額を差し引く", () => {
  const forecast = createAssetForecast(balances, [item(100, 1, "daily")], [], new Date("2026-03-31T00:00:00+09:00"));
  assert.equal(forecast.points.at(-1).total, 99900);
});

test("固定費で資産がマイナスになっても計算でき、空の一覧は残高を維持する", () => {
  const now = new Date("2026-09-14T00:00:00+09:00");
  assert.equal(createAssetForecast(balances, [item(150000, 15, "lump_sum")], [], now).points[0].total, -50000);
  assert.ok(createAssetForecast(balances, [], [], now).points.every((point) => point.total === 100000));
});

test("不正な固定費を日割りとして黙って扱わない", () => {
  for (const invalid of [item(-1, 15, "daily"), item(100, 32, "lump_sum"), item(100, 0, "daily"), item(100, 15, "invalid"), item(100, 15, null), item(1.5, 15, "daily")]) {
    assert.equal(createAssetForecast(balances, [invalid], []), null);
  }
  assert.equal(createAssetForecast(balances, [], [item(100, 15, undefined)]), null);
});
