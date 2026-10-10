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

type RecurringForecastItem = {
  amount: number;
  paymentDay: number;
  accrualMethod: "lump_sum" | "daily";
  paidMonth: string | null;
};

const monthPattern = /^\d{4}-(0[1-9]|1[0-2])$/;

export function isPaidMonth(value: unknown): value is string {
  return typeof value === "string" && monthPattern.test(value);
}

export function currentDateInJapan(now = new Date()) {
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

function readRecurringItems(items: unknown, fallbackMethod?: "daily") {
  if (!Array.isArray(items)) {
    return null;
  }

  const recurringItems: RecurringForecastItem[] = [];
  for (const item of items) {
    if (!item || typeof item !== "object") {
      return null;
    }

    const { amount, paymentDay, accrualMethod, paidMonth } = item as {
      amount?: unknown;
      paymentDay?: unknown;
      accrualMethod?: unknown;
      paidMonth?: unknown;
    };
    // 更新前の固定費は、従来どおり日割りとして扱います。
    const method = accrualMethod === undefined ? fallbackMethod : accrualMethod;
    if (
      !Number.isSafeInteger(amount) ||
      (amount as number) < 0 ||
      !Number.isInteger(paymentDay) ||
      (paymentDay as number) < 1 ||
      (paymentDay as number) > 31 ||
      (method !== "lump_sum" && method !== "daily") ||
      (paidMonth !== undefined && paidMonth !== null && !isPaidMonth(paidMonth))
    ) {
      return null;
    }

    recurringItems.push({
      amount: amount as number,
      paymentDay: paymentDay as number,
      accrualMethod: method,
      paidMonth: isPaidMonth(paidMonth) ? paidMonth : null,
    });
  }

  return recurringItems;
}

function amountForDay(
  items: RecurringForecastItem[],
  month: string,
  day: number,
  monthDays: number,
) {
  return items.reduce((total, item) => {
    if (item.accrualMethod === "daily") {
      return total + item.amount / monthDays;
    }

    // 支払済にした月の分は、支払日を迎えても重ねて差し引きません。
    if (item.paidMonth === month) {
      return total;
    }

    const effectivePaymentDay = Math.min(item.paymentDay, monthDays);
    return day === effectivePaymentDay ? total + item.amount : total;
  }, 0);
}

export function createAssetForecast(
  balances: unknown,
  fixedCosts: unknown,
  incomes: unknown,
  now = new Date(),
  days: AssetPeriodDays = 30,
): AssetForecast | null {
  const balanceAmounts = readAmounts(balances);
  const fixedCostItems = readRecurringItems(fixedCosts, "daily");
  const incomeItems = readRecurringItems(incomes);

  if (!balanceAmounts || !fixedCostItems || !incomeItems) {
    return null;
  }

  const currentTotal = balanceAmounts.reduce((total, amount) => total + amount, 0);
  const monthlyFixedCost = fixedCostItems.reduce((total, item) => total + item.amount, 0);
  const monthlyIncome = incomeItems.reduce((total, item) => total + item.amount, 0);
  const baseDate = currentDateInJapan(now);
  const baseMonth = baseDate.slice(0, 7);
  const baseDay = Number(baseDate.slice(8));
  const baseMonthDays = daysInMonth(new Date(`${baseDate}T00:00:00Z`));
  // 今月の支払日を迎えても未払の一括固定費は、まだ残高から減っていないため翌日に差し引きます。
  const overdueFixedCost = fixedCostItems.reduce(
    (total, item) =>
      item.accrualMethod === "lump_sum" &&
      item.paidMonth !== baseMonth &&
      Math.min(item.paymentDay, baseMonthDays) <= baseDay
        ? total + item.amount
        : total,
    0,
  );
  const points: AssetForecastPoint[] = [];
  let runningTotal = currentTotal;

  for (let day = 1; day <= days; day += 1) {
    const forecastDate = addDays(baseDate, day);
    const monthDays = daysInMonth(forecastDate);
    const dayOfMonth = forecastDate.getUTCDate();
    const forecastMonth = forecastDate.toISOString().slice(0, 7);
    const dailyFixedCost =
      amountForDay(fixedCostItems, forecastMonth, dayOfMonth, monthDays) +
      (day === 1 ? overdueFixedCost : 0);
    const dailyIncome = amountForDay(incomeItems, forecastMonth, dayOfMonth, monthDays);
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
