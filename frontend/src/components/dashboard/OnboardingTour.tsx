"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

const STEPS = [
  {
    anchor: "welcome",
    title: "Welcome to KPM",
    body: "This is your operating view. It shows how the business is doing, what needs a decision, and what KPM can take on.",
  },
  {
    anchor: "inventory",
    title: "Manage your inventory",
    body: "Add products, watch low stock, and record purchases before a sale is blocked.",
  },
  {
    anchor: "sales",
    title: "Track sales",
    body: "Process orders here and see what is still pending.",
  },
  {
    anchor: "accounting",
    title: "Automate accounting",
    body: "Choose what KPM can reconcile on its own, and what should wait for your review.",
  },
  {
    anchor: "ai",
    title: "Let KPM AI find opportunities",
    body: "Ask about stock, sales, or the week. Recommendations stay suggestions until you approve them.",
  },
];

export function OnboardingTour({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [step, setStep] = useState(0);
  const [box, setBox] = useState<DOMRect | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const current = STEPS[step];

  useEffect(() => {
    if (open) setStep(0);
  }, [open]);

  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const target = document.querySelector(`[data-tour="${current.anchor}"]`);
      setBox(target ? target.getBoundingClientRect() : null);
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, current.anchor, step]);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowRight") setStep((value) => Math.min(STEPS.length - 1, value + 1));
      if (event.key === "ArrowLeft") setStep((value) => Math.max(0, value - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose, step]);

  if (!open) return null;

  const width = Math.min(360, typeof window !== "undefined" ? window.innerWidth - 32 : 360);
  const left = box ? Math.min(Math.max(16, box.left), window.innerWidth - width - 16) : Math.max(16, (window.innerWidth - width) / 2);
  const preferredTop = box ? box.bottom + 12 : Math.max(24, window.innerHeight / 2 - 120);
  const top = Math.min(Math.max(16, preferredTop), window.innerHeight - 230);

  return (
    <div className="fixed inset-0 z-[70]">
      {box ? (
        <div
          className="pointer-events-none absolute rounded-xl"
          style={{
            top: Math.max(8, box.top - 6),
            left: Math.max(8, box.left - 6),
            width: box.width + 12,
            height: box.height + 12,
            boxShadow: "0 0 0 9999px rgba(17, 20, 28, 0.46)",
          }}
        />
      ) : (
        <div className="absolute inset-0 bg-[#11141c]/45" />
      )}
      <div className="absolute inset-0" />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="kpm-tour-title"
        tabIndex={-1}
        className="absolute rounded-[14px] border border-[var(--app-border)] bg-[var(--app-surface)] p-4 shadow-[var(--app-shadow-pop)] outline-none"
        style={{ top, left, width }}
      >
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--app-faint)]">
          {step + 1} of {STEPS.length}
        </p>
        <h2 id="kpm-tour-title" className="mt-1 text-[18px] font-semibold tracking-tight text-[var(--app-ink)]">
          {current.title}
        </h2>
        <p className="mt-1.5 text-[13px] leading-5 text-[var(--app-muted)]">{current.body}</p>
        <div className="mt-4 flex items-center justify-between gap-2">
          <button type="button" onClick={onClose} className="text-[13px] font-medium text-[var(--app-muted)] hover:text-[var(--app-ink)]">
            Skip Tour
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setStep((value) => Math.max(0, value - 1))}
              disabled={step === 0}
              className="h-8 rounded-lg border border-[var(--app-border)] px-3 text-[13px] font-medium text-[var(--app-ink)] disabled:opacity-40"
            >
              Back
            </button>
            <button
              type="button"
              onClick={() => {
                if (step === STEPS.length - 1) onClose();
                else setStep((value) => value + 1);
              }}
              className="h-8 rounded-lg bg-[var(--app-nav-active-bg)] px-3 text-[13px] font-medium text-[var(--app-nav-active)]"
            >
              {step === STEPS.length - 1 ? "Done" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
