"use client";

import { useEffect, useState } from "react";
import type { AssetPeriodDays } from "../lib/asset-period";
import type { AssetLinePoint } from "./asset-line-chart";

const moneyFormatter = new Intl.NumberFormat("ja-JP", {
  style: "currency",
  currency: "JPY",
  maximumFractionDigits: 0,
});

const dateFormatter = new Intl.DateTimeFormat("ja-JP", {
  year: "numeric",
  month: "numeric",
  day: "numeric",
  weekday: "short",
  timeZone: "UTC",
});

function formatDate(date: string) {
  return dateFormatter.format(new Date(`${date}T00:00:00Z`));
}

export default function AssetHistoryTable({ days }: { days: AssetPeriodDays }) {
  const [points, setPoints] = useState<AssetLinePoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    async function loadHistory() {
      try {
        const response = await fetch(`/api/asset-history?days=${days}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const data = await response.json().catch(() => null);

        if (!response.ok || !Array.isArray(data)) {
          throw new Error(data?.error ?? "資産推移を取得できませんでした。");
        }

        setPoints(
          data.filter(
            (point): point is AssetLinePoint =>
              typeof point?.date === "string" && Number.isFinite(point?.total),
          ),
        );
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

    void loadHistory();
    return () => controller.abort();
  }, [days]);

  if (isLoading) {
    return <p className="forecast-message">読み込み中です…</p>;
  }

  if (error) {
    return (
      <p className="forecast-message asset-history-error" role="alert">
        {error}
      </p>
    );
  }

  if (points.length === 0) {
    return <p className="forecast-message">日別の記録がたまると、ここに表示します。</p>;
  }

  return (
    <div className="forecast-table-wrapper">
      <table className="forecast-table asset-history-table">
        <thead>
          <tr>
            <th scope="col">日付</th>
            <th scope="col">総資産</th>
          </tr>
        </thead>
        <tbody>
          {points.map((point) => (
            <tr key={point.date}>
              <th scope="row">{formatDate(point.date)}</th>
              <td>{moneyFormatter.format(point.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
