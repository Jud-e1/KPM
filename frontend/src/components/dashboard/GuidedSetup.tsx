"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BusinessSetupCard } from "./BusinessSetupCard";
import type { SetupStep } from "./EmptyDashboardState";
import type { OnboardingProfile, OnboardingState } from "@/lib/api";
import {
  readSkippedSteps,
  setupStepHref,
  startSetupFlow,
  writeSkippedSteps,
  type SetupStepId,
} from "@/lib/setupFlow";

const COPY: Record<string, { title: string; body: string; href?: string; action?: string }> = {
  business: {
    title: "Business profile",
    body: "Name the business and choose how it sells. You can change this later in Settings.",
  },
  products: {
    title: "Add products",
    body: "Add your first products to start tracking stock. Totals stay at zero until you do.",
    href: "/inventory?add=1",
    action: "Add a product",
  },
  sales: {
    title: "Connect sales",
    body: "Record a sale, or connect a channel later. KPM works with orders you enter yourself.",
    href: "/sales?new=1",
    action: "Create a sale",
  },
  accounting: {
    title: "Configure accounting",
    body: "Open the books and record income or expenses when you are ready.",
    href: "/accounting?record=1",
    action: "Open accounting",
  },
  automation: {
    title: "Enable automation",
    body: "Choose what KPM may do on its own. Review required is the default for new workspaces.",
    href: "/settings#settings-ai",
    action: "Review automation",
  },
};

export function GuidedSetup({
  open,
  onClose,
  steps,
  startId,
  profile,
  fallbackName,
  fallbackType,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  steps: SetupStep[];
  startId?: string;
  profile: OnboardingProfile | null;
  fallbackName: string;
  fallbackType: string;
  onSaved: (state: OnboardingState) => void;
}) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [skipped, setSkipped] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!open) {
      setReady(false);
      return;
    }
    const stored = readSkippedSteps();
    setSkipped(stored);
    const start = steps.findIndex((step) => step.id === startId);
    if (start >= 0) setIndex(start);
    else {
      const next = steps.findIndex((step) => !step.done && !stored.includes(step.id));
      setIndex(next >= 0 ? next : 0);
    }
    setReady(true);
  }, [open, startId, steps]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !ready || steps.length === 0) return null;

  const step = steps[Math.min(index, steps.length - 1)];
  const copy = COPY[step.id] ?? { title: step.label, body: step.label };
  const progress = `${index + 1} of ${steps.length}`;

  const rememberSkip = (id: string) => {
    const next = skipped.includes(id) ? skipped : [...skipped, id];
    setSkipped(next);
    writeSkippedSteps(next);
  };

  const openPage = (id: string) => {
    startSetupFlow();
    window.dispatchEvent(new Event("kpm-setup-change"));
    onClose();
    if (id === "business") return;
    router.push(setupStepHref(id as SetupStepId));
  };

  const goNextInDialog = () => {
    if (index >= steps.length - 1) {
      onClose();
      return;
    }
    setIndex(index + 1);
  };

  const continueFromStep = () => {
    if (step.id === "business") return;
    openPage(step.id);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center p-3 sm:items-center sm:p-6">
      <button type="button" aria-label="Close setup" className="absolute inset-0 bg-[#111827]/40" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="kpm-guide-title"
        className="relative flex max-h-[min(40rem,calc(100vh-2rem))] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] shadow-[var(--app-shadow-pop)]"
      >
        <div className="border-b border-[var(--app-border)] px-5 py-4">
          <p className="text-[11px] font-semibold tracking-[0.14em] text-[var(--app-accent)]">GET STARTED WITH KPM</p>
          <h2 id="kpm-guide-title" className="mt-1 text-[20px] font-semibold tracking-tight text-[var(--app-ink)]">
            {copy.title}
          </h2>
          <p className="mt-1 text-[13px] text-[var(--app-muted)]">Step {progress}</p>
          <ol className="mt-3 flex gap-1.5" aria-label="Setup progress">
            {steps.map((item, itemIndex) => (
              <li
                key={item.id}
                className={`h-1.5 flex-1 rounded-full ${
                  item.done || skipped.includes(item.id) || itemIndex < index ? "bg-[var(--app-nav-active-bg)]" : "bg-[var(--app-hover)]"
                }`}
              />
            ))}
          </ol>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <p className="text-[13px] leading-5 text-[var(--app-muted)]">{copy.body}</p>
          {step.id === "business" ? (
            <BusinessSetupCard
              plain
              formId="kpm-guide-business"
              showActions={false}
              profile={profile}
              fallbackName={fallbackName}
              fallbackType={fallbackType}
              editing
              onEditing={() => undefined}
              onBusy={setBusy}
              onSaved={(state) => {
                onSaved(state);
                startSetupFlow();
                window.dispatchEvent(new Event("kpm-setup-change"));
                onClose();
                router.push(setupStepHref("products"));
              }}
            />
          ) : copy.href ? (
            <button
              type="button"
              onClick={() => openPage(step.id)}
              className="mt-4 inline-flex text-[13px] font-semibold text-[var(--app-accent)] hover:underline"
            >
              {copy.action} →
            </button>
          ) : null}
        </div>
        <div className="flex items-center justify-between gap-2 border-t border-[var(--app-border)] px-5 py-3">
          <button
            type="button"
            onClick={() => setIndex((value) => Math.max(0, value - 1))}
            disabled={index === 0}
            className="inline-flex h-9 items-center rounded-lg px-3 text-[13px] font-medium text-[var(--app-muted)] hover:text-[var(--app-ink)] disabled:opacity-40"
          >
            Back
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                rememberSkip(step.id);
                if (step.id === "business") {
                  goNextInDialog();
                  return;
                }
                const remaining = steps.slice(index + 1).find((item) => !item.done && !skipped.includes(item.id) && item.id !== step.id);
                if (!remaining) {
                  onClose();
                  return;
                }
                if (remaining.id === "business") {
                  setIndex(steps.findIndex((item) => item.id === remaining.id));
                  return;
                }
                openPage(remaining.id);
              }}
              className="inline-flex h-9 items-center rounded-lg px-3 text-[13px] font-medium text-[var(--app-muted)] hover:text-[var(--app-ink)]"
            >
              Skip for now
            </button>
            {step.id === "business" ? (
              <button
                type="submit"
                form="kpm-guide-business"
                disabled={busy}
                className="inline-flex h-9 items-center rounded-lg bg-[var(--app-nav-active-bg)] px-3.5 text-[13px] font-medium text-[var(--app-nav-active)] hover:opacity-90 disabled:opacity-60"
              >
                {busy ? "Saving…" : "Continue"}
              </button>
            ) : (
              <button
                type="button"
                onClick={continueFromStep}
                className="inline-flex h-9 items-center rounded-lg bg-[var(--app-nav-active-bg)] px-3.5 text-[13px] font-medium text-[var(--app-nav-active)] hover:opacity-90"
              >
                {copy.action || "Continue"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
