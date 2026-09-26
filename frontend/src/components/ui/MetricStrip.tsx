import Link from "next/link";

export type MetricItem = {
  label: string;
  value: string;
  hint?: string;
  href?: string;
};

export function MetricStrip({ items, columns = 4 }: { items: MetricItem[]; columns?: 3 | 4 | 5 }) {
  const cols = columns === 5 ? "lg:grid-cols-5" : columns === 3 ? "lg:grid-cols-3" : "lg:grid-cols-4";
  return (
    <section
      className={`grid grid-cols-2 ${cols} overflow-hidden rounded-[var(--app-radius)] border border-[var(--app-border)] bg-[var(--app-surface)] divide-x divide-y lg:divide-y-0 divide-[var(--app-border)] shadow-[var(--app-shadow-xs)]`}
    >
      {items.map((item) => {
        const body = (
          <>
            <div className="text-[22px] font-semibold tabular-nums tracking-[-0.02em] text-[var(--app-ink)] leading-none">
              {item.value}
            </div>
            <div className="mt-1.5 text-xs font-medium text-[var(--app-muted)]">{item.label}</div>
            {item.hint ? <div className="mt-0.5 text-xs text-[var(--app-faint)]">{item.hint}</div> : null}
          </>
        );
        return item.href ? (
          <Link
            key={item.label}
            href={item.href}
            className="block px-4 py-3.5 hover:bg-[var(--app-hover)] transition-colors duration-160"
          >
            {body}
          </Link>
        ) : (
          <div key={item.label} className="px-4 py-3.5">
            {body}
          </div>
        );
      })}
    </section>
  );
}
