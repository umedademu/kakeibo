"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { AssetPeriodDays } from "../lib/asset-period";
import AssetLineChart, { AssetLinePoint } from "./asset-line-chart";
import { AssetPeriodButtons } from "./asset-period-switch";

export default function AssetHistoryChart() {
  const [days, setDays] = useState<AssetPeriodDays>(30);
  const [history, setHistory] = useState<AssetLinePoint[]>([]);
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

        setHistory(
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

  function changeDays(nextDays: AssetPeriodDays) {
    if (nextDays === days) {
      return;
    }

    setIsLoading(true);
    setError("");
    setDays(nextDays);
  }

  return (
    <section className="asset-history-panel" aria-labelledby="past-asset-history-title">
      <header className="asset-history-header">
        <h2 id="past-asset-history-title">過去{days}日間の資産推移</h2>
        <div className="asset-history-actions">
          <AssetPeriodButtons days={days} label="過去の表示期間" onChange={changeDays} />
          <Link className="forecast-table-link" href={`/history?days=${days}`}>
            表で見る
            <span aria-hidden="true">→</span>
          </Link>
        </div>
      </header>

      {isLoading ? (
        <p className="asset-history-state" role="status">
          読み込み中です…
        </p>
      ) : error ? (
        <p className="asset-history-state asset-history-error" role="alert">
          {error}
        </p>
      ) : history.length === 0 ? (
        <p className="asset-history-state">
          日別の記録がたまると、ここに推移を表示します。
        </p>
      ) : (
        <AssetLineChart
          ariaLabel={`過去${days}日間の総資産を表す折れ線グラフ`}
          points={history}
        />
      )}
    </section>
  );
}
