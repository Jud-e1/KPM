"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { accountingStore } from "@/lib/accountingStore";
import { inventoryStore } from "@/lib/inventoryStore";
import { salesStore } from "@/lib/salesStore";
import { fetchOnboardingState, type OnboardingState } from "@/lib/api";
import {
  buildSetupSteps,
  endSetupFlow,
  isAutomationSetupDone,
  isSetupActive,
  nextOpenStep,
  nextStepAfter,
  readSkippedSteps,
  skipSetupStep,
  startSetupFlow,
  stepIdForPath,
  setupStepHref,
  type SetupStepId,
} from "@/lib/setupFlow";

function goToStep(router: ReturnType<typeof useRouter>, id: SetupStepId | string) {
  startSetupFlow();
  if (id === "business") {
    router.push("/dashboard#get-started");
  } else {
    router.push(setupStepHref(id));
  }
  window.dispatchEvent(new Event("kpm-setup-change"));
}

export function SetupRail() {
  const pathname = usePathname() || "/dashboard";
  const router = useRouter();
  const [active, setActive] = useState(false);
  const [onboarding, setOnboarding] = useState<OnboardingState | null>(null);
  const [products, setProducts] = useState(0);
  const [orders, setOrders] = useState(0);
  const [transactions, setTransactions] = useState(0);
  const [skipped, setSkipped] = useState<string[]>([]);
  const [automationSaved, setAutomationSaved] = useState(false);

  const refreshActive = useCallback(() => {
    setActive(isSetupActive());
    setSkipped(readSkippedSteps());
    setAutomationSaved(isAutomationSetupDone());
  }, []);

  useEffect(() => {
    refreshActive();
    const onChange = () => refreshActive();
    window.addEventListener("storage", onChange);
    window.addEventListener("kpm-setup-change", onChange);
    return () => {
      window.removeEventListener("storage", onChange);
      window.removeEventListener("kpm-setup-change", onChange);
    };
  }, [refreshActive, pathname]);

  useEffect(() => {
    if (!active) return;
    const inv = inventoryStore.subscribe((state) => setProducts(state.metrics.totalProducts));
    const sales = salesStore.subscribe((state) => setOrders(state.metrics.totalOrders));
    const books = accountingStore.subscribe((state) => setTransactions(state.transactions.length));
    setProducts(inventoryStore.getState().metrics.totalProducts);
    setOrders(salesStore.getState().metrics.totalOrders);
    setTransactions(accountingStore.getState().transactions.length);
    void fetchOnboardingState()
      .then(setOnboarding)
      .catch(() => setOnboarding(null));
    return () => {
      inv();
      sales();
      books();
    };
  }, [active]);

  const steps = useMemo(
    () =>
      buildSetupSteps({
        onboarding,
        totalProducts: products,
        totalOrders: orders,
        transactionCount: transactions,
        automationSaved,
      }),
    [onboarding, products, orders, transactions, automationSaved]
  );

  const currentId = stepIdForPath(pathname);
  const next = nextOpenStep(steps, skipped);
  const currentStep = currentId ? steps.find((step) => step.id === currentId) : undefined;
  const completed = steps.filter((step) => step.done).length;
  const onCurrentIncomplete = Boolean(currentId && currentStep && !currentStep.done && !skipped.includes(currentId));
  const pageReady = Boolean(currentStep?.done);

  useEffect(() => {
    if (!active) return;
    if (!next) {
      endSetupFlow();
      setActive(false);
      window.dispatchEvent(new Event("kpm-setup-change"));
    }
  }, [active, next]);

  if (!active || !next) return null;

  const finishOrGo = (targetId: string | undefined) => {
    if (!targetId) {
      endSetupFlow();
      setActive(false);
      router.push("/dashboard");
      window.dispatchEvent(new Event("kpm-setup-change"));
      return;
    }
    goToStep(router, targetId);
  };

  const handleContinue = () => {
    if (pageReady) {
      const after = nextStepAfter(steps, currentId || next.id, skipped);
      finishOrGo(after?.id);
      return;
    }
    if (next.id !== currentId) {
      goToStep(router, next.id);
    }
  };

  const onSkip = () => {
    const skipId = onCurrentIncomplete && currentId ? currentId : next.id;
    skipSetupStep(skipId);
    const nextSkipped = skipped.includes(skipId) ? skipped : [...skipped, skipId];
    setSkipped(nextSkipped);
    const remaining = nextStepAfter(steps, skipId, nextSkipped);
    finishOrGo(remaining?.id);
  };

  const label = onCurrentIncomplete && currentStep ? currentStep.label : next.label;
  let continueLabel = "Continue";
  if (pageReady) {
    const after = nextStepAfter(steps, currentId || next.id, skipped);
    continueLabel = after ? `Continue to ${after.label}` : "Finish setup";
  } else if (next.id !== currentId) {
    continueLabel = `Go to ${next.label}`;
  } else {
    continueLabel = "Complete this step";
  }

  const continueDisabled = onCurrentIncomplete && !pageReady && next.id === currentId;

  return (
    <div className="border-b border-[#e8edf5] bg-[#f7f9fc] px-4 py-2.5 sm:px-6">
      <div className="mx-auto flex max-w-[1440px] flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold tracking-[0.12em] text-[var(--app-accent)]">GET STARTED</p>
          <p className="mt-0.5 truncate text-[13px] text-[var(--app-ink)]">
            <span className="font-semibold">{label}</span>
            <span className="text-[var(--app-muted)]">
              {" "}
              · {completed} of {steps.length} complete
            </span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/dashboard#get-started"
            className="inline-flex h-8 items-center rounded-lg px-2.5 text-[12px] font-medium text-[var(--app-muted)] hover:text-[var(--app-ink)]"
          >
            Dashboard
          </Link>
          <button
            type="button"
            onClick={onSkip}
            className="inline-flex h-8 items-center rounded-lg px-2.5 text-[12px] font-medium text-[var(--app-muted)] hover:text-[var(--app-ink)]"
          >
            Skip for now
          </button>
          <button
            type="button"
            onClick={handleContinue}
            disabled={continueDisabled}
            className="inline-flex h-8 items-center rounded-lg bg-[var(--app-nav-active-bg)] px-3 text-[12px] font-medium text-[var(--app-nav-active)] hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {continueLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
