"use client";

import { useId, useMemo, useState } from "react";
import { compactCurrency, formatCurrency } from "./format";
import type { RangeKey, SeriesPoint } from "./series";
import { rangeLabel } from "./series";
import { Card, CardHeader } from "./Card";

export function RevenueChart({
  points,
  counts = [],
  range,
  customStart,
  customEnd,
  onCustomStart,
  onCustomEnd,
}: {
  points: SeriesPoint[];
  counts?: number[];
  range: RangeKey;
  onRange: (range: RangeKey) => void;
  customStart: string;
  customEnd: string;
  onCustomStart: (value: string) => void;
  onCustomEnd: (value: string) => void;
}) {
  const gradientId = useId().replace(/:/g, "");
  const [hover, setHover] = useState<number | null>(null);
  const hasValue = points.some((point) => point.value > 0) || counts.some((count) => count > 0);

  const geometry = useMemo(() => {
    const width = 640;
    const height = 280;
    const pad = { left: 44, right: 8, top: 12, bottom: 28 };
    const innerW = width - pad.left - pad.right;
    const innerH = height - pad.top - pad.bottom;
    const revenueMax = niceMax(Math.max(...points.map((point) => point.value), 0));
    const countMax = niceMax(Math.max(...counts, 0));
    const slot = points.length ? innerW / points.length : innerW;
    const barW = Math.max(3, Math.min(14, slot * 0.28));
    const baseline = pad.top + innerH;
    const coords = points.map((point, index) => {
      const count = counts[index] ?? 0;
      const revenueH = point.value > 0 ? (point.value / revenueMax) * innerH : 0;
      const countH = count > 0 ? (count / countMax) * innerH : 0;
      const pair = barW * 2 + 3;
      const origin = pad.left + index * slot + (slot - pair) / 2;
      return { ...point, count, origin, barW, revenueH, countH, baseline };
    });
    return { width, height, pad, innerW, innerH, revenueMax, coords, baseline };
  }, [points, counts]);

  const active = hover != null ? geometry.coords[hover] : null;
  const ticks = hasValue ? [geometry.revenueMax, geometry.revenueMax / 2, 0] : [0];
  const labelStep = Math.max(1, Math.ceil(points.length / 6));

  const move = (clientX: number, bounds: DOMRect) => {
    if (!geometry.coords.length) return;
    const ratio = (clientX - bounds.left) / bounds.width;
    const x = ratio * geometry.width;
    let nearest = 0;
    let best = Number.POSITIVE_INFINITY;
    geometry.coords.forEach((point, index) => {
      const distance = Math.abs(point.origin - x);
      if (distance < best) {
        best = distance;
        nearest = index;
      }
    });
    setHover(nearest);
  };

  return (
    <Card className="p-4 sm:p-5">
      <CardHeader
        title="Revenue Overview"
        subtitle={`Your sales revenue for ${rangeLabel(range)}.`}
        action={
          <div className="flex items-center gap-3 text-[12px] text-[var(--app-muted)]">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[#4c8dff]" /> Revenue
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[#ff9f2f]" /> Orders
            </span>
          </div>
        }
      />

      {range === "custom" ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <label className="text-[12px] text-[var(--app-muted)]">
            From
            <input
              type="date"
              value={customStart}
              onChange={(event) => onCustomStart(event.target.value)}
              className="ml-2 h-8 rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-2 text-[12px] text-[var(--app-ink)]"
            />
          </label>
          <label className="text-[12px] text-[var(--app-muted)]">
            To
            <input
              type="date"
              value={customEnd}
              onChange={(event) => onCustomEnd(event.target.value)}
              className="ml-2 h-8 rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-2 text-[12px] text-[var(--app-ink)]"
            />
          </label>
        </div>
      ) : null}

      <div className="relative mt-4">
        <svg
          viewBox={`0 0 ${geometry.width} ${geometry.height}`}
          className="h-64 w-full sm:h-72"
          role="img"
          aria-label={hasValue ? "Sales revenue chart" : "Sales revenue chart with no recorded sales"}
          onMouseLeave={() => setHover(null)}
          onMouseMove={(event) => move(event.clientX, event.currentTarget.getBoundingClientRect())}
        >
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#4c7dff" />
                <stop offset="100%" stopColor="#8eb0ff" />
              </linearGradient>
              <pattern id={`${gradientId}-stripe`} width="10" height="10" patternUnits="userSpaceOnUse">
                <rect width="10" height="10" fill="#fbfcfe" />
                <rect width="5" height="10" fill="#f4f6fb" />
              </pattern>
            </defs>
            <rect
              x={geometry.pad.left}
              y={geometry.pad.top}
              width={geometry.innerW}
              height={geometry.innerH}
              fill={`url(#${gradientId}-stripe)`}
              rx="8"
            />
            {ticks.map((tick) => {
              const y = geometry.pad.top + (1 - (geometry.revenueMax > 0 ? tick / geometry.revenueMax : 0)) * geometry.innerH;
              return (
                <g key={tick}>
                  <line x1={geometry.pad.left} x2={geometry.width - geometry.pad.right} y1={y} y2={y} stroke="#e7eaf0" />
                  <text x={geometry.pad.left - 8} y={y + 4} textAnchor="end" fill="#94a3b8" fontSize="11">
                    {compactCurrency(tick)}
                  </text>
                </g>
              );
            })}
            {geometry.coords.map((point, index) => {
              const hot = hover === index;
              return (
                <g key={point.sort}>
                  {point.revenueH > 0 ? (
                    <rect
                      className="kpm-bar"
                      style={{ animationDelay: `${Math.min(index, 18) * 18}ms` }}
                      x={point.origin}
                      y={point.baseline - point.revenueH}
                      width={point.barW}
                      height={point.revenueH}
                      rx={Math.min(7, point.barW / 2)}
                      fill={hot ? "#2563eb" : "#4c8dff"}
                    />
                  ) : null}
                  {point.countH > 0 ? (
                    <rect
                      className="kpm-bar"
                      style={{ animationDelay: `${Math.min(index, 18) * 18 + 40}ms` }}
                      x={point.origin + point.barW + 3}
                      y={point.baseline - point.countH}
                      width={point.barW}
                      height={point.countH}
                      rx={Math.min(7, point.barW / 2)}
                      fill={hot ? "#f97316" : "#ff9f2f"}
                    />
                  ) : null}
                </g>
              );
            })}
            {geometry.coords.map((point, index) =>
              index % labelStep === 0 || index === geometry.coords.length - 1 ? (
                <text key={`${point.sort}-label`} x={point.origin + point.barW} y={geometry.height - 8} textAnchor="middle" fill="#94a3b8" fontSize="11">
                  {point.label}
                </text>
              ) : null
            )}
        </svg>
        {!hasValue ? (
          <p className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-[12.5px] text-[var(--app-muted)]">
            No sales recorded yet
          </p>
        ) : null}
        {active && hasValue ? (
          <div className="pointer-events-none absolute left-14 top-3 rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-2.5 py-1.5 text-[12px] shadow-[var(--app-shadow-pop)]">
            <div className="font-medium text-[var(--app-muted)]">{active.label}</div>
            <div className="font-semibold tabular-nums text-[var(--app-ink)]">{formatCurrency(active.value)}</div>
            <div className="text-[var(--app-muted)]">{active.count.toLocaleString()} orders</div>
          </div>
        ) : null}
      </div>
      {points.length > 0 ? (
        <table className="sr-only">
          <caption>Revenue by day</caption>
          <tbody>
            {points.map((point) => (
              <tr key={point.sort}>
                <th scope="row">{point.label}</th>
                <td>{formatCurrency(point.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </Card>
  );
}

function niceMax(max: number) {
  if (max <= 0) return 1;
  const power = Math.pow(10, Math.floor(Math.log10(max)));
  const normalized = max / power;
  const nice = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return nice * power;
}

