"use client";

import Link from "next/link";
import { useId } from "react";
import { Card, CardHeader } from "./Card";
import { compactCurrency, formatCurrency } from "./format";

export type PerformanceTab = "sales" | "inventory" | "accounting";

export type BarPoint = { label: string; value: number };

export function BusinessPerformance({
  tab,
  onTab,
  valueLabel,
  value,
  delta,
  bars,
  href,
}: {
  tab: PerformanceTab;
  onTab: (tab: PerformanceTab) => void;
  valueLabel: string;
  value: string;
  delta: number | null;
  bars: BarPoint[];
  href: string;
}) {
  const tabs: Array<{ id: PerformanceTab; label: string }> = [
    { id: "sales", label: "Sales" },
    { id: "inventory", label: "Inventory" },
    { id: "accounting", label: "Accounting" },
  ];
  const hasValue = bars.some((bar) => bar.value > 0);
  const max = Math.max(...bars.map((bar) => bar.value), 1);
  const gradientId = useId().replace(/:/g, "");

  return (
    <Card className="p-4 sm:p-5">
      <CardHeader
        title="Business Performance"
        action={
          <Link href={href} className="text-[12.5px] font-medium text-[var(--app-muted)] hover:text-[var(--app-ink)]">
            View Report →
          </Link>
        }
      />
      <div role="tablist" aria-label="Business performance" className="mt-3 flex gap-1 rounded-lg bg-[var(--app-hover)] p-1">
        {tabs.map((item) => {
          const selected = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => onTab(item.id)}
              className={`h-8 flex-1 rounded-md text-[12.5px] font-medium transition-colors duration-150 ${
                selected ? "bg-[var(--app-surface)] text-[var(--app-ink)] shadow-[0_1px_2px_rgba(18,20,23,0.06)]" : "text-[var(--app-muted)]"
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>
      <p className="mt-4 text-[12px] text-[var(--app-muted)]">{valueLabel}</p>
      <div className="mt-1 flex items-baseline gap-2">
        <p className="text-[26px] font-bold leading-none tracking-tight tabular-nums text-[var(--app-ink)]">{value}</p>
        {delta != null ? (
          <span className={`text-[12px] font-semibold tabular-nums ${delta < 0 ? "text-[var(--app-critical)]" : "text-[var(--app-accent)]"}`}>
            {delta > 0 ? "+" : ""}
            {delta}%
          </span>
        ) : null}
      </div>
      {hasValue ? (
        <svg viewBox="0 0 320 120" className="mt-3 h-28 w-full" role="img" aria-label={`${tab} performance`}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#5d6fd0" />
              <stop offset="100%" stopColor="#d5dcf5" />
            </linearGradient>
          </defs>
          {bars.map((bar, index) => {
            const slot = 320 / bars.length;
            const barWidth = Math.min(28, slot * 0.55);
            const height = Math.max(2, (bar.value / max) * 78);
            const x = index * slot + (slot - barWidth) / 2;
            const y = 86 - height;
            return (
              <g key={`${bar.label}-${index}`}>
                <rect className="kpm-bar" style={{ animationDelay: `${index * 40}ms` }} x={x} y={y} width={barWidth} height={height} rx="6" fill={`url(#${gradientId})`} />
                <text x={x + barWidth / 2} y="108" textAnchor="middle" fill="#8b939e" fontSize="10">
                  {bar.label}
                </text>
              </g>
            );
          })}
        </svg>
      ) : (
        <svg viewBox="0 0 320 120" className="mt-3 h-28 w-full" role="img" aria-label={`${tab} performance, no activity yet`}>
          <line x1="8" x2="312" y1="86" y2="86" stroke="#e6e8ee" />
          {bars.map((bar, index) => {
            const slot = 320 / Math.max(bars.length, 1);
            const x = index * slot + slot / 2;
            return (
              <text key={`${bar.label}-${index}`} x={x} y="108" textAnchor="middle" fill="#8b939e" fontSize="10">
                {bar.label}
              </text>
            );
          })}
        </svg>
      )}
      {hasValue ? (
        <p className="sr-only">
          {bars.map((bar) => `${bar.label} ${formatCurrency(bar.value)}`).join(", ")} {compactCurrency(max)} peak
        </p>
      ) : (
        <p className="sr-only">No {tab} activity recorded.</p>
      )}
    </Card>
  );
}
