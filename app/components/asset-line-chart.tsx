"use client";

import { useMemo } from "react";

export type AssetLinePoint = {
  date: string;
  total: number;
};

type AssetLineChartProps = {
  ariaLabel: string;
  points: AssetLinePoint[];
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

export default function AssetLineChart({ ariaLabel, points: sourcePoints }: AssetLineChartProps) {
  const chart = useMemo(() => {
    const width = 720;
    const height = 330;
    const margin = { top: 24, right: 24, bottom: 52, left: 76 };
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;
    const totals = sourcePoints.map((point) => point.total);
    const minimum = Math.min(...totals);
    const maximum = Math.max(...totals);
    const difference = maximum - minimum;
    const padding = difference > 0 ? difference * 0.12 : Math.max(Math.abs(maximum) * 0.08, 1);
    const lowerBound = minimum >= 0 ? Math.max(0, minimum - padding) : minimum - padding;
    const upperBound = maximum + padding;
    const range = Math.max(upperBound - lowerBound, 1);
    const xAt = (index: number) =>
      sourcePoints.length === 1
        ? margin.left + chartWidth / 2
        : margin.left + (index / (sourcePoints.length - 1)) * chartWidth;
    const yAt = (total: number) =>
      margin.top + ((upperBound - total) / range) * chartHeight;
    const points = sourcePoints.map((point, index) => ({
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
    const labelCount = Math.min(5, sourcePoints.length);
    const labelIndexes = Array.from(
      new Set(
        Array.from({ length: labelCount }, (_, index) =>
          Math.round((index / Math.max(labelCount - 1, 1)) * (sourcePoints.length - 1)),
        ),
      ),
    );

    return { width, height, margin, chartWidth, chartHeight, points, yTicks, labelIndexes };
  }, [sourcePoints]);

  return (
    <div className="asset-history-chart">
      <svg viewBox={`0 0 ${chart.width} ${chart.height}`} role="img" aria-label={ariaLabel}>
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
  );
}
