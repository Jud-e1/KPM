export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-[var(--app-radius-control)] bg-[var(--app-hover)] ${className}`} />;
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div
      className="rounded-[var(--app-radius)] border border-[var(--app-border)] bg-[var(--app-surface)] p-3 space-y-2"
      aria-hidden
    >
      <Skeleton className="h-8 w-full" />
      {Array.from({ length: rows }).map((_, index) => (
        <Skeleton key={index} className="h-10 w-full" />
      ))}
    </div>
  );
}
