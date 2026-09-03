"use client";

import { useEffect, useMemo, useState } from "react";

type HistoryPoint = {
  date: string;
  total: number;
};

const moneyFormatter = new Intl.NumberFormat("ja-JP", {
  style: "currency",
  currency: "JPY",
  maximumFractionDigits: 0,
});

const compactNumberFormatter = new Intl.NumberFormat("ja-JP", {
  notation: "compact",
  maximumFractionDigits: 1,
});

function formatDate(date: string) {
  const [, month, day] = date.split("-");
  return `${Number(month)}/${Number(day)}`;
}

export default function AssetHistoryChart() {
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    async function loadHistory() {
      try {
        const response = await fetch("/api/asset-history", {
          cache: "no-store",
          signal: controller.signal,
        });
        const data = await response.json().catch(() => null);

        if (!response.ok || !Array.isArray(data)) {
          throw new Error(data?.error ?? "資産推移を取得できませんでした。");
        }

        setHistory(
          data.filter(
            (point): point is HistoryPoint =>
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
  }, []);

  const chart = useMemo(() => {
    if (history.length === 0) {
      return null;
    }

    const width = 720;
    const height = 390;
    const margin = { top: 24, right: 24, bottom: 52, left: 76 };
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;
    const totals = history.map((point) => point.total);
    const minimum = Math.min(...totals);
    const maximum = Math.max(...totals);
    const difference = maximum - minimum;
    const padding = difference > 0 ? difference * 0.12 : Math.max(maximum * 0.08, 1);
    const lowerBound = Math.max(0, minimum - padding);
    const upperBound = maximum + padding;
    const range = Math.max(upperBound - lowerBound, 1);
    const xAt = (index: number) =>
      history.length === 1
        ? margin.left + chartWidth / 2
        : margin.left + (index / (history.length - 1)) * chartWidth;
    const yAt = (total: number) =>
      margin.top + ((upperBound - total) / range) * chartHeight;
    const points = history.map((point, index) => ({
      ...point,
      x: xAt(index),
      y: yAt(point.total),
    }));
    const tickCount = 5;
    const yTicks = Array.from({ length: tickCount }, (_, index) => {
      const ratio = index / (tickCount - 1);
      return {
        y: margin.top + ratio * chartHeight,
        value: upperBound - ratio * range,
      };
    });
    const labelIndexes = Array.from(
      new Set(
        Array.from({ length: Math.min(5, history.length) }, (_, index) =>
          Math.round((index / Math.max(Math.min(5, history.length) - 1, 1)) * (history.length - 1)),
        ),
      ),
    );

    return { width, height, margin, chartWidth, chartHeight, points, yTicks, labelIndexes };
  }, [history]);

  return (
    <section className="asset-history-panel" aria-labelledby="asset-history-title">
      <header className="asset-history-header">
        <h2 id="asset-history-title">直近30日の資産推移</h2>
        <p>毎日午前4時に記録した総資産</p>
      </header>

      {isLoading ? (
        <p className="asset-history-state" role="status">
          読み込み中です…
        </p>
      ) : error ? (
        <p className="asset-history-state asset-history-error" role="alert">
          {error}
        </p>
      ) : !chart ? (
        <p className="asset-history-state">
          日別の記録がたまると、ここに推移を表示します。
        </p>
      ) : (
        <div className="asset-history-chart">
          <svg
            viewBox={`0 0 ${chart.width} ${chart.height}`}
            role="img"
            aria-label="直近30日の総資産を表す折れ線グラフ"
          >
            {chart.yTicks.map((tick) => (
              <g key={tick.y}>
                <line
                  className="chart-grid-line"
                  x1={chart.margin.left}
                  x2={chart.margin.left + chart.chartWidth}
                  y1={tick.y}
                  y2={tick.y}
                />
                <text className="chart-axis-label" x={chart.margin.left - 12} y={tick.y + 4}>
                  {compactNumberFormatter.format(Math.round(tick.value))}円
                </text>
              </g>
            ))}

            {chart.labelIndexes.map((index) => {
              const point = chart.points[index];
              return (
                <text
                  className="chart-date-label"
                  key={point.date}
                  x={point.x}
                  y={chart.margin.top + chart.chartHeight + 32}
                >
                  {formatDate(point.date)}
                </text>
              );
            })}

            {chart.points.length > 1 ? (
              <polyline
                className="chart-line"
                points={chart.points.map((point) => `${point.x},${point.y}`).join(" ")}
              />
            ) : null}

            {chart.points.map((point) => (
              <circle className="chart-point" cx={point.x} cy={point.y} key={point.date} r="4.5">
                <title>{`${point.date} ${moneyFormatter.format(point.total)}`}</title>
              </circle>
            ))}
          </svg>
        </div>
      )}
    </section>
  );
}
