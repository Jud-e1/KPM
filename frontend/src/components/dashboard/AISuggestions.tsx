"use client";

import Link from "next/link";
import { Card, CardHeader } from "./Card";
import { SectionError } from "./SectionError";

export type SuggestionCard = {
  id: string;
  eyebrow: string;
  body: string;
  action: string;
  href?: string;
  onClick?: () => void;
  busy?: boolean;
};

export function AISuggestions({
  items,
  loading,
  error,
  onRetry,
}: {
  items: SuggestionCard[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}) {
  return (
    <Card className="p-4 sm:p-5">
      <CardHeader
        title="AI Suggestions"
        action={
          <Link href="/insights" className="text-[12.5px] font-medium text-[var(--app-muted)] hover:text-[var(--app-ink)]">
            View all
          </Link>
        }
      />
      {loading ? (
        <div className="mt-3 space-y-2" aria-hidden>
          <div className="h-16 animate-pulse rounded-lg bg-[var(--app-hover)]" />
          <div className="h-16 animate-pulse rounded-lg bg-[var(--app-hover)]" />
        </div>
      ) : error && items.length === 0 ? (
        <div className="mt-3">
          <SectionError onRetry={onRetry} />
        </div>
      ) : items.length === 0 ? (
        <p className="mt-3 text-[13px] leading-5 text-[var(--app-muted)]">
          Recommendations appear when stock, pricing, or orders need a decision.
        </p>
      ) : (
        <ul className="mt-3 space-y-2.5">
          {items.map((item) => (
            <li key={item.id} className="rounded-xl border border-[var(--app-border)] px-3 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--app-faint)]">{item.eyebrow}</p>
              <p className="mt-1 text-[13px] leading-5 text-[var(--app-ink)]">{item.body}</p>
              {item.href ? (
                <Link href={item.href} className="mt-2 inline-flex text-[12.5px] font-semibold text-[var(--app-accent)] hover:underline">
                  {item.action}
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={item.onClick}
                  disabled={item.busy}
                  className="mt-2 inline-flex text-[12.5px] font-semibold text-[var(--app-accent)] hover:underline disabled:opacity-50"
                >
                  {item.busy ? "Working…" : item.action}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
