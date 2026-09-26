import Link from "next/link";
import { Check } from "lucide-react";
import type { SetupStep } from "./EmptyDashboardState";

export function GetStartedBar({
  steps,
  href,
  onGetStarted,
}: {
  steps: SetupStep[];
  href: string;
  onGetStarted?: () => void;
}) {
  const completed = steps.filter((step) => step.done).length;
  const next = steps.find((step) => !step.done);
  if (!next || completed === steps.length) return null;

  return (
    <section className="kpm-card flex flex-col gap-4 px-4 py-4 lg:flex-row lg:items-center lg:px-5">
      <div className="min-w-0 lg:w-64 lg:shrink-0">
        <h2 className="text-[15px] font-semibold text-[var(--app-ink)]">Get Started</h2>
        <p className="mt-1 text-[12.5px] leading-5 text-[var(--app-muted)]">Next: {next.label}.</p>
      </div>
      <ol className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-2">
        {steps.map((step, index) => (
          <li key={step.id} className="flex items-center gap-2 text-[12px]">
            <span
              className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold ${
                step.done ? "bg-[var(--app-nav-active-bg)] text-[var(--app-nav-active)]" : "bg-[var(--app-hover)] text-[var(--app-muted)]"
              }`}
            >
              {step.done ? <Check className="h-3 w-3" /> : index + 1}
            </span>
            <span className={step.done ? "text-[var(--app-ink)]" : "text-[var(--app-muted)]"}>{step.label}</span>
          </li>
        ))}
      </ol>
      <div className="flex items-center gap-3">
        <span className="text-[12px] tabular-nums text-[var(--app-muted)]">
          {completed} of {steps.length}
        </span>
        {onGetStarted ? (
          <button
            type="button"
            onClick={onGetStarted}
            className="inline-flex h-9 items-center rounded-lg bg-[var(--app-nav-active-bg)] px-3.5 text-[13px] font-medium text-[var(--app-nav-active)] transition-colors duration-150 hover:opacity-90"
          >
            Get Started
          </button>
        ) : (
          <Link
            href={href}
            className="inline-flex h-9 items-center rounded-lg bg-[var(--app-nav-active-bg)] px-3.5 text-[13px] font-medium text-[var(--app-nav-active)] transition-colors duration-150 hover:opacity-90"
          >
            Get Started
          </Link>
        )}
      </div>
    </section>
  );
}
