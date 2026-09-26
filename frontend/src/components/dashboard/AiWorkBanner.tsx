import Link from "next/link";

export function AiWorkBanner() {
  return (
    <section className="kpm-card flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
      <div className="min-w-0">
        <h2 className="text-[15px] font-semibold text-[var(--app-ink)]">Let KPM work for you</h2>
        <p className="mt-0.5 text-[12.5px] text-[var(--app-muted)]">
          Clearer stock calls, faster books, and recommendations that wait for your OK.
        </p>
      </div>
      <Link
        href="/insights"
        className="inline-flex h-9 shrink-0 items-center justify-center rounded-lg bg-[var(--app-nav-active-bg)] px-3 text-[13px] font-medium text-[var(--app-nav-active)] transition-colors duration-150 hover:opacity-90"
      >
        Explore AI Features →
      </Link>
    </section>
  );
}
