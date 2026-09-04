"use client";

import { useEffect, useState } from "react";
import type { AssetForecast, AssetForecastPoint } from "../lib/asset-forecast";

type ForecastResult = Partial<AssetForecast> & { error?: string };

const moneyFormatter = new Intl.NumberFormat("ja-JP", {
  style: "currency",
  currency: "JPY",
  maximumFractionDigits: 0,
});

const dateFormatter = new Intl.DateTimeFormat("ja-JP", {
  month: "numeric",
  day: "numeric",
  weekday: "short",
  timeZone: "UTC",
});

function formatDate(date: string) {
  return dateFormatter.format(new Date(`${date}T00:00:00Z`));
}

function validPoints(value: unknown): value is AssetForecastPoint[] {
  return (
    Array.isArray(value) &&
    value.every(
      (point) =>
        typeof point?.date === "string" &&
        Number.isFinite(point?.dailyIncome) &&
        Number.isFinite(point?.dailyFixedCost) &&
        Number.isFinite(point?.total),
    )
  );
}

export default function ForecastTable() {
  const [points, setPoints] = useState<AssetForecastPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    async function loadForecast() {
      try {
        const response = await fetch("/api/asset-forecast", {
          cache: "no-store",
          signal: controller.signal,
        });
        const data = (await response.json().catch(() => null)) as ForecastResult | null;

        if (!response.ok || !data || !validPoints(data.points)) {
          throw new Error(data?.error ?? "未来の資産推移を計算できませんでした。");
        }

        setPoints(data.points);
      } catch (loadError) {
        if (loadError instanceof Error && loadError.name !== "AbortError") {
          setError(loadError.message);
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    void loadForecast();
    return () => controller.abort();
  }, []);

  if (isLoading) {
    return <p className="forecast-message">計算しています…</p>;
  }

  if (error) {
    return (
      <p className="forecast-message asset-history-error" role="alert">
        {error}
      </p>
    );
  }

  return (
    <div className="forecast-table-wrapper">
      <table className="forecast-table">
        <thead>
          <tr>
            <th scope="col">日付</th>
            <th scope="col">1日分の収入</th>
            <th scope="col">1日分の固定費</th>
            <th scope="col">予想資産</th>
          </tr>
        </thead>
        <tbody>
          {points.map((point) => (
            <tr key={point.date}>
              <th scope="row">{formatDate(point.date)}</th>
              <td>＋{moneyFormatter.format(point.dailyIncome)}</td>
              <td>−{moneyFormatter.format(point.dailyFixedCost)}</td>
              <td>{moneyFormatter.format(point.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
