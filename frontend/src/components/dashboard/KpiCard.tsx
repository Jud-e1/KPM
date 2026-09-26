import type { ComponentType } from "react";

export type KpiTone = "blue" | "orange" | "violet" | "slate";

const fills: Record<KpiTone, string> = {
  blue: "#4c8dff",
  orange: "#ff9f2f",
  violet: "#34d399",
  slate: "#93c5fd",
};

export function KpiCard({
  label,
  value,
  delta,
  hint,
  sparkline = [],
  warning = false,
  tone = "blue",
  meter,
}: {
  icon?: ComponentType<{ className?: string }>;
  label: string;
  value: string;
  delta: number | null;
  hint: string;
  sparkline?: number[];
  warning?: boolean;
  tone?: KpiTone;
  meter?: number;
}) {
  const peak = Math.max(...sparkline, 0);
  const latest = sparkline.length ? sparkline[sparkline.length - 1] : 0;
  const derived = peak <= 0 ? 0 : Math.round((latest / peak) * 100);
  const width = Math.max(0, Math.min(100, meter ?? derived));
  const fill = warning ? "#e11d48" : fills[tone];
  const deltaClass =
    delta == null || delta === 0
      ? "text-[var(--app-muted)]"
      : delta > 0
        ? "text-[var(--app-accent)]"
        : "text-[var(--app-critical)]";

  return (
    <article className="min-w-0 px-5 py-4 sm:px-6 sm:py-5">
      <p className="text-[13px] font-medium text-[var(--app-muted)]">{label}</p>
      <p className={`mt-2 text-[30px] font-bold leading-none tracking-[-0.03em] tabular-nums ${warning ? "text-[#e11d48]" : "text-[var(--app-ink)]"}`}>
        {value}
      </p>
      <p className="mt-2 min-h-4 text-[12px] leading-4">
        {delta != null ? (
          <span className={`font-semibold tabular-nums ${deltaClass}`}>
            {delta > 0 ? "+" : ""}
            {delta}%
          </span>
        ) : null}
        <span className="text-[var(--app-faint)]">{delta != null ? ` ${hint}` : hint}</span>
      </p>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#eef2f7]" aria-hidden>
        <div className="kpm-meter h-full rounded-full" style={{ width: `${width}%`, background: fill }} />
      </div>
    </article>
  );
}
