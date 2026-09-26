import Link from "next/link";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/Button";

export type SetupStep = { id: string; label: string; done: boolean };

export function EmptyDashboardState({ steps }: { steps: SetupStep[] }) {
  const completed = steps.filter((step) => step.done).length;

  return (
    <section className="kpm-card px-5 py-8 sm:px-8 sm:py-10">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--app-faint)]">Getting started</p>
      <h2 className="mt-2 text-[28px] font-bold tracking-tight text-[var(--app-ink)] sm:text-[32px]">Let&apos;s get your business running.</h2>
      <p className="mt-2 max-w-xl text-[14px] leading-6 text-[var(--app-muted)]">
        Connect your business and add your first products to start seeing insights here.
      </p>
      <div className="mt-5 flex flex-wrap gap-2">
        <Button href="/inventory?add=1" data-tour="inventory">
          Add Your First Product
        </Button>
        <Button href="/inventory?import=1" variant="secondary" data-tour="sales">
          Import Products
        </Button>
      </div>
      <div className="mt-8 max-w-xl" data-tour="accounting">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="text-[15px] font-semibold text-[var(--app-ink)]">Setup progress</h3>
          <span className="text-[12px] tabular-nums text-[var(--app-muted)]">
            {completed} of {steps.length} completed
          </span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--app-hover)]" aria-hidden>
          <div className="h-full bg-[var(--app-nav-active-bg)]" style={{ width: `${(completed / steps.length) * 100}%` }} />
        </div>
        <ol className="mt-4 space-y-2">
          {steps.map((step, index) => (
            <li key={step.id} className="flex items-center gap-3 text-[13.5px]">
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold ${
                  step.done ? "bg-[var(--app-nav-active-bg)] text-[var(--app-nav-active)]" : "border border-[var(--app-border-strong)] text-[var(--app-muted)]"
                }`}
              >
                {step.done ? <Check className="h-3.5 w-3.5" /> : index + 1}
              </span>
              <span className={step.done ? "text-[var(--app-ink)]" : "text-[var(--app-muted)]"}>{step.label}</span>
            </li>
          ))}
        </ol>
        <p className="mt-4 text-[12.5px] text-[var(--app-muted)]">
          Prefer a guided setup? <Link href="/onboarding" className="font-semibold text-[var(--app-ink)] hover:underline">Continue onboarding</Link>
        </p>
      </div>
    </section>
  );
}
