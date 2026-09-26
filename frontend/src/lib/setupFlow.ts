import type { SetupStep } from "@/components/dashboard/EmptyDashboardState";
import { businessIsSet } from "@/components/dashboard/BusinessSetupCard";
import type { OnboardingState } from "@/lib/api";

export const SETUP_ACTIVE_KEY = "kpm_setup_active";
export const SETUP_SKIP_KEY = "kpm_setup_skipped";
export const SETUP_AUTOMATION_DONE_KEY = "kpm_setup_automation_done";

export type SetupStepId = "business" | "products" | "sales" | "accounting" | "automation";

export const SETUP_STEP_ORDER: SetupStepId[] = [
  "business",
  "products",
  "sales",
  "accounting",
  "automation",
];

export const SETUP_STEP_LABELS: Record<SetupStepId, string> = {
  business: "Set your business",
  products: "Add products",
  sales: "Connect sales",
  accounting: "Connect accounting",
  automation: "Enable automation",
};

export function setupStepHref(id: SetupStepId | string | undefined): string {
  switch (id) {
    case "business":
      return "/dashboard#get-started";
    case "sales":
      return "/sales?new=1";
    case "accounting":
      return "/accounting?record=1";
    case "automation":
      return "/settings#settings-ai";
    case "products":
      return "/inventory?add=1";
    default:
      return "/inventory?add=1";
  }
}

export type SetupCompletionInput = {
  onboarding: OnboardingState | null;
  totalProducts: number;
  totalOrders: number;
  transactionCount: number;
  automationSaved?: boolean;
};

export function isAutomationSetupDone(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(SETUP_AUTOMATION_DONE_KEY) === "1";
}

export function markAutomationSetupDone() {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SETUP_AUTOMATION_DONE_KEY, "1");
}

export function clearAutomationSetupDone() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(SETUP_AUTOMATION_DONE_KEY);
}

export function buildSetupSteps(input: SetupCompletionInput): SetupStep[] {
  const integrations = input.onboarding?.integrations || [];
  const salesConnected =
    input.totalOrders > 0 ||
    integrations.some((item) => item.category === "sales" && item.status === "saved");
  const booksConnected =
    input.transactionCount > 0 ||
    integrations.some((item) => item.category === "accounting" && item.status === "saved");
  const automationDone = Boolean(input.automationSaved) || isAutomationSetupDone();

  return SETUP_STEP_ORDER.map((id) => {
    let done = false;
    switch (id) {
      case "business":
        done = businessIsSet(input.onboarding?.profile);
        break;
      case "products":
        done = input.totalProducts > 0;
        break;
      case "sales":
        done = salesConnected;
        break;
      case "accounting":
        done = booksConnected;
        break;
      case "automation":
        done = automationDone;
        break;
      default: {
        const _exhaustive: never = id;
        void _exhaustive;
        done = false;
      }
    }
    return { id, label: SETUP_STEP_LABELS[id], done };
  });
}

export function readSkippedSteps(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(SETUP_SKIP_KEY) || "[]") as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

export function writeSkippedSteps(ids: string[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SETUP_SKIP_KEY, JSON.stringify(ids));
}

export function skipSetupStep(id: string) {
  const next = readSkippedSteps();
  if (!next.includes(id)) {
    next.push(id);
    writeSkippedSteps(next);
  }
}

export function isSetupActive(): boolean {
  if (typeof window === "undefined") return false;
  return window.sessionStorage.getItem(SETUP_ACTIVE_KEY) === "1";
}

export function startSetupFlow() {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(SETUP_ACTIVE_KEY, "1");
}

export function endSetupFlow() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(SETUP_ACTIVE_KEY);
}

export function nextOpenStep(steps: SetupStep[], skipped: string[] = readSkippedSteps()): SetupStep | undefined {
  return steps.find((step) => !step.done && !skipped.includes(step.id));
}

export function nextStepAfter(
  steps: SetupStep[],
  currentId: string,
  skipped: string[] = readSkippedSteps()
): SetupStep | undefined {
  const index = steps.findIndex((step) => step.id === currentId);
  const from = index >= 0 ? index + 1 : 0;
  return steps.slice(from).find((step) => !step.done && !skipped.includes(step.id)) ?? nextOpenStep(steps, skipped);
}

/** Path that owns a setup step (for highlighting the rail). */
export function stepIdForPath(pathname: string): SetupStepId | null {
  if (pathname.startsWith("/inventory")) return "products";
  if (pathname.startsWith("/sales")) return "sales";
  if (pathname.startsWith("/accounting")) return "accounting";
  if (pathname.startsWith("/settings")) return "automation";
  if (pathname.startsWith("/dashboard") || pathname.startsWith("/onboarding")) return "business";
  return null;
}
