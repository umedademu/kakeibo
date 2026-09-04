import type { AssetPeriodDays } from "./asset-period";

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

type IncomeForecastItem = {
  amount: number;
  paymentDay: number;
  accrualMethod: "lump_sum" | "daily";
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

function readIncomes(items: unknown) {
  if (!Array.isArray(items)) {
    return null;
  }

  const incomes: IncomeForecastItem[] = [];
  for (const item of items) {
    if (!item || typeof item !== "object") {
      return null;
    }

    const { amount, paymentDay, accrualMethod } = item as {
      amount?: unknown;
      paymentDay?: unknown;
      accrualMethod?: unknown;
    };
    if (
      !Number.isSafeInteger(amount) ||
      (amount as number) < 0 ||
      !Number.isInteger(paymentDay) ||
      (paymentDay as number) < 1 ||
      (paymentDay as number) > 31 ||
      (accrualMethod !== "lump_sum" && accrualMethod !== "daily")
    ) {
      return null;
    }

    incomes.push({
      amount: amount as number,
      paymentDay: paymentDay as number,
      accrualMethod,
    });
  }

  return incomes;
}

export function createAssetForecast(
  balances: unknown,
  fixedCosts: unknown,
  incomes: unknown,
  now = new Date(),
  days: AssetPeriodDays = 30,
): AssetForecast | null {
  const balanceAmounts = readAmounts(balances);
  const fixedCostAmounts = readAmounts(fixedCosts);
  const incomeItems = readIncomes(incomes);

  if (!balanceAmounts || !fixedCostAmounts || !incomeItems) {
    return null;
  }

  const currentTotal = balanceAmounts.reduce((total, amount) => total + amount, 0);
  const monthlyFixedCost = fixedCostAmounts.reduce((total, amount) => total + amount, 0);
  const monthlyIncome = incomeItems.reduce((total, item) => total + item.amount, 0);
  const baseDate = currentDateInJapan(now);
  const points: AssetForecastPoint[] = [];
  let runningTotal = currentTotal;

  for (let day = 1; day <= days; day += 1) {
    const forecastDate = addDays(baseDate, day);
    const monthDays = daysInMonth(forecastDate);
    const dailyFixedCost = monthlyFixedCost / monthDays;
    const dailyIncome = incomeItems.reduce((total, item) => {
      if (item.accrualMethod === "daily") {
        return total + item.amount / monthDays;
      }

      const effectivePaymentDay = Math.min(item.paymentDay, monthDays);
      return forecastDate.getUTCDate() === effectivePaymentDay ? total + item.amount : total;
    }, 0);
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
