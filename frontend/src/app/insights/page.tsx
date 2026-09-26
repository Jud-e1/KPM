"use client";

import React, { startTransition, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  Headphones,
  MessageSquare,
  Send,
  ShieldAlert,
  TrendingUp,
  X,
} from "lucide-react";
import { accountingStore, AccountingState } from "@/lib/accountingStore";
import { AppShell } from "@/components/AppShell";
import { inventoryStore, InventoryState } from "@/lib/inventoryStore";
import { salesStore, SalesState } from "@/lib/salesStore";
import {
  AiReport,
  buildForecastSeriesFromDaily,
  buildStockMovementFromProducts,
  InsightsState,
  insightsStore,
} from "@/lib/insightsStore";
import { updateAccountingProfile, fetchForecastSeries, type ForecastPoint as ApiForecastPoint } from "@/lib/api";
import { EmptyState } from "@/components/EmptyState";
import { MlSuggestionsPanel } from "@/components/MlSuggestionsPanel";
import { PageHeader } from "@/components/ui/PageHeader";
import { MetricStrip } from "@/components/ui/MetricStrip";
import { Button } from "@/components/ui/Button";

const formatCurrency = (amount: number) =>
  `$${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function firstName(fullName: string) {
  return fullName.trim().split(/\s+/)[0] || "there";
}

type SectionId = "overview" | "forecasting" | "anomaly" | "fraud" | "nlq";

const consumedInsightQueries = new Set<string>();

const SUGGESTED_PROMPTS = [
  "Show me sales trends this month",
  "Which products are low on stock?",
  "Why did my profit margin change?",
  "Flag unusual accounting activity",
];

export default function InsightsPage() {
  const [accountingState, setAccountingState] = useState<AccountingState>(accountingStore.getState());
  const [inventoryState, setInventoryState] = useState<InventoryState>(inventoryStore.getState());
  const [salesState, setSalesState] = useState<SalesState>(salesStore.getState());
  const [insightsState, setInsightsState] = useState<InsightsState>(insightsStore.getState());
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSection, setActiveSection] = useState<SectionId>("overview");
  const [hoverForecastDay, setHoverForecastDay] = useState<number | null>(28);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiProvider, setAiProvider] = useState<"openai" | "rules" | null>(null);
  const [insightSetup, setInsightSetup] = useState<string | null>(null);
  const [apiForecast, setApiForecast] = useState<ApiForecastPoint[]>([]);
  const [toolTrace, setToolTrace] = useState<string | null>(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [profileForm, setProfileForm] = useState(accountingStore.getState().profile);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const forecastRef = useRef<HTMLDivElement>(null);
  const inventoryRef = useRef<HTMLDivElement>(null);
  const assistantRef = useRef<HTMLDivElement>(null);
  const submitPromptRef = useRef<(prompt: string) => Promise<void>>(async () => undefined);

  useEffect(() => {
    const unsubAccounting = accountingStore.subscribe((state) => {
      startTransition(() => setAccountingState(state));
    });
    const unsubInventory = inventoryStore.subscribe((state) => {
      startTransition(() => setInventoryState(state));
    });
    const unsubSales = salesStore.subscribe((state) => {
      startTransition(() => setSalesState(state));
    });
    const unsubInsights = insightsStore.subscribe((state) => {
      startTransition(() => setInsightsState(state));
    });
    const disconnectAccounting = accountingStore.connectLive();
    const disconnectSales = salesStore.connectLive();
    const disconnectInventory = inventoryStore.connectLive();
    return () => {
      unsubAccounting();
      unsubInventory();
      unsubSales();
      unsubInsights();
      disconnectAccounting();
      disconnectSales();
      disconnectInventory();
    };
  }, []);

  useEffect(() => {
    insightsStore.ensureGreeting(firstName(accountingState.profile.fullName));
  }, [accountingState.profile.fullName]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const question = params.get("q");
    if (!question) return;
    const nonce = params.get("n") || question;
    params.delete("q");
    params.delete("n");
    const rest = params.toString();
    window.history.replaceState(null, "", rest ? `/insights?${rest}` : "/insights");
    if (consumedInsightQueries.has(nonce)) return;
    consumedInsightQueries.add(nonce);
    void submitPromptRef.current(question);
    assistantRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  useEffect(() => {
    void import("@/lib/api").then(({ fetchInsightProvider }) =>
      fetchInsightProvider().then((info) => {
        setAiProvider(info.provider === "openai" ? "openai" : "rules");
        if (info.provider !== "openai") {
          setInsightSetup(
            "OPENAI_API_KEY is not set — answers use the rules engine. Add OPENAI_API_KEY (and optional OPENAI_MODEL) to enable OpenAI."
          );
        } else {
          setInsightSetup(null);
        }
      })
    );
  }, []);

  useEffect(() => {
    void fetchForecastSeries({ days: 14 })
      .then((points) => setApiForecast(points))
      .catch(() => setApiForecast([]));
  }, [salesState.orders.length, inventoryState.products.length]);

  useEffect(() => {
    if (isProfileOpen) setProfileForm(accountingState.profile);
  }, [isProfileOpen, accountingState.profile]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [insightsState.messages.length, aiLoading]);

  const { profile, metrics: accountingMetrics, activities } = accountingState;
  const profitMargin = useMemo(() => {
    if (accountingMetrics.totalRevenue <= 0) return 0;
    return Number(((accountingMetrics.netProfit / accountingMetrics.totalRevenue) * 100).toFixed(1));
  }, [accountingMetrics.netProfit, accountingMetrics.totalRevenue]);
  const stockValue = inventoryState.metrics.totalStockValue;

  const lowStockProducts = useMemo(
    () => inventoryState.products.filter((product) => product.status === "Low Stock" || product.status === "Out of Stock"),
    [inventoryState.products]
  );
  const overstockedProducts = useMemo(
    () => inventoryState.products.filter((product) => product.stock > (product.lowStockThreshold || 15) * 6),
    [inventoryState.products]
  );
  const fastMoving = useMemo(
    () => salesState.metrics.topProducts.slice(0, 3),
    [salesState.metrics.topProducts]
  );
  const slowMoving = useMemo(
    () =>
      inventoryState.products
        .filter((product) => product.status === "In Stock" && product.stock > 40)
        .slice(0, 2),
    [inventoryState.products]
  );
  const pendingTransactions = useMemo(
    () => accountingState.transactions.filter((transaction) => transaction.status === "Pending").length,
    [accountingState.transactions]
  );

  const apiForecastIsLive = useMemo(
    () => apiForecast.length > 0 && apiForecast.some((pt) => pt.method !== "cold_start"),
    [apiForecast]
  );

  const forecast = useMemo(() => {
    if (apiForecastIsLive) {
      const byDate = new Map<string, number>();
      for (const pt of apiForecast) {
        if (pt.method === "cold_start") continue;
        byDate.set(pt.date, (byDate.get(pt.date) || 0) + pt.demand);
      }
      const sorted = [...byDate.entries()].sort((a, b) => a[0].localeCompare(b[0]));
      return sorted.map(([dayKey, demand], index) => {
        const d = new Date(dayKey + "T00:00:00");
        const label = Number.isNaN(d.getTime())
          ? dayKey
          : new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(d);
        return {
          label,
          day: index + 1,
          actual: null as number | null,
          predicted: Number(demand.toFixed(2)),
          unit: "units" as const,
        };
      });
    }
    const byDay = new Map<string, { dayKey: string; label: string; amount: number }>();
    for (const order of salesState.orders) {
      if (order.status === "Cancelled" || !order.timestamp) continue;
      const d = new Date(order.timestamp);
      if (Number.isNaN(d.getTime())) continue;
      const dayKey = d.toISOString().slice(0, 10);
      const label = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(d);
      const prev = byDay.get(dayKey);
      byDay.set(dayKey, {
        dayKey,
        label,
        amount: (prev?.amount || 0) + order.totalAmount,
      });
    }
    if (byDay.size < 2) return [];
    return buildForecastSeriesFromDaily([...byDay.values()]).map((point) => ({ ...point, unit: "currency" as const }));
  }, [apiForecastIsLive, apiForecast, salesState.orders]);
  const forecastUnit = forecast[0]?.unit || "currency";
  const formatForecastValue = (value: number) =>
    forecastUnit === "units"
      ? `${value.toLocaleString(undefined, { maximumFractionDigits: 1 })} units`
      : formatCurrency(value);
  const stockMovement = useMemo(
    () => buildStockMovementFromProducts(inventoryState.products),
    [inventoryState.products]
  );
  const activeForecast =
    forecast.find((point) => point.day === (hoverForecastDay || forecast.length)) ||
    forecast[forecast.length - 1] ||
    null;

  const topInsights = useMemo(() => {
    const items: Array<{
      id: string;
      title: string;
      description: string;
      tone: "demand" | "warning" | "fraud" | "success" | "info";
    }> = [];
    const topProduct = [...inventoryState.products].sort((a, b) => b.stock * b.price - a.stock * a.price)[0];
    if (topProduct) {
      items.push({
        id: "insight-demand",
        title: `Watch ${topProduct.name}`,
        description: `Highest stock value SKU (${topProduct.sku}) at ${topProduct.stock} units.`,
        tone: "demand",
      });
    }
    if (inventoryState.metrics.lowStockCount > 0) {
      const low = inventoryState.products.find(
        (p) => p.status === "Low Stock" || (p.lowStockThreshold != null && p.stock <= p.lowStockThreshold)
      );
      items.push({
        id: "insight-low",
        title: "Low stock alert",
        description: low
          ? `${low.name} (${low.sku}) at ${low.stock} units.`
          : `${inventoryState.metrics.lowStockCount} products need attention.`,
        tone: "warning",
      });
    }
    if (pendingTransactions > 0) {
      items.push({
        id: "insight-fraud",
        title: "Pending transactions",
        description: `${pendingTransactions} transaction${pendingTransactions === 1 ? "" : "s"} awaiting clearance.`,
        tone: "fraud",
      });
    }
    if (accountingMetrics.totalRevenue > 0 || accountingMetrics.netProfit !== 0) {
      items.push({
        id: "insight-margin",
        title: "Profit snapshot",
        description: `Margin is ${profitMargin}% with net profit ${formatCurrency(accountingMetrics.netProfit)}.`,
        tone: "success",
      });
    }
    return items.slice(0, 4);
  }, [
    inventoryState.products,
    inventoryState.metrics.lowStockCount,
    pendingTransactions,
    profitMargin,
    accountingMetrics.netProfit,
    accountingMetrics.totalRevenue,
  ]);

  const filteredInsights = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return topInsights;
    return topInsights.filter(
      (insight) => insight.title.toLowerCase().includes(query) || insight.description.toLowerCase().includes(query)
    );
  }, [searchQuery, topInsights]);

  const scrollToSection = (section: SectionId) => {
    setActiveSection(section);
    const map: Record<SectionId, HTMLDivElement | null | undefined> = {
      overview: null,
      forecasting: forecastRef.current,
      anomaly: inventoryRef.current,
      fraud: inventoryRef.current,
      nlq: assistantRef.current,
    };
    if (section === "overview") {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    map[section]?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const answerQuestion = (question: string) => {
    const q = question.toLowerCase();
    if (q.includes("sales") || q.includes("trend") || q.includes("forecast")) {
      const forecastNote = activeForecast
        ? ` Latest day ${activeForecast.label}: ${formatForecastValue(activeForecast.predicted)} predicted.`
        : " Add sales across multiple days to unlock a forecast.";
      return `Sales are tracking ${formatCurrency(accountingMetrics.totalRevenue)} this period with ${salesState.metrics.totalOrders} orders.${forecastNote}`;
    }
    if (q.includes("stock") || q.includes("inventory") || q.includes("low")) {
      return `Inventory health: ${inventoryState.metrics.lowStockCount} low-stock items, ${overstockedProducts.length} overstocked, and ${inventoryState.metrics.totalProducts} total SKUs.`;
    }
    if (q.includes("profit") || q.includes("margin") || q.includes("financ")) {
      return `${profile.organization || "Your workspace"} margin is ${profitMargin}% (net ${formatCurrency(accountingMetrics.netProfit)}). Cash on books: ${formatCurrency(accountingMetrics.cashBalance)}.`;
    }
    if (q.includes("fraud") || q.includes("anomal") || q.includes("risk")) {
      return `There ${pendingTransactions === 1 ? "is" : "are"} ${pendingTransactions} pending transaction${pendingTransactions === 1 ? "" : "s"} to review in accounting.`;
    }
    return `For ${profile.organization || "your workspace"}: revenue ${formatCurrency(accountingMetrics.totalRevenue)}, stock value ${formatCurrency(stockValue)}, and ${inventoryState.metrics.lowStockCount} low-stock alerts. Ask about sales, stock, margin, or fraud.`;
  };

  const submitPrompt = async (prompt: string) => {
    const trimmed = prompt.trim();
    if (!trimmed || aiLoading) return;
    setAiLoading(true);
    setAiPrompt("");
    try {
      const { askInsight } = await import("@/lib/api");
      const result = await askInsight(trimmed, {
        revenue: formatCurrency(accountingMetrics.totalRevenue),
        orders: salesState.metrics.totalOrders,
        products: inventoryState.metrics.totalProducts,
        low_stock: inventoryState.metrics.lowStockCount,
        organization: profile.organization,
        profit_margin: `${profitMargin}%`,
      });
      setAiProvider(result.provider);
      if (result.tool_trace?.length) {
        setToolTrace(result.tool_trace.map((t) => t.tool).join(" → "));
      } else {
        setToolTrace(null);
      }
      insightsStore.ask(trimmed, result.answer);
    } catch {
      setAiProvider("rules");
      setToolTrace(null);
      insightsStore.ask(trimmed, answerQuestion(trimmed));
    } finally {
      setAiLoading(false);
      setActiveSection("nlq");
    }
  };

  submitPromptRef.current = submitPrompt;

  const exportReport = (report: AiReport) => {
    const rows =
      report.title.includes("Inventory")
        ? [
            ["Metric", "Value"],
            ["Low Stock", String(inventoryState.metrics.lowStockCount)],
            ["Overstocked", String(overstockedProducts.length)],
            ["Fast Moving", String(fastMoving.length)],
            ["Slow Moving", String(slowMoving.length)],
          ]
        : report.title.includes("Profit")
        ? [
            ["Metric", "Value"],
            ["Revenue", formatCurrency(accountingMetrics.totalRevenue)],
            ["Expenses", formatCurrency(accountingMetrics.totalExpenses)],
            ["Net Profit", formatCurrency(accountingMetrics.netProfit)],
            ["Profit Margin", `${profitMargin}%`],
          ]
        : [
            ["Metric", "Value"],
            ["Revenue", formatCurrency(accountingMetrics.totalRevenue)],
            ["Orders", String(salesState.metrics.totalOrders)],
            ["Net Profit", formatCurrency(accountingMetrics.netProfit)],
            ["Stock Value", formatCurrency(stockValue)],
          ];
    const csv = insightsStore.exportReportCsv(report, rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${report.title.toLowerCase().replaceAll(" ", "_")}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const exportAll = () => {
    insightsState.reports.forEach((report, index) => {
      window.setTimeout(() => exportReport(report), index * 120);
    });
  };

  const saveProfile = async (event: React.FormEvent) => {
    event.preventDefault();
    accountingStore.updateProfile(profileForm);
    try {
      await updateAccountingProfile({
        full_name: profileForm.fullName,
        role: profileForm.role,
        organization: profileForm.organization,
        auto_reconciliation: profileForm.autoReconciliation,
        notifications_enabled: profileForm.notificationsEnabled,
      });
    } catch {
      void accountingStore.syncFromBackend(true);
    }
    setIsProfileOpen(false);
  };

  const reorderTarget = lowStockProducts[0] || inventoryState.products[0];

  const forecastPath = (key: "actual" | "predicted") => {
    if (forecast.length < 2) return "";
    const values = forecast.map((point) => (key === "actual" ? point.actual : point.predicted));
    const max = Math.max(...forecast.map((point) => point.predicted), 1);
    const denom = Math.max(forecast.length - 1, 1);
    const coords = values
      .map((value, index) => {
        if (value === null) return null;
        const x = (index / denom) * 560;
        const y = 150 - (value / max) * 120;
        return `${x},${y}`;
      })
      .filter(Boolean) as string[];
    return coords.map((coord, index) => `${index === 0 ? "M" : "L"} ${coord}`).join(" ");
  };

  const hoverX = activeForecast
    ? ((activeForecast.day - 1) / Math.max(forecast.length - 1, 1)) * 560
    : 0;
  const hoverY = activeForecast
    ? 150 - (activeForecast.predicted / Math.max(...forecast.map((point) => point.predicted), 1)) * 120
    : 75;

  const sectionTabs = [
    { id: "overview" as const, label: "Overview" },
    { id: "forecasting" as const, label: "Forecasting" },
    { id: "anomaly" as const, label: "Anomaly" },
    { id: "fraud" as const, label: "Review" },
    { id: "nlq" as const, label: "Assistant" },
  ];

  return (
    <AppShell
      searchPlaceholder="Search insights, products, transactions…"
      searchValue={searchQuery}
      onSearchChange={setSearchQuery}
      maxWidthClassName="max-w-[1360px]"
    >
      <PageHeader
        title="Insights"
        description={
          filteredInsights.length > 0
            ? `${filteredInsights.length} ${filteredInsights.length === 1 ? "signal needs" : "signals need"} a look.`
            : `Forecasts and stock signals for ${profile.organization || "your workspace"}.`
        }
        actions={
          <Button type="button" onClick={exportAll}>
            <Download className="w-3.5 h-3.5" />
            Export Report
          </Button>
        }
      />

      <MlSuggestionsPanel title="Flags and suggestions" />

      <div className="kpm-tabs">
        {sectionTabs.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => scrollToSection(item.id)}
            className={`px-3 py-1.5 rounded-[var(--app-radius-control)] text-[13px] font-medium cursor-pointer ${
              activeSection === item.id
                ? "border border-[var(--app-border-strong)] bg-[var(--app-surface)] text-[var(--app-ink)]"
                : "text-[var(--app-muted)] hover:bg-[var(--app-hover)]"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <MetricStrip
        items={[
          { label: "Total Revenue", value: formatCurrency(accountingMetrics.totalRevenue) },
          { label: "Profit Margin", value: `${profitMargin}%` },
          { label: "Stock Value", value: formatCurrency(stockValue) },
          { label: "Net Profit", value: formatCurrency(accountingMetrics.netProfit) },
        ]}
      />

      <section className="grid grid-cols-1 xl:grid-cols-12 gap-3.5">
        <div ref={forecastRef} className="xl:col-span-6 rounded-[var(--app-radius)] bg-[var(--app-surface)] border border-[var(--app-border)] p-4">
          <div className="flex items-start justify-between border-b border-[var(--app-border)] pb-3">
            <div>
              <h2 className="text-sm font-semibold text-[var(--app-ink)]">Sales Forecast</h2>
              <p className="text-[13px] text-[var(--app-muted)] mt-1">
                {apiForecastIsLive
                  ? "Demand forecast in units from your sales history."
                  : "Revenue by day from recorded sales (needs at least two days)."}
              </p>
            </div>
            <div className="flex gap-3 text-[13px] text-[var(--app-muted)]">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[var(--app-ink)]" /> Actual</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[var(--app-faint)]" /> Predicted</span>
            </div>
          </div>
          <div className="relative h-52 pt-3">
            {forecast.length < 2 ? (
              <EmptyState
                title="Not enough sales history"
                description="Record sales on at least two different days to see actual vs predicted trends."
              />
            ) : (
              <>
                <svg
                  className="w-full h-full"
                  viewBox="0 0 560 165"
                  preserveAspectRatio="none"
                  onMouseLeave={() => setHoverForecastDay(forecast.length)}
                >
                  {[0, 30, 60, 90, 120, 150].map((y) => (
                    <line key={y} x1="0" x2="560" y1={y} y2={y} stroke="var(--app-border)" />
                  ))}
                  <path d={forecastPath("predicted")} fill="none" stroke="var(--app-faint)" strokeWidth="2" strokeDasharray="5 4" />
                  <path d={forecastPath("actual")} fill="none" stroke="var(--app-ink)" strokeWidth="2.2" />
                  {forecast.map((point) => {
                    const x = ((point.day - 1) / Math.max(forecast.length - 1, 1)) * 560;
                    return (
                      <rect
                        key={point.day}
                        x={x - 8}
                        y={0}
                        width={16}
                        height={165}
                        fill="transparent"
                        className="cursor-pointer"
                        onMouseEnter={() => setHoverForecastDay(point.day)}
                      />
                    );
                  })}
                  {activeForecast ? (
                    <circle cx={hoverX} cy={hoverY} r="4.5" fill="var(--app-ink)" stroke="white" strokeWidth="2" />
                  ) : null}
                </svg>
                {activeForecast ? (
                  <div
                    className="absolute pointer-events-none bg-[var(--app-nav-active-bg)] text-[var(--app-nav-active)] text-[13px] rounded-[var(--app-radius-control)] px-2.5 py-1.5 shadow-[var(--app-shadow-pop)]"
                    style={{ left: `clamp(8px, calc(${(activeForecast.day / Math.max(forecast.length, 1)) * 100}% - 40px), calc(100% - 110px))`, top: 18 }}
                  >
                    <div className="font-semibold">{activeForecast.label}</div>
                    <div className="text-[var(--app-nav-active)]/70">{formatForecastValue(activeForecast.predicted)} (predicted)</div>
                  </div>
                ) : null}
              </>
            )}
          </div>
          <div className="flex justify-between text-xs text-[var(--app-muted)] px-1">
            {forecast.length >= 2 ? (
              <>
                <span>{forecast[0].label}</span>
                <span>{forecast[Math.floor(forecast.length / 2)].label}</span>
                <span>{forecast[forecast.length - 1].label}</span>
              </>
            ) : (
              <span>Waiting for sales history</span>
            )}
          </div>
        </div>

        <div className="xl:col-span-3 rounded-[var(--app-radius)] bg-[var(--app-surface)] border border-[var(--app-border)] p-4">
          <div className="flex items-center justify-between border-b border-[var(--app-border)] pb-3">
            <h2 className="text-sm font-semibold text-[var(--app-ink)]">Top Insights</h2>
            <span className="text-[13px] text-[var(--app-muted)]">{filteredInsights.length} live</span>
          </div>
          <div className="pt-3 space-y-3">
            {filteredInsights.length === 0 ? (
              <EmptyState
                title="No insights yet"
                description="Add products, sales, or transactions so KPM can surface live recommendations."
              />
            ) : null}
            {filteredInsights.map((insight) => {
              const Icon =
                insight.tone === "warning" ? AlertTriangle :
                insight.tone === "fraud" ? ShieldAlert :
                insight.tone === "success" ? CheckCircle2 :
                TrendingUp;
              const tone =
                insight.tone === "warning" ? "bg-[var(--app-critical-bg)] text-[var(--app-critical)]" :
                insight.tone === "fraud" ? "bg-[var(--app-warning-bg)] text-[var(--app-warning)]" :
                insight.tone === "success" ? "bg-[var(--app-positive-bg)] text-[var(--app-positive)]" :
                "bg-[var(--app-hover)] text-[var(--app-ink)]";
              const action =
                insight.tone === "warning" ? "Review inventory" :
                insight.tone === "fraud" ? "Review activity" :
                insight.tone === "demand" ? "Review forecast" :
                "Review insight";
              return (
                <article
                  key={insight.id}
                  className="rounded-[var(--app-radius-control)] border border-[var(--app-border)] p-3"
                >
                  <div className="flex items-start gap-2.5">
                    <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--app-radius-control)] ${tone}`}>
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold uppercase tracking-wide text-[var(--app-faint)]">What</p>
                      <p className="text-[13px] font-semibold leading-snug text-[var(--app-ink)]">{insight.title}</p>
                      <p className="mt-2 text-[13px] font-semibold uppercase tracking-wide text-[var(--app-faint)]">Why it matters</p>
                      <p className="text-[12px] leading-snug text-[var(--app-muted)]">{insight.description}</p>
                      <button
                        type="button"
                        onClick={() => scrollToSection(insight.tone === "fraud" ? "fraud" : insight.tone === "warning" ? "anomaly" : "forecasting")}
                        className="mt-2 cursor-pointer text-[12px] font-semibold text-[var(--app-accent)] hover:underline"
                      >
                        {action} →
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>

        <div ref={assistantRef} className="xl:col-span-3 rounded-[var(--app-radius)] bg-[var(--app-surface)] border border-[var(--app-border)] p-4 flex flex-col min-h-[320px]">
          <div className="flex items-center gap-2 border-b border-[var(--app-border)] pb-3">
            <span className="w-7 h-7 rounded-[var(--app-radius-control)] bg-[var(--app-hover)] text-[var(--app-ink)] flex items-center justify-center">
              <MessageSquare className="w-3.5 h-3.5" />
            </span>
            <div>
              <h2 className="text-sm font-semibold text-[var(--app-ink)] flex items-center gap-2">
                Insights Assistant
                {aiProvider && (
                  <span className="text-xs uppercase tracking-wide font-semibold px-1.5 py-0.5 rounded bg-[var(--app-hover)] text-[var(--app-muted)] border border-[var(--app-border)]">
                    {aiProvider}
                  </span>
                )}
              </h2>
              <p className="text-[13px] text-[var(--app-muted)]">
                {insightSetup ||
                  (toolTrace
                    ? `Tools: ${toolTrace}`
                    : apiForecast.length
                      ? "Forecast from API · OpenAI tools when configured"
                      : "OpenAI when configured, rules fallback from live data")}
              </p>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto space-y-2.5 py-3 max-h-52">
            {insightsState.messages.slice(-6).map((message) => (
              <div
                key={message.id}
                className={`text-[13px] leading-relaxed rounded-[var(--app-radius-control)] px-3 py-2 ${
                  message.role === "assistant"
                    ? "bg-[var(--app-hover)] text-[var(--app-ink)]"
                    : "bg-[var(--app-nav-active-bg)] text-[var(--app-nav-active)] ml-6"
                }`}
              >
                {message.content}
              </div>
            ))}
            {aiLoading && <div className="text-[13px] text-[var(--app-muted)] px-1">Thinking…</div>}
            <div ref={chatEndRef} />
          </div>
          <div className="flex flex-wrap gap-1.5 pb-2">
            {SUGGESTED_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => submitPrompt(prompt)}
                className="px-2.5 py-1 rounded-[var(--app-radius-control)] border border-[var(--app-border)] text-[9.5px] font-medium text-[var(--app-muted)] hover:bg-[var(--app-hover)] cursor-pointer"
              >
                {prompt}
              </button>
            ))}
          </div>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              submitPrompt(aiPrompt);
            }}
            className="flex items-center gap-2"
          >
            <input
              value={aiPrompt}
              onChange={(event) => setAiPrompt(event.target.value)}
              placeholder="Ask a question..."
              className="flex-1 px-3 py-2 rounded-[var(--app-radius-control)] bg-[var(--app-hover)] border border-[var(--app-border)] text-[13px] outline-none focus:bg-[var(--app-surface)] focus:border-[var(--app-border-strong)]"
            />
            <button
              type="submit"
              disabled={aiLoading || !aiPrompt.trim()}
              className="w-8 h-8 rounded-[var(--app-radius-control)] bg-[var(--app-nav-active-bg)] text-[var(--app-nav-active)] flex items-center justify-center cursor-pointer disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-12 gap-3.5">
        <div ref={inventoryRef} className="xl:col-span-8 rounded-[var(--app-radius)] bg-[var(--app-surface)] border border-[var(--app-border)] p-4 space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-[var(--app-ink)]">Inventory Insights</h2>
            <p className="text-[13px] text-[var(--app-muted)] mt-1">Live stock signals and recommended actions.</p>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
            {[
              { label: "Low Stock Items", value: inventoryState.metrics.lowStockCount || lowStockProducts.length, tone: "bg-[var(--app-critical-bg)] text-[var(--app-critical)] border-[var(--app-critical-border)]" },
              { label: "Overstocked Items", value: overstockedProducts.length, tone: "bg-[var(--app-hover)] text-[var(--app-ink)] border-[var(--app-border)]" },
              { label: "Fast Moving Products", value: fastMoving.length, tone: "bg-[var(--app-hover)] text-[var(--app-ink)] border-[var(--app-border)]" },
              { label: "Slow Moving Products", value: slowMoving.length, tone: "bg-[var(--app-warning-bg)] text-[var(--app-warning)] border-[var(--app-border)]" },
            ].map((tile) => (
              <div key={tile.label} className={`rounded-[var(--app-radius-control)] border px-3 py-2.5 ${tile.tone}`}>
                <div className="text-lg font-semibold leading-none tabular-nums">{tile.value}</div>
                <div className="text-[13px] font-medium mt-1 opacity-80">{tile.label}</div>
              </div>
            ))}
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold text-[var(--app-ink)]">Stock snapshot</h3>
              <div className="flex gap-3 text-[13px] text-[var(--app-muted)]">
                <span>● Healthy</span>
                <span className="text-[var(--app-faint)]">● Low / watch</span>
              </div>
            </div>
            <div className="h-36 flex items-end gap-3 px-1">
              {stockMovement.length === 0 ? (
                <p className="w-full self-center text-center text-[13px] text-[var(--app-muted)]">No products yet.</p>
              ) : (
                stockMovement.map((point) => (
                  <div key={point.label} className="flex-1 flex flex-col items-center gap-1">
                    <div className="w-full flex items-end justify-center gap-1 h-28">
                      <div className="w-2.5 rounded-t bg-[var(--app-ink)]" style={{ height: `${Math.min(100, point.inflow * 3.2)}%` }} />
                      <div className="w-2.5 rounded-t bg-[var(--app-faint)]" style={{ height: `${Math.min(100, point.outflow * 3.2)}%` }} />
                    </div>
                    <span className="text-[11px] text-[var(--app-muted)]">{point.label}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div>
            <h3 className="text-xs font-semibold text-[var(--app-ink)] mb-2">Recommended Actions</h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3 rounded-[var(--app-radius-control)] border border-[var(--app-border)] px-3 py-2.5">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="w-7 h-7 rounded-[var(--app-radius-control)] bg-[var(--app-hover)] flex items-center justify-center text-[var(--app-muted)]">
                    <Headphones className="w-3.5 h-3.5" />
                  </span>
                  <span className="text-[13px] font-semibold text-[var(--app-ink)] truncate">
                    Reorder {reorderTarget?.name || "low-stock items"}
                  </span>
                </div>
                <Link href="/inventory" className="text-[13px] font-semibold bg-[var(--app-nav-active-bg)] text-[var(--app-nav-active)] px-3 py-1.5 rounded-[var(--app-radius-control)] whitespace-nowrap">
                  Create Purchase Order
                </Link>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-[var(--app-radius-control)] border border-[var(--app-border)] px-3 py-2.5">
                <span className="text-[13px] font-semibold text-[var(--app-ink)]">Move slow-moving items to promotion</span>
                <Link href="/inventory" className="text-[13px] font-semibold border border-[var(--app-border)] px-3 py-1.5 rounded-[var(--app-radius-control)] whitespace-nowrap">
                  View Products
                </Link>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-[var(--app-radius-control)] border border-[var(--app-border)] px-3 py-2.5">
                <span className="text-[13px] font-semibold text-[var(--app-ink)]">Review supplier performance</span>
                <Link href="/suppliers" className="text-[13px] font-semibold border border-[var(--app-border)] px-3 py-1.5 rounded-[var(--app-radius-control)] whitespace-nowrap">
                  View Suppliers
                </Link>
              </div>
            </div>
          </div>
        </div>

        <div className="xl:col-span-4 rounded-[var(--app-radius)] bg-[var(--app-surface)] border border-[var(--app-border)] p-4">
          <div className="flex items-center justify-between border-b border-[var(--app-border)] pb-3">
            <h2 className="text-sm font-semibold text-[var(--app-ink)]">Recent Reports</h2>
            <button type="button" onClick={exportAll} className="text-[13px] text-[var(--app-ink)] font-semibold cursor-pointer">
              Export all
            </button>
          </div>
          <div className="pt-2 space-y-2">
            {insightsState.reports.length === 0 ? (
              <EmptyState
                title="No reports yet"
                description="Use Export Report above to download a CSV from your live books and inventory."
              />
            ) : (
              insightsState.reports.map((report) => (
              <div key={report.id} className="flex items-center justify-between gap-2 rounded-[var(--app-radius-control)] border border-[var(--app-border)] px-2.5 py-2.5 hover:bg-[var(--app-hover)]">
                <div className="min-w-0">
                  <div className="text-[13px] font-semibold text-[var(--app-ink)] truncate">{report.title}</div>
                  <div className="text-[9.5px] text-[var(--app-muted)] mt-0.5">{report.period}</div>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <span className="text-xs font-semibold text-[var(--app-muted)] border border-[var(--app-border)] rounded px-1.5 py-0.5">
                    {report.format}
                  </span>
                  <button
                    type="button"
                    onClick={() => exportReport(report)}
                    className="w-7 h-7 rounded-[var(--app-radius-control)] border border-[var(--app-border)] flex items-center justify-center text-[var(--app-muted)] hover:bg-[var(--app-surface)] cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              ))
            )}
          </div>

          <div className="mt-4 rounded-[var(--app-radius-control)] bg-[var(--app-hover)] border border-[var(--app-border)] p-3">
            <div className="text-[13px] font-semibold text-[var(--app-ink)] mb-2">Recent Activity</div>
            <div className="space-y-2">
              {activities.slice(0, 3).map((activity) => (
                <div key={activity.id} className="text-[13px]">
                  <div className="font-semibold text-[var(--app-ink)]">{activity.title}</div>
                  <div className="text-[var(--app-muted)]">{activity.subtitle || activity.time}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {isProfileOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/45 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[var(--app-surface)] rounded-[var(--app-radius)] shadow-[var(--app-shadow-pop)] border border-[var(--app-border)] p-6 text-xs">
            <div className="flex justify-between border-b border-[var(--app-border)] pb-3">
              <div>
                <h2 className="font-semibold text-base">Account Settings</h2>
                <p className="text-[var(--app-muted)] mt-0.5">Profile and automation preferences</p>
              </div>
              <button type="button" onClick={() => setIsProfileOpen(false)} className="text-[var(--app-muted)] cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={saveProfile} className="space-y-3 pt-4">
              <label className="block font-semibold">
                Full name
                <input
                  value={profileForm.fullName}
                  onChange={(event) => setProfileForm({ ...profileForm, fullName: event.target.value })}
                  className="mt-1 w-full px-3 py-2 border border-[var(--app-border)] rounded-[var(--app-radius-control)]"
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="font-semibold">
                  Role
                  <input
                    value={profileForm.role}
                    onChange={(event) => setProfileForm({ ...profileForm, role: event.target.value })}
                    className="mt-1 w-full px-3 py-2 border border-[var(--app-border)] rounded-[var(--app-radius-control)]"
                  />
                </label>
                <label className="font-semibold">
                  Organization
                  <input
                    value={profileForm.organization}
                    onChange={(event) => setProfileForm({ ...profileForm, organization: event.target.value })}
                    className="mt-1 w-full px-3 py-2 border border-[var(--app-border)] rounded-[var(--app-radius-control)]"
                  />
                </label>
              </div>
              <label className="flex items-center justify-between rounded-[var(--app-radius-control)] border border-[var(--app-border)] px-3 py-3 font-semibold">
                Auto-reconciliation
                <input
                  type="checkbox"
                  checked={profileForm.autoReconciliation}
                  onChange={(event) => setProfileForm({ ...profileForm, autoReconciliation: event.target.checked })}
                />
              </label>
              <label className="flex items-center justify-between rounded-[var(--app-radius-control)] border border-[var(--app-border)] px-3 py-3 font-semibold">
                Sales and payment notifications
                <input
                  type="checkbox"
                  checked={profileForm.notificationsEnabled}
                  onChange={(event) => setProfileForm({ ...profileForm, notificationsEnabled: event.target.checked })}
                />
              </label>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="secondary" onClick={() => setIsProfileOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">Save Settings</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}
