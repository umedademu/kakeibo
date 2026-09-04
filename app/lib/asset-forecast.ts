export type AssetForecastPoint = {
  date: string;
  dailyIncome: number;
  dailyFixedCost: number;
  total: number;
};

export type AssetForecast = {
  baseDate: string;
  currentTotal: number;
  monthlyIncome: number;
  monthlyFixedCost: number;
  points: AssetForecastPoint[];
};

function currentDateInJapan(now: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function addDays(date: string, days: number) {
  const result = new Date(`${date}T00:00:00Z`);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function daysInMonth(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
}

function readAmounts(items: unknown) {
  if (!Array.isArray(items)) {
    return null;
  }

  const amounts: number[] = [];
  for (const item of items) {
    const amount =
      item && typeof item === "object" ? (item as { amount?: unknown }).amount : undefined;
    if (!Number.isSafeInteger(amount) || (amount as number) < 0) {
      return null;
    }
    amounts.push(amount as number);
  }
  return amounts;
}

export function createAssetForecast(
  balances: unknown,
  fixedCosts: unknown,
  incomes: unknown,
  now = new Date(),
): AssetForecast | null {
  const balanceAmounts = readAmounts(balances);
  const fixedCostAmounts = readAmounts(fixedCosts);
  const incomeAmounts = readAmounts(incomes);

  if (!balanceAmounts || !fixedCostAmounts || !incomeAmounts) {
    return null;
  }

  const currentTotal = balanceAmounts.reduce((total, amount) => total + amount, 0);
  const monthlyFixedCost = fixedCostAmounts.reduce((total, amount) => total + amount, 0);
  const monthlyIncome = incomeAmounts.reduce((total, amount) => total + amount, 0);
  const baseDate = currentDateInJapan(now);
  const points: AssetForecastPoint[] = [];
  let runningTotal = currentTotal;

  for (let day = 1; day <= 30; day += 1) {
    const forecastDate = addDays(baseDate, day);
    const dailyFixedCost = monthlyFixedCost / daysInMonth(forecastDate);
    const dailyIncome = monthlyIncome / daysInMonth(forecastDate);
    runningTotal += dailyIncome - dailyFixedCost;
    points.push({
      date: forecastDate.toISOString().slice(0, 10),
      dailyIncome: Math.round(dailyIncome),
      dailyFixedCost: Math.round(dailyFixedCost),
      total: Math.round(runningTotal),
    });
  }

  return { baseDate, currentTotal, monthlyIncome, monthlyFixedCost, points };
}
