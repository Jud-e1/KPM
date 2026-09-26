type PagerProps = {
  page: number;
  totalPages: number;
  onPage: (next: number) => void;
  summary: string;
};

export function Pager({ page, totalPages, onPage, summary }: PagerProps) {
  const safeTotal = Math.max(totalPages, 1);
  const pages = Array.from({ length: Math.min(5, safeTotal) }, (_, index) => index + 1);
  const control =
    "inline-flex h-8 min-w-8 cursor-pointer items-center justify-center rounded-[var(--app-radius-control)] text-[13px] disabled:cursor-default disabled:opacity-40";

  return (
    <div className="flex flex-col items-start justify-between gap-2 pt-3 text-[13px] text-[var(--app-muted)] sm:flex-row sm:items-center">
      <span>{summary}</span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          aria-label="Previous page"
          disabled={page <= 1}
          onClick={() => onPage(Math.max(1, page - 1))}
          className={`${control} border border-[var(--app-border)]`}
        >
          ‹
        </button>
        {pages.map((number) => (
          <button
            key={number}
            type="button"
            aria-label={`Page ${number}`}
            aria-current={page === number ? "page" : undefined}
            onClick={() => onPage(number)}
            className={`${control} ${
              page === number
                ? "bg-[var(--app-nav-active-bg)] text-[var(--app-nav-active)]"
                : "border border-[var(--app-border)] text-[var(--app-ink)]"
            }`}
          >
            {number}
          </button>
        ))}
        {safeTotal > 5 ? (
          <>
            <span className="px-1" aria-hidden>
              …
            </span>
            <button
              type="button"
              aria-label={`Page ${safeTotal}`}
              aria-current={page === safeTotal ? "page" : undefined}
              onClick={() => onPage(safeTotal)}
              className={`${control} ${
                page === safeTotal
                  ? "bg-[var(--app-nav-active-bg)] text-[var(--app-nav-active)]"
                  : "border border-[var(--app-border)] text-[var(--app-ink)]"
              }`}
            >
              {safeTotal}
            </button>
          </>
        ) : null}
        <button
          type="button"
          aria-label="Next page"
          disabled={page >= safeTotal}
          onClick={() => onPage(Math.min(safeTotal, page + 1))}
          className={`${control} border border-[var(--app-border)]`}
        >
          ›
        </button>
      </div>
    </div>
  );
}
