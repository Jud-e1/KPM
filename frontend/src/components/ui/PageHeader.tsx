import React from "react";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="app-heading text-[26px] sm:text-[32px]">{title}</h1>
        {description ? <p className="mt-1.5 text-sm leading-relaxed text-[var(--app-muted)]">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div> : null}
    </div>
  );
}

export function SectionHeading({
  title,
  meta,
  action,
}: {
  title: string;
  meta?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-3">
      <h2 className="text-sm font-semibold tracking-[-0.01em] text-[var(--app-ink)]">{title}</h2>
      <div className="flex items-center gap-3 text-xs text-[var(--app-muted)]">
        {meta}
        {action}
      </div>
    </div>
  );
}
