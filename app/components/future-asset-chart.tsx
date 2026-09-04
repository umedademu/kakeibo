"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { AssetForecast, AssetForecastPoint } from "../lib/asset-forecast";
import AssetLineChart from "./asset-line-chart";

type ForecastResult = Partial<AssetForecast> & { error?: string };

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

export default function FutureAssetChart() {
  const [forecast, setForecast] = useState<AssetForecastPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadForecast() {
      try {
        const response = await fetch("/api/asset-forecast", { cache: "no-store" });
        const data = (await response.json().catch(() => null)) as ForecastResult | null;

        if (!response.ok || !data || !validPoints(data.points)) {
          throw new Error(data?.error ?? "未来の資産推移を計算できませんでした。");
        }

        if (active) {
          setForecast(data.points);
          setError("");
        }
      } catch (loadError) {
        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "未来の資産推移を計算できませんでした。",
          );
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    void loadForecast();
    window.addEventListener("kakeibo:balances-updated", loadForecast);

    return () => {
      active = false;
      window.removeEventListener("kakeibo:balances-updated", loadForecast);
    };
  }, []);

  return (
    <section className="asset-history-panel" aria-labelledby="future-asset-history-title">
      <header className="asset-history-header">
        <h2 id="future-asset-history-title">未来30日間の資産推移</h2>
        <Link className="forecast-table-link" href="/forecast">
          表で見る
          <span aria-hidden="true">→</span>
        </Link>
      </header>

      {isLoading ? (
        <p className="asset-history-state" role="status">
          計算しています…
        </p>
      ) : error ? (
        <p className="asset-history-state asset-history-error" role="alert">
          {error}
        </p>
      ) : (
        <AssetLineChart
          ariaLabel="未来30日間の予想資産を表す折れ線グラフ"
          points={forecast}
        />
      )}
    </section>
  );
}
