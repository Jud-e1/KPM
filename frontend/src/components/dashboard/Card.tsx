import type { ReactNode } from "react";

export function Card({
  children,
  className = "",
  hover = false,
}: {
  children: ReactNode;
  className?: string;
  hover?: boolean;
}) {
  return (
    <section
      className={`kpm-card rounded-[var(--app-radius)] ${hover ? "kpm-card-hover" : ""} ${className}`}
    >
      {children}
    </section>
  );
}

export function CardHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h2 className="text-[16px] font-semibold tracking-[-0.02em] text-[var(--app-ink)]">{title}</h2>
        {subtitle ? <p className="mt-0.5 text-[13px] leading-5 text-[var(--app-muted)]">{subtitle}</p> : null}
      </div>
      {action ? <div className="shrink-0 self-start">{action}</div> : null}
    </div>
  );
}
