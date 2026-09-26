import Link from "next/link";
import type { RangeKey } from "./series";

const RANGES: Array<{ id: RangeKey; label: string }> = [
  { id: "7d", label: "Last 7 days" },
  { id: "30d", label: "Last 30 days" },
  { id: "90d", label: "Last 90 days" },
  { id: "custom", label: "Custom" },
];

export function WelcomeBanner({
  title,
  dateLabel,
  timeLabel,
  workspace,
  onTour,
  range,
  onRange,
}: {
  title: string;
  dateLabel: string;
  timeLabel: string;
  workspace: string;
  onTour: () => void;
  range: RangeKey;
  onRange: (range: RangeKey) => void;
}) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div data-tour="welcome" className="min-w-0">
        <h1 className="text-[32px] font-bold leading-none tracking-[-0.03em] text-[var(--app-ink)] sm:text-[36px]">{title}</h1>
        <p className="mt-2 text-[14px] text-[var(--app-muted)]">Here&apos;s what&apos;s happening with your business today.</p>
        <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-[var(--app-faint)]">
          <span>{dateLabel}</span>
          <span aria-hidden>·</span>
          <span>{timeLabel}</span>
          {workspace ? (
            <>
              <span aria-hidden>·</span>
              <Link href="/settings" className="font-medium text-[var(--app-ink)] hover:underline">
                {workspace}
              </Link>
            </>
          ) : null}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div role="radiogroup" aria-label="Revenue date range" className="flex flex-wrap items-center gap-1">
          {RANGES.map((item) => {
            const selected = range === item.id;
            return (
              <button
                key={item.id}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => onRange(item.id)}
                className={`h-9 rounded-full px-3 text-[13px] font-medium transition-colors duration-150 ${
                  selected
                    ? "border border-[var(--app-border)] bg-[var(--app-surface)] text-[var(--app-ink)] shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
                    : "text-[var(--app-muted)] hover:bg-[var(--app-surface)]"
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={onTour}
          className="inline-flex h-10 items-center rounded-full bg-[var(--app-nav-active-bg)] px-4 text-[13px] font-semibold text-[var(--app-nav-active)] shadow-[var(--app-shadow-xs)] transition-[opacity,transform] duration-160 hover:opacity-90 hover:scale-[1.01] active:scale-[0.98]"
        >
          Take the Tour
        </button>
      </div>
    </div>
  );
}
