export function SectionError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="rounded-[14px] border border-[var(--app-border)] bg-[var(--app-surface)] px-4 py-6 text-center">
      <p className="text-[15px] font-semibold text-[var(--app-ink)]">Something went wrong</p>
      <p className="mt-1 text-[13px] text-[var(--app-muted)]">Unable to load this information right now.</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-3 inline-flex h-8 items-center rounded-lg border border-[var(--app-border-strong)] bg-[var(--app-surface)] px-3 text-[13px] font-medium text-[var(--app-ink)] hover:bg-[var(--app-hover)]"
      >
        Try Again
      </button>
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-4" aria-hidden>
      <div className="grid grid-cols-1 gap-3 min-[430px]:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-[124px] animate-pulse rounded-[14px] border border-[var(--app-border)] bg-[var(--app-surface)]" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(280px,0.8fr)]">
        <div className="h-[360px] animate-pulse rounded-[14px] border border-[var(--app-border)] bg-[var(--app-surface)]" />
        <div className="space-y-4">
          <div className="h-[220px] animate-pulse rounded-[14px] border border-[var(--app-border)] bg-[var(--app-surface)]" />
          <div className="h-[220px] animate-pulse rounded-[14px] border border-[var(--app-border)] bg-[var(--app-surface)]" />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="h-72 animate-pulse rounded-[14px] border border-[var(--app-border)] bg-[var(--app-surface)]" />
        <div className="h-72 animate-pulse rounded-[14px] border border-[var(--app-border)] bg-[var(--app-surface)]" />
        <div className="h-72 animate-pulse rounded-[14px] border border-[var(--app-border)] bg-[var(--app-surface)]" />
      </div>
    </div>
  );
}
