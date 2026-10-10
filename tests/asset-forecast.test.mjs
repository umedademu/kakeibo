import assert from "node:assert/strict";
import test from "node:test";
import { createAssetForecast } from "../app/lib/asset-forecast.ts";
import { parseAssetPeriod } from "../app/lib/asset-period.ts";

const balances = [{ amount: 100000 }];
const item = (amount, paymentDay, accrualMethod, paidMonth) => ({ amount, paymentDay, accrualMethod, paidMonth });
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

test("支払済の当日分は再計上せず、90日間の各月の支払日に反映する", () => {
  const forecast = createAssetForecast(balances, [item(1000, 31, "lump_sum", "2026-01")], [], new Date("2026-01-30T16:00:00Z"), 90);
  assert.equal(forecast.baseDate, "2026-01-31");
  assert.equal(forecast.points.length, 90);
  assert.equal(forecast.points[0].date, "2026-02-01");
  assert.deepEqual(forecast.points.filter((point) => point.dailyFixedCost).map((point) => point.date), ["2026-02-28", "2026-03-31", "2026-04-30"]);
  assert.equal(forecast.points.at(-1).total, 97000);
});

for (const [days, lastDate, paymentCount] of [[180, "2028-03-28", 5], [360, "2028-09-24", 11]]) {
  test(`${days}日を選ぶと、年とうるう年の2月をまたいで収入と固定費を反映する`, () => {
    const forecast = createAssetForecast(
      balances,
      [item(1000, 31, "lump_sum", "2027-09")],
      [item(2000, 31, "lump_sum")],
      new Date("2027-09-30T00:00:00+09:00"),
      parseAssetPeriod(String(days)),
    );
    assert.equal(forecast.points.length, days);
    assert.equal(forecast.points[0].date, "2027-10-01");
    assert.equal(forecast.points.at(-1).date, lastDate);
    assert.equal(pointAt(forecast, "2028-02-28").dailyFixedCost, 0);
    assert.equal(pointAt(forecast, "2028-02-29").dailyFixedCost, 1000);
    assert.equal(pointAt(forecast, "2028-02-29").dailyIncome, 2000);
    assert.equal(forecast.points.reduce((sum, point) => sum + point.dailyFixedCost, 0), paymentCount * 1000);
    assert.equal(forecast.points.at(-1).total, 100000 + paymentCount * 1000);
  });
}

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

test("支払日前に支払済にした一括の固定費は、今月の支払日に差し引かず翌月から差し引く", () => {
  const forecast = createAssetForecast(balances, [item(30000, 28, "lump_sum", "2026-10")], [], new Date("2026-10-15T00:00:00+09:00"), 90);
  assert.equal(pointAt(forecast, "2026-10-28").dailyFixedCost, 0);
  assert.equal(pointAt(forecast, "2026-11-28").dailyFixedCost, 30000);
  assert.equal(pointAt(forecast, "2026-12-28").dailyFixedCost, 30000);
  assert.equal(forecast.points.at(-1).total, 40000);
});

test("支払日を迎えても未払の一括固定費は、翌日にまとめて差し引き、翌月は支払日に差し引く", () => {
  const forecast = createAssetForecast(
    balances,
    [item(30000, 5, "lump_sum"), item(20000, 11, "lump_sum", "2026-09"), item(5000, 3, "lump_sum", "2026-10")],
    [],
    new Date("2026-10-11T00:00:00+09:00"),
    90,
  );
  assert.equal(forecast.points[0].date, "2026-10-12");
  assert.equal(forecast.points[0].dailyFixedCost, 50000);
  assert.equal(forecast.points[0].total, 50000);
  assert.equal(pointAt(forecast, "2026-11-03").dailyFixedCost, 5000);
  assert.equal(pointAt(forecast, "2026-11-05").dailyFixedCost, 30000);
  assert.equal(pointAt(forecast, "2026-11-11").dailyFixedCost, 20000);
  assert.equal(forecast.points.at(-1).total, -95000);
});

test("月末日の未払は翌月1日に差し引き、存在しない支払日は月末を過ぎた扱いにする", () => {
  const forecast = createAssetForecast(balances, [item(1000, 31, "lump_sum")], [], new Date("2026-09-30T00:00:00+09:00"), 90);
  assert.equal(forecast.points[0].date, "2026-10-01");
  assert.equal(forecast.points[0].dailyFixedCost, 1000);
  assert.equal(pointAt(forecast, "2026-10-31").dailyFixedCost, 1000);
  assert.equal(pointAt(forecast, "2026-11-30").dailyFixedCost, 1000);
  assert.equal(forecast.points.at(-1).total, 97000);
});

test("日割りの固定費と収入は支払済の記録に影響されず、不正な支払済の月は受け付けない", () => {
  const forecast = createAssetForecast(balances, [item(3000, 1, "daily", "2026-09")], [item(3000, 1, "daily")], new Date("2026-09-14T00:00:00+09:00"));
  assert.equal(forecast.points[0].dailyFixedCost, 100);
  assert.equal(forecast.points[0].total, 100000);
  for (const paidMonth of ["2026-13", "2026-9", 202609, ""]) {
    assert.equal(createAssetForecast(balances, [item(1000, 1, "lump_sum", paidMonth)], []), null);
  }
});
