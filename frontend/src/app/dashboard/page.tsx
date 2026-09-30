"use client";

import React, { startTransition, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Boxes, ClipboardList, ShoppingBag, Wallet } from "lucide-react";
import { inventoryStore, type InventoryState } from "@/lib/inventoryStore";
import { salesStore, type SalesState } from "@/lib/salesStore";
import { accountingStore, type AccountingState } from "@/lib/accountingStore";
import { authStore } from "@/lib/authStore";
import { AppShell } from "@/components/AppShell";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { AUTOMATION_DEFS } from "@/lib/onboardingCatalog";
import {
  acceptMlSuggestion,
  dismissOnboardingTour,
  fetchAccountingSummary,
  fetchInventorySummary,
  fetchMlFlags,
  fetchMlSuggestions,
  fetchOnboardingState,
  fetchPurchaseDrafts,
  fetchSalesSummary,
  saveOnboardingAutomations,
  type AutomationMode,
  type MlSuggestion,
  type OnboardingState,
  type PurchaseDraft,
} from "@/lib/api";
import { WelcomeBanner } from "@/components/dashboard/WelcomeBanner";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { RevenueChart } from "@/components/dashboard/RevenueChart";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { AIAssistant } from "@/components/dashboard/AIAssistant";
import { StockMix } from "@/components/dashboard/StockMix";
import { RecentActivity, type ActivityItem } from "@/components/dashboard/RecentActivity";
import { BusinessPerformance, type PerformanceTab } from "@/components/dashboard/BusinessPerformance";
import { AISuggestions, type SuggestionCard } from "@/components/dashboard/AISuggestions";
import { AutomationPermissions } from "@/components/dashboard/AutomationPermissions";
import { GetStartedBar } from "@/components/dashboard/GetStartedBar";
import { GuidedSetup } from "@/components/dashboard/GuidedSetup";
import type { SetupStep } from "@/components/dashboard/EmptyDashboardState";
import { OnboardingTour } from "@/components/dashboard/OnboardingTour";
import { DashboardSkeleton, SectionError } from "@/components/dashboard/SectionError";
import { firstName, formatCurrency, formatLongDate, formatTime, greetingFor } from "@/components/dashboard/format";
import { dailyOrderSeries, percentChange, rangeBounds, trailingChange, type RangeKey } from "@/components/dashboard/series";
import {
  buildSetupSteps,
  isAutomationSetupDone,
  nextOpenStep,
  setupStepHref,
  startSetupFlow,
  type SetupStepId,
} from "@/lib/setupFlow";

const SETUP_KEY = "kpm_dashboard_setup_v1";
const TOUR_KEY = "kpm_tour_done";

type SetupState = { done: string[]; values: Record<string, string>; paused: boolean };

function loadSetup(): SetupState {
  const initial: SetupState = { done: ["account", "business"], values: {}, paused: false };
  if (typeof window === "undefined") return initial;
  try {
    const raw = localStorage.getItem(SETUP_KEY);
    if (!raw) return initial;
    const parsed = JSON.parse(raw) as SetupState;
    return {
      done: Array.isArray(parsed.done) ? parsed.done : initial.done,
      values: parsed.values || {},
      paused: Boolean(parsed.paused),
    };
  } catch {
    return initial;
  }
}

function hasCachedWork(inventory: InventoryState, sales: SalesState, accounting: AccountingState) {
  return inventory.products.length > 0 || sales.orders.length > 0 || accounting.transactions.length > 0;
}

export default function DashboardPage() {
  const router = useRouter();
  const [now, setNow] = useState(() => new Date());
  const [searchQuery, setSearchQuery] = useState("");
  const [question, setQuestion] = useState("");
  const [aiAnswer, setAiAnswer] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [selected, setSelected] = useState<ActivityItem | null>(null);
  const [activityOpen, setActivityOpen] = useState(false);
  const [setup, setSetup] = useState<SetupState>({ done: ["account", "business"], values: {}, paused: false });
  const [onboarding, setOnboarding] = useState<OnboardingState | null>(null);
  const [onboardingReady, setOnboardingReady] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);
  const [tourPending, setTourPending] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [guideStart, setGuideStart] = useState<string | undefined>(undefined);
  const [automationSetupDone, setAutomationSetupDone] = useState(false);
  const [range, setRange] = useState<RangeKey>("7d");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [performanceTab, setPerformanceTab] = useState<PerformanceTab>("sales");
  const [booksError, setBooksError] = useState(false);
  const [booting, setBooting] = useState(true);
  const [modes, setModes] = useState<Record<string, AutomationMode>>({});
  const [permissionSaving, setPermissionSaving] = useState(false);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<MlSuggestion[]>([]);
  const [drafts, setDrafts] = useState<PurchaseDraft[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(true);
  const [suggestionsError, setSuggestionsError] = useState<string | null>(null);
  const [busySuggestion, setBusySuggestion] = useState<string | null>(null);

  const [inventoryState, setInventoryState] = useState<InventoryState>(inventoryStore.getState());
  const [salesState, setSalesState] = useState<SalesState>(salesStore.getState());
  const [accountingState, setAccountingState] = useState<AccountingState>(accountingStore.getState());
  const [authUser, setAuthUser] = useState(authStore.getState().user);

  const refreshBooks = useCallback(async () => {
    const checks = await Promise.allSettled([fetchInventorySummary(), fetchSalesSummary(), fetchAccountingSummary()]);
    await Promise.allSettled([
      inventoryStore.syncFromBackend(true),
      salesStore.syncFromBackend(true),
      accountingStore.syncFromBackend(true),
    ]);
    setBooksError(checks.every((result) => result.status === "rejected"));
    setBooting(false);
  }, []);

  const refreshSuggestions = useCallback(async () => {
    setSuggestionsLoading(true);
    try {
      const [rows, flags, purchaseDrafts] = await Promise.all([
        fetchMlSuggestions({ status: "suggested", limit: 6 }),
        fetchMlFlags({ status: "open", limit: 6 }),
        fetchPurchaseDrafts().catch(() => [] as PurchaseDraft[]),
      ]);
      setSuggestions(rows);
      setDrafts(purchaseDrafts.filter((draft) => draft.status !== "accepted").slice(0, 4));
      if (flags.length && rows.length === 0) {
        setSuggestions(
          flags.slice(0, 3).map((flag) => ({
            id: flag.id,
            kind: "flag",
            function_id: "flag_anomalies",
            entity_type: flag.entity_type,
            entity_id: flag.entity_id,
            score: flag.score,
            unique_top: "",
            model_version: flag.model_version,
            explanation: flag.explanation,
            payload_json: "",
            status: flag.status,
            decision: null,
            created_at: "",
          }))
        );
      }
      setSuggestionsError(null);
    } catch (error) {
      setSuggestionsError(error instanceof Error ? error.message : "Unable to load suggestions");
    } finally {
      setSuggestionsLoading(false);
    }
  }, []);

  useEffect(() => {
    setSetup(loadSetup());
    setAutomationSetupDone(isAutomationSetupDone());
    const onSetupChange = () => setAutomationSetupDone(isAutomationSetupDone());
    window.addEventListener("kpm-setup-change", onSetupChange);
    const cached = hasCachedWork(inventoryStore.getState(), salesStore.getState(), accountingStore.getState());
    if (cached) setBooting(false);
    return () => window.removeEventListener("kpm-setup-change", onSetupChange);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const next = await fetchOnboardingState();
        if (cancelled) return;
        setOnboarding(next);
        const map: Record<string, AutomationMode> = {};
        for (const item of next.automations) map[item.function_id] = item.mode;
        if (!map.reconcile && accountingStore.getState().profile.autoReconciliation) map.reconcile = "automatic";
        setModes(map);
        const params = new URLSearchParams(window.location.search);
        const wantsTour = params.get("tour") === "1";
        const remembered = window.localStorage.getItem(TOUR_KEY) === "1" || next.profile.tour_dismissed;
        if (remembered) window.localStorage.setItem(TOUR_KEY, "1");
        if (wantsTour || !remembered) setTourPending(true);
        if (wantsTour) window.history.replaceState({}, "", "/dashboard");
      } catch {
        if (!cancelled && window.localStorage.getItem(TOUR_KEY) !== "1") setTourPending(true);
      } finally {
        if (!cancelled) setOnboardingReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const unsub = inventoryStore.subscribe((next) => startTransition(() => setInventoryState(next)));
    const disconnect = inventoryStore.connectLive();
    return () => {
      unsub();
      disconnect();
    };
  }, []);

  useEffect(() => {
    const unsub = salesStore.subscribe((next) => startTransition(() => setSalesState(next)));
    const disconnect = salesStore.connectLive();
    return () => {
      unsub();
      disconnect();
    };
  }, []);

  useEffect(() => {
    const unsub = accountingStore.subscribe((next) => startTransition(() => setAccountingState(next)));
    const disconnect = accountingStore.connectLive();
    return () => {
      unsub();
      disconnect();
    };
  }, []);

  useEffect(() => authStore.subscribe((state) => setAuthUser(state.user)), []);

  useEffect(() => {
    void refreshBooks();
    void refreshSuggestions();
  }, [refreshBooks, refreshSuggestions]);

  useEffect(() => {
    if (!booting && tourPending) {
      setTourOpen(true);
      setTourPending(false);
    }
  }, [booting, tourPending]);

  const persist = (next: SetupState) => {
    setSetup(next);
    localStorage.setItem(SETUP_KEY, JSON.stringify(next));
  };

  const finishTour = useCallback(async () => {
    setTourOpen(false);
    localStorage.setItem(TOUR_KEY, "1");
    try {
      const next = await dismissOnboardingTour(true);
      setOnboarding(next);
    } catch {
      /* local memory still prevents a repeat */
    }
  }, []);

  const { profile, metrics: books, activities, transactions } = accountingState;

  const bounds = useMemo(() => rangeBounds(range, customStart, customEnd, now), [range, customStart, customEnd, now]);
  const revenuePoints = useMemo(
    () => dailyOrderSeries(salesState.orders, bounds.start, bounds.end, "amount"),
    [salesState.orders, bounds.start, bounds.end]
  );
  const orderCountPoints = useMemo(() => {
    const week = rangeBounds("7d", "", "", now);
    return dailyOrderSeries(salesState.orders, week.start, week.end, "count");
  }, [salesState.orders, now]);
  const ordersInRange = useMemo(
    () => dailyOrderSeries(salesState.orders, bounds.start, bounds.end, "count"),
    [salesState.orders, bounds.start, bounds.end]
  );
  const revenueTotal = useMemo(() => revenuePoints.reduce((sum, point) => sum + point.value, 0), [revenuePoints]);
  const revenueDelta = useMemo(() => {
    const span = Math.max(bounds.end.getTime() - bounds.start.getTime(), 86400000);
    const end = new Date(bounds.start.getTime() - 1);
    const start = new Date(end.getTime() - span);
    const previous = dailyOrderSeries(salesState.orders, start, end, "amount").reduce((sum, point) => sum + point.value, 0);
    return percentChange(revenueTotal, previous);
  }, [salesState.orders, bounds, revenueTotal]);
  const dayChange = useMemo(() => trailingChange(salesState.orders, 1, now.getTime()), [salesState.orders, now]);

  const pendingOrders = useMemo(
    () => salesState.orders.filter((order) => order.status === "Pending" || order.status === "Processing").length,
    [salesState.orders]
  );
  const activeAlerts = inventoryState.alerts.filter((alert) => alert.type === "critical" || alert.type === "warning").length;
  const displayName = profile.fullName || authUser?.full_name || "";
  const name = firstName(displayName);
  const greeting = `${greetingFor(now)}${name ? `, ${name}` : ""}.`;
  const workspaceName = profile.organization || authUser?.organization || "";
  const revenueHint = range === "30d" ? "vs. prior 30 days" : range === "90d" ? "vs. prior 90 days" : range === "custom" ? "vs. previous period" : "vs. last 7 days";

  const feed = useMemo<ActivityItem[]>(() => {
    const sales = salesState.orders
      .filter((order) => order.status !== "Cancelled")
      .slice(0, 4)
      .map((order) => ({
        id: `sale-${order.id}`,
        title: order.status === "Pending" || order.status === "Processing" ? "Order needs action" : "New sale recorded",
        detail: `${order.orderNumber} · ${formatCurrency(order.totalAmount)}`,
        time: order.time || order.date,
        badge: "Sale",
        href: "/sales",
        icon: ShoppingBag,
      }));
    const stock = inventoryState.alerts.slice(0, 3).map((alert) => ({
      id: `alert-${alert.id}`,
      title: alert.type === "critical" ? "Low stock alert" : alert.title,
      detail: alert.subtitle,
      time: alert.time,
      badge: "Inventory",
      href: "/inventory",
      icon: alert.type === "critical" || alert.type === "warning" ? AlertTriangle : Boxes,
    }));
    const purchases = drafts.map((draft) => ({
      id: `po-${draft.id}`,
      title: "Purchase draft ready",
      detail: `${draft.product_name || draft.sku} · ${draft.qty} units`,
      time: "Recent",
      badge: "Purchase",
      href: "/inventory#purchase-drafts",
      icon: ClipboardList,
      }));
    const ledger = activities.slice(0, 4).map((item) => ({
      id: `acct-${item.id}`,
      title: item.title,
      detail: item.subtitle || profile.organization || "Accounting",
      time: item.time || "Just now",
      badge: "Accounting",
      href: "/accounting",
      icon: Wallet,
    }));
    return [...sales, ...purchases, ...ledger, ...stock].slice(0, 6);
  }, [salesState.orders, inventoryState.alerts, drafts, activities, profile.organization]);

  const visibleFeed = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return feed;
    return feed.filter((item) => `${item.title} ${item.detail} ${item.badge}`.toLowerCase().includes(query));
  }, [feed, searchQuery]);

  const suggestionCards = useMemo<SuggestionCard[]>(() => {
    const cards: SuggestionCard[] = [];
    const low = [...inventoryState.products]
      .filter((product) => product.status === "Low Stock" || product.status === "Out of Stock" || product.stock <= (product.lowStockThreshold ?? 0))
      .sort((a, b) => a.stock - b.stock)
      .slice(0, 2);
    for (const product of low) {
      cards.push({
        id: `stock-${product.id}`,
        eyebrow: `Restock ${product.name}`,
        body:
          product.stock <= 0
            ? `${product.name} is out of stock. Consider restocking before the next sale.`
            : `Only ${product.stock} ${product.stock === 1 ? "unit" : "units"} left. Consider restocking soon.`,
        action: "Reorder →",
        href: "/inventory#purchase-drafts",
      });
    }

    let priceGap: { name: string; lift: number } | null = null;
    for (const product of inventoryState.products) {
      const peers = inventoryState.products.filter((peer) => peer.category === product.category && peer.id !== product.id);
      if (peers.length < 2 || product.price <= 0) continue;
      const average = peers.reduce((sum, peer) => sum + peer.price, 0) / peers.length;
      if (average <= product.price * 1.12) continue;
      const lift = Math.round(((average - product.price) / product.price) * 100);
      if (lift > 80) continue;
      if (!priceGap || lift > priceGap.lift) priceGap = { name: product.name, lift };
    }
    if (priceGap && cards.length < 3) {
      cards.push({
        id: "price-gap",
        eyebrow: `Increase price for ${priceGap.name}`,
        body: `Similar products in your catalog are priced about ${priceGap.lift}% higher.`,
        action: "Adjust Price →",
        href: "/inventory",
      });
    }

    for (const suggestion of suggestions) {
      if (cards.length >= 3) break;
      const kind = suggestion.kind.replaceAll("_", " ");
      cards.push({
        id: suggestion.id,
        eyebrow: kind,
        body: suggestion.explanation || `Review ${suggestion.entity_id}.`,
        action: suggestion.kind === "flag" ? "Review →" : "Approve →",
        busy: busySuggestion === suggestion.id,
        onClick:
          suggestion.kind === "flag"
            ? undefined
            : () => {
                setBusySuggestion(suggestion.id);
                void acceptMlSuggestion(suggestion.id)
                  .then(() => refreshSuggestions())
                  .finally(() => setBusySuggestion(null));
              },
        href: suggestion.kind === "flag" ? "/insights" : undefined,
      });
    }

    if (cards.length < 3 && drafts[0]) {
      const draft = drafts[0];
      cards.push({
        id: `draft-${draft.id}`,
        eyebrow: "Purchase ready",
        body: draft.reason || `${draft.product_name || draft.sku} has a draft purchase for ${draft.qty} units.`,
        action: "View purchase →",
        href: "/inventory#purchase-drafts",
      });
    }
    return cards.slice(0, 3);
  }, [inventoryState.products, suggestions, drafts, busySuggestion, refreshSuggestions]);

  const setupSteps = useMemo<SetupStep[]>(
    () =>
      buildSetupSteps({
        onboarding,
        totalProducts: inventoryState.metrics.totalProducts,
        totalOrders: salesState.metrics.totalOrders,
        transactionCount: transactions.length,
        automationSaved: automationSetupDone,
      }),
    [onboarding, salesState.metrics.totalOrders, transactions.length, inventoryState.metrics.totalProducts, automationSetupDone]
  );

  const performance = useMemo(() => {
    if (performanceTab === "inventory") {
      const bars =
        inventoryState.metrics.topCategories.length > 0
          ? inventoryState.metrics.topCategories.slice(0, 6).map((category) => ({
              label: category.name.slice(0, 3),
              value: category.value,
            }))
          : [
              { label: "In", value: inventoryState.metrics.inStockCount },
              { label: "Low", value: inventoryState.metrics.lowStockCount },
              { label: "Out", value: inventoryState.metrics.outOfStockCount },
            ];
      return {
        valueLabel: "Stock value",
        value: formatCurrency(inventoryState.metrics.totalStockValue, 0),
        delta: null as number | null,
        bars,
        href: "/inventory",
      };
    }
    if (performanceTab === "accounting") {
      return {
        valueLabel: "Net profit",
        value: formatCurrency(books.netProfit),
        delta: null,
        bars: [
          { label: "In", value: Math.max(0, books.totalRevenue) },
          { label: "Out", value: Math.max(0, books.totalExpenses) },
          { label: "Cash", value: Math.max(0, books.cashBalance) },
        ],
        href: "/accounting",
      };
    }
    return {
      valueLabel: "Total Sales",
      value: formatCurrency(revenueTotal),
      delta: revenueDelta,
      bars: revenuePoints.slice(-7).map((point) => ({ label: point.sort.slice(8), value: point.value })),
      href: "/insights?view=reports",
    };
  }, [performanceTab, inventoryState.metrics, books, revenueTotal, revenueDelta, revenuePoints]);

  const askText = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || aiLoading) return;
    setQuestion(trimmed);
    setAiLoading(true);
    setAiAnswer(null);
    try {
      const { askInsight } = await import("@/lib/api");
      const result = await askInsight(trimmed, {
        revenue: formatCurrency(books.totalRevenue),
        orders: salesState.metrics.totalOrders,
        products: inventoryState.metrics.totalProducts,
        low_stock: inventoryState.metrics.lowStockCount,
        organization: profile.organization,
        pending_orders: pendingOrders,
      });
      setAiAnswer(result.answer);
    } catch {
      setAiAnswer(
        `${profile.organization || "This workspace"} has ${inventoryState.metrics.totalProducts} products, ${salesState.metrics.totalOrders} orders, and ${formatCurrency(books.totalRevenue)} in recorded revenue.`
      );
    } finally {
      setAiLoading(false);
    }
  };

  const handleSearchSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const query = searchQuery.trim().toLowerCase();
    if (!query) return;
    if (query.includes("stock") || query.includes("inventory") || query.includes("sku") || query.includes("product")) {
      router.push("/inventory");
      return;
    }
    if (query.includes("sale") || query.includes("order")) {
      router.push("/sales");
      return;
    }
    if (query.includes("account") || query.includes("invoice") || query.includes("ledger")) {
      router.push("/accounting");
      return;
    }
    if (query.includes("customer")) {
      router.push("/customers");
      return;
    }
    if (query.includes("supplier") || query.includes("partner") || query.includes("purchase")) {
      router.push("/suppliers");
      return;
    }
    if (query.includes("insight") || query.includes("report") || query.includes("forecast")) {
      router.push("/insights");
    }
  };

  const onPermission = async (functionId: string, mode: AutomationMode) => {
    const next = { ...modes, [functionId]: mode };
    setModes(next);
    setPermissionSaving(true);
    setPermissionError(null);
    try {
      const saved = await saveOnboardingAutomations(
        AUTOMATION_DEFS.map((def) => ({ function_id: def.id, mode: next[def.id] || "off" }))
      );
      setOnboarding(saved);
      if (functionId === "reconcile") {
        accountingStore.updateProfile({ autoReconciliation: mode === "automatic" });
      }
    } catch (error) {
      setPermissionError(error instanceof Error ? error.message : "Unable to save this permission.");
    } finally {
      setPermissionSaving(false);
    }
  };

  const nextStep = nextOpenStep(setupSteps);
  const getStartedHref = setupStepHref(nextStep?.id);
  const openSetup = (startId?: string) => {
    const targetId = (startId || nextStep?.id || "business") as SetupStepId;
    startSetupFlow();
    window.dispatchEvent(new Event("kpm-setup-change"));
    if (targetId === "business") {
      setGuideStart("business");
      setGuideOpen(true);
      return;
    }
    router.push(setupStepHref(targetId));
  };

  return (
    <AppShell
      maxWidthClassName="max-w-[1440px]"
      searchPlaceholder="Search products, orders, customers, reports..."
      searchValue={searchQuery}
      onSearchChange={setSearchQuery}
      onSearchSubmit={handleSearchSubmit}
      onGetStarted={() => openSetup()}
      notifications={(profile.notificationsEnabled ? activities.slice(0, 3) : []).map((item) => ({
        id: `acct-${item.id}`,
        title: item.title,
        subtitle: item.subtitle,
        time: item.time,
      }))}
      onNotificationClick={(id) => {
        const match = feed.find((item) => item.id === id);
        if (match) setSelected(match);
        else setActivityOpen(true);
      }}
    >
      <div className="space-y-5">
        {authUser && authUser.email_verified === false && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 flex flex-wrap items-center justify-between gap-3">
            <span>Confirm {authUser.email} so password resets and invites reach you.</span>
            <button
              type="button"
              className="rounded-full bg-[#0F172A] px-3 py-1.5 text-xs font-semibold text-white"
              onClick={() => {
                void import("@/lib/api").then(({ resendVerificationEmail }) => resendVerificationEmail());
              }}
            >
              Resend email
            </button>
          </div>
        )}
        <WelcomeBanner
          title={greeting}
          dateLabel={formatLongDate(now)}
          timeLabel={formatTime(now)}
          workspace={workspaceName}
          onTour={() => setTourOpen(true)}
          range={range}
          onRange={setRange}
        />

        <section id="get-started" className="flex flex-col gap-3 rounded-[20px] border border-[var(--app-border)] bg-[var(--app-surface)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold text-[var(--app-ink)]">Get started with KPM</h2>
            <p className="mt-0.5 text-[13px] text-[var(--app-muted)]">
              Set up your business, add products, connect sales and start managing everything in one place.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <span className="text-[12px] tabular-nums text-[var(--app-muted)]">
              {setupSteps.filter((step) => step.done).length} of {setupSteps.length} complete
            </span>
            <button
              type="button"
              onClick={() => openSetup()}
              className="inline-flex h-9 items-center rounded-full bg-[var(--app-nav-active-bg)] px-3.5 text-[13px] font-medium text-[var(--app-nav-active)] shadow-[var(--app-shadow-xs)] transition-opacity duration-160 hover:opacity-90"
            >
              Get Started
            </button>
          </div>
        </section>

        {booksError ? <SectionError onRetry={() => void refreshBooks()} /> : null}

        {booting ? <DashboardSkeleton /> : null}

        {!booting ? (
          <>
            <section className="grid grid-cols-1 divide-y divide-[var(--app-border)] overflow-hidden rounded-[20px] border border-[var(--app-border)] bg-[var(--app-surface)] sm:grid-cols-2 sm:divide-x xl:grid-cols-4" aria-label="Key metrics">
              <KpiCard
                icon={Wallet}
                label="Total Revenue"
                value={formatCurrency(revenueTotal)}
                delta={revenueDelta}
                hint={revenueHint}
                tone="blue"
                sparkline={revenuePoints.map((point) => point.value)}
              />
              <KpiCard
                icon={ShoppingBag}
                label="Pending Orders"
                value={pendingOrders.toLocaleString()}
                delta={dayChange.previousCount > 0 ? dayChange.countDelta : null}
                hint={
                  dayChange.previousCount > 0
                    ? "vs. yesterday"
                    : pendingOrders > 0
                      ? "Open right now"
                      : "No orders yet"
                }
                tone="orange"
                meter={salesState.orders.length > 0 ? Math.round((pendingOrders / salesState.orders.length) * 100) : 0}
                sparkline={orderCountPoints.map((point) => point.value)}
              />
              <KpiCard
                icon={Boxes}
                label="Low Stock Items"
                value={inventoryState.metrics.lowStockCount.toLocaleString()}
                delta={null}
                hint={inventoryState.metrics.lowStockCount > 0 ? "Needs attention" : "None"}
                warning={inventoryState.metrics.lowStockCount > 0}
                tone="violet"
                meter={
                  inventoryState.metrics.totalProducts > 0
                    ? Math.round((inventoryState.metrics.lowStockCount / inventoryState.metrics.totalProducts) * 100)
                    : 0
                }
              />
              <KpiCard
                icon={AlertTriangle}
                label="Active Alerts"
                value={String(activeAlerts)}
                delta={null}
                hint={activeAlerts > 0 ? "Needs attention" : "None"}
                warning={activeAlerts > 0}
                tone="slate"
                meter={activeAlerts > 0 ? 100 : 0}
              />
            </section>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(280px,0.82fr)]">
              <div className="space-y-4">
                <RevenueChart
                  points={revenuePoints}
                  counts={ordersInRange.map((point) => point.value)}
                  range={range}
                  onRange={setRange}
                  customStart={customStart}
                  customEnd={customEnd}
                  onCustomStart={setCustomStart}
                  onCustomEnd={setCustomEnd}
                />
                <QuickActions />
              </div>
              <div className="space-y-4">
                <AIAssistant
                  question={question}
                  answer={aiAnswer}
                  loading={aiLoading}
                  onQuestion={setQuestion}
                  onAsk={(event) => {
                    event.preventDefault();
                    void askText(question);
                  }}
                  onPrompt={(prompt) => void askText(prompt)}
                />
                <StockMix
                  inStock={inventoryState.metrics.inStockCount}
                  low={inventoryState.metrics.lowStockCount}
                  out={inventoryState.metrics.outOfStockCount}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
              <RecentActivity items={visibleFeed.slice(0, 5)} onOpen={setSelected} onViewAll={() => setActivityOpen(true)} />
              <BusinessPerformance
                tab={performanceTab}
                onTab={setPerformanceTab}
                valueLabel={performance.valueLabel}
                value={performance.value}
                delta={performance.delta}
                bars={performance.bars}
                href={performance.href}
              />
              <div className="space-y-4">
                <AISuggestions
                  items={suggestionCards}
                  loading={suggestionsLoading}
                  error={suggestionsError}
                  onRetry={() => void refreshSuggestions()}
                />
                <AutomationPermissions
                  modes={modes}
                  paused={setup.paused}
                  saving={permissionSaving}
                  error={permissionError}
                  onChange={(functionId, mode) => void onPermission(functionId, mode)}
                  onTogglePause={() => persist({ ...setup, paused: !setup.paused })}
                />
              </div>
            </div>
            {nextStep ? <GetStartedBar steps={setupSteps} href={getStartedHref} onGetStarted={() => openSetup(nextStep.id)} /> : null}
          </>
        ) : null}
      </div>

      {onboardingReady ? <OnboardingTour open={tourOpen} onClose={() => void finishTour()} /> : null}
      <GuidedSetup
        open={guideOpen}
        onClose={() => setGuideOpen(false)}
        steps={setupSteps}
        startId={guideStart}
        profile={onboarding?.profile ?? null}
        fallbackName={workspaceName}
        fallbackType={authUser?.business_type || ""}
        onSaved={setOnboarding}
      />

      {activityOpen ? (
        <Dialog title="Recent activity" onClose={() => setActivityOpen(false)}>
          <div className="max-h-80 space-y-2 overflow-y-auto">
            {visibleFeed.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setActivityOpen(false);
                  setSelected(item);
                }}
                className="block w-full rounded-lg px-2 py-2 text-left hover:bg-[var(--app-hover)]"
              >
                <div className="text-sm font-semibold">{item.title}</div>
                <div className="text-xs text-[var(--app-muted)]">
                  {item.detail} · {item.time}
                </div>
              </button>
            ))}
            {visibleFeed.length === 0 ? <p className="px-2 py-4 text-sm text-[var(--app-muted)]">No matching activity.</p> : null}
          </div>
        </Dialog>
      ) : null}

      {selected ? (
        <Dialog title={selected.title} onClose={() => setSelected(null)}>
          <p className="text-sm text-[var(--app-muted)]">{selected.detail}</p>
          <p className="mt-2 text-sm">
            {selected.badge} · {selected.time}
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setSelected(null)}>
              Close
            </Button>
            <Button href={selected.href} size="sm">
              Open record
            </Button>
          </div>
        </Dialog>
      ) : null}
    </AppShell>
  );
}
