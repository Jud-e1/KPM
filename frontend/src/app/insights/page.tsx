"use client";

import React, { startTransition, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  Boxes,
  BriefcaseBusiness,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Download,
  FileBarChart,
  FileText,
  Headphones,
  Search,
  Send,
  Settings,
  ShieldAlert,
  Sparkles,
  Tags,
  TrendingUp,
  UserRound,
  Users,
  WalletCards,
  X,
} from "lucide-react";
import { accountingStore, AccountingState } from "@/lib/accountingStore";
import { inventoryStore, InventoryState } from "@/lib/inventoryStore";
import { salesStore, SalesState } from "@/lib/salesStore";
import {
  AiReport,
  buildForecastSeries,
  buildStockMovement,
  InsightsState,
  insightsStore,
} from "@/lib/insightsStore";
import { updateAccountingProfile } from "@/lib/api";

const formatCurrency = (amount: number) =>
  `$${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function profileInitials(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  return `${parts[0]?.[0] || ""}${parts[1]?.[0] || ""}`.toUpperCase() || "JA";
}

function firstName(fullName: string) {
  return fullName.trim().split(/\s+/)[0] || "there";
}

type SectionId = "overview" | "forecasting" | "anomaly" | "fraud" | "nlq";

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
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [profileForm, setProfileForm] = useState(accountingStore.getState().profile);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const forecastRef = useRef<HTMLDivElement>(null);
  const inventoryRef = useRef<HTMLDivElement>(null);
  const assistantRef = useRef<HTMLDivElement>(null);

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
    return () => {
      unsubAccounting();
      unsubInventory();
      unsubSales();
      unsubInsights();
      disconnectAccounting();
      disconnectSales();
    };
  }, []);

  useEffect(() => {
    insightsStore.ensureGreeting(firstName(accountingState.profile.fullName));
  }, [accountingState.profile.fullName]);

  useEffect(() => {
    if (isProfileOpen) setProfileForm(accountingState.profile);
  }, [isProfileOpen, accountingState.profile]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [insightsState.messages.length, aiLoading]);

  const { profile, metrics: accountingMetrics, activities } = accountingState;
  const initials = useMemo(() => profileInitials(profile.fullName), [profile.fullName]);
  const profitMargin = useMemo(() => {
    if (accountingMetrics.totalRevenue <= 0) return 0;
    return Number(((accountingMetrics.netProfit / accountingMetrics.totalRevenue) * 100).toFixed(1));
  }, [accountingMetrics.netProfit, accountingMetrics.totalRevenue]);
  const inventoryTurnover = useMemo(() => {
    const stockValue = Math.max(1, inventoryState.metrics.totalStockValue);
    return Number(((accountingMetrics.totalRevenue / stockValue) * 8).toFixed(1));
  }, [accountingMetrics.totalRevenue, inventoryState.metrics.totalStockValue]);
  const cashFlow = useMemo(
    () => Number((accountingMetrics.cashBalance - accountingMetrics.outstandingInvoices * 0.35).toFixed(2)),
    [accountingMetrics.cashBalance, accountingMetrics.outstandingInvoices]
  );

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

  const forecast = useMemo(
    () => buildForecastSeries(accountingMetrics.totalRevenue || salesState.metrics.totalRevenue || 48250),
    [accountingMetrics.totalRevenue, salesState.metrics.totalRevenue]
  );
  const stockMovement = useMemo(
    () => buildStockMovement(inventoryState.metrics.lowStockCount, inventoryState.metrics.totalProducts),
    [inventoryState.metrics.lowStockCount, inventoryState.metrics.totalProducts]
  );
  const activeForecast = forecast.find((point) => point.day === (hoverForecastDay || 28)) || forecast[27];

  const topInsights = useMemo(() => {
    const headphones = inventoryState.products.find((product) => product.name.toLowerCase().includes("headphone"));
    const officeChair = inventoryState.products.find((product) => product.name.toLowerCase().includes("chair"));
    return [
      {
        id: "insight-demand",
        title: `High Demand for ${headphones?.name || "Wireless Headphones"}`,
        description: `Predicted ${Math.max(18, Math.round(inventoryTurnover * 5))}% increase in sales next week.`,
        tone: "demand" as const,
      },
      {
        id: "insight-low",
        title: "Low Stock Alert",
        description: `${officeChair?.name || "Office Chairs"} (SKU: ${officeChair?.sku || "OC-041"}) ${officeChair ? `at ${officeChair.stock} units` : "running low"}.`,
        tone: "warning" as const,
      },
      {
        id: "insight-fraud",
        title: "Unusual Activity Detected",
        description: `${Math.max(1, pendingTransactions || 3)} transaction${pendingTransactions === 1 ? "" : "s"} flagged for review.`,
        tone: "fraud" as const,
      },
      {
        id: "insight-margin",
        title: "Profit Margin Improvement",
        description: `Margin is ${profitMargin}% with net profit ${formatCurrency(accountingMetrics.netProfit)}.`,
        tone: "success" as const,
      },
    ];
  }, [
    inventoryState.products,
    inventoryTurnover,
    pendingTransactions,
    profitMargin,
    accountingMetrics.netProfit,
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
      return `Sales are tracking ${formatCurrency(accountingMetrics.totalRevenue)} this period with ${salesState.metrics.totalOrders} orders. Forecast for Apr 28 is ${formatCurrency(activeForecast.predicted)}.`;
    }
    if (q.includes("stock") || q.includes("inventory") || q.includes("low")) {
      return `Inventory health: ${inventoryState.metrics.lowStockCount} low-stock items, ${overstockedProducts.length} overstocked, and ${inventoryState.metrics.totalProducts} total SKUs.`;
    }
    if (q.includes("profit") || q.includes("margin") || q.includes("financ")) {
      return `${profile.organization} margin is ${profitMargin}% (net ${formatCurrency(accountingMetrics.netProfit)}). Cash flow estimate: ${formatCurrency(cashFlow)}.`;
    }
    if (q.includes("fraud") || q.includes("unusual") || q.includes("anomal")) {
      return `${Math.max(pendingTransactions, 1)} accounting item(s) need review. Latest activity: ${activities[0]?.title || "No recent flags"}.`;
    }
    return `For ${profile.organization}: revenue ${formatCurrency(accountingMetrics.totalRevenue)}, turnover ${inventoryTurnover}x, and ${inventoryState.metrics.lowStockCount} low-stock alerts. Ask about sales, stock, margin, or fraud.`;
  };

  const submitPrompt = (prompt: string) => {
    const trimmed = prompt.trim();
    if (!trimmed || aiLoading) return;
    setAiLoading(true);
    setAiPrompt("");
    window.setTimeout(() => {
      insightsStore.ask(trimmed, answerQuestion(trimmed));
      setAiLoading(false);
      setActiveSection("nlq");
    }, 280);
  };

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
            ["Cash Flow", formatCurrency(cashFlow)],
            ["Turnover", `${inventoryTurnover}x`],
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

  const reorderTarget = lowStockProducts[0] || inventoryState.products.find((product) => product.name.toLowerCase().includes("headphone"));

  const forecastPath = (key: "actual" | "predicted") => {
    const values = forecast.map((point) => (key === "actual" ? point.actual : point.predicted));
    const max = Math.max(...forecast.map((point) => point.predicted), 1);
    const coords = values
      .map((value, index) => {
        if (value === null) return null;
        const x = (index / (forecast.length - 1)) * 560;
        const y = 150 - (value / max) * 120;
        return `${x},${y}`;
      })
      .filter(Boolean) as string[];
    return coords.map((coord, index) => `${index === 0 ? "M" : "L"} ${coord}`).join(" ");
  };

  const hoverX = ((activeForecast.day - 1) / 29) * 560;
  const hoverY = 150 - (activeForecast.predicted / Math.max(...forecast.map((point) => point.predicted), 1)) * 120;

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] flex font-sans antialiased selection:bg-[#0F172A] selection:text-white">
      <aside className="w-64 bg-white border-r border-slate-200/80 p-5 flex flex-col justify-between hidden md:flex flex-shrink-0">
        <div className="space-y-6">
          <Link href="/dashboard" className="block px-2">
            <div className="flex items-center space-x-2.5">
              <svg width="26" height="26" viewBox="0 0 32 32" fill="none">
                <rect x="4" y="4" width="10" height="10" rx="3" fill="#3B82F6" />
                <rect x="18" y="4" width="10" height="10" rx="3" fill="#60A5FA" />
                <rect x="4" y="18" width="10" height="10" rx="3" fill="#2563EB" />
                <rect x="18" y="18" width="10" height="10" rx="3" fill="#1D4ED8" />
              </svg>
              <span className="font-extrabold text-2xl tracking-tight">KPM</span>
            </div>
            <div className="text-[11px] font-medium text-slate-400 mt-1">Inventory · Accounting · AI</div>
          </Link>

          <nav className="space-y-1">
            {[
              { name: "Home", icon: BriefcaseBusiness, href: "/dashboard" },
              { name: "Inventory", icon: Boxes, href: "/inventory", arrow: true },
              { name: "Sales", icon: Tags, href: "/sales", arrow: true },
              { name: "Purchases", icon: WalletCards, href: "#", arrow: true },
              { name: "Accounting", icon: FileText, href: "/accounting", arrow: true },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  <span className="flex items-center gap-3">
                    <Icon className="w-4 h-4 text-slate-500" />
                    {item.name}
                  </span>
                  {item.arrow && <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
                </Link>
              );
            })}

            <div className="rounded-xl bg-[#0F172A] text-white overflow-hidden shadow-sm">
              <div className="flex items-center justify-between px-3.5 py-2.5 text-xs font-semibold">
                <span className="flex items-center gap-3">
                  <Sparkles className="w-4 h-4 text-violet-300" />
                  AI Insights
                </span>
                <ChevronDown className="w-3.5 h-3.5" />
              </div>
              <div className="bg-slate-50 text-slate-600 px-3.5 py-1.5 space-y-1.5 text-[11px] font-medium">
                {[
                  { id: "overview" as const, label: "Overview" },
                  { id: "forecasting" as const, label: "Forecasting" },
                  { id: "anomaly" as const, label: "Anomaly Detection" },
                  { id: "fraud" as const, label: "Fraud Detection" },
                  { id: "nlq" as const, label: "Natural Language Queries" },
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => scrollToSection(item.id)}
                    className={`block w-full text-left cursor-pointer ${activeSection === item.id ? "text-slate-900 font-semibold" : ""}`}
                  >
                    {activeSection === item.id && <span className="inline-block w-1.5 h-1.5 rounded-full bg-violet-500 mr-2 align-middle" />}
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {[
              { name: "Suppliers", icon: Users },
              { name: "Customers", icon: UserRound },
              { name: "Reports", icon: FileBarChart },
              { name: "Settings", icon: Settings },
            ].map(({ name, icon: Icon }) => (
              <button
                key={name}
                onClick={() => (name === "Settings" || name === "Reports" ? setIsProfileOpen(true) : undefined)}
                className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                <span className="flex items-center gap-3">
                  <Icon className="w-4 h-4 text-slate-500" />
                  {name}
                </span>
                <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              </button>
            ))}
          </nav>
        </div>

        <div className="space-y-3 pt-4">
          <button
            onClick={() => scrollToSection("nlq")}
            className="text-left rounded-2xl bg-gradient-to-br from-violet-50 to-blue-50 border border-slate-200/70 p-3.5 space-y-2.5 w-full cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-violet-600" />
              <span className="text-xs font-bold">Let AI Work For You</span>
            </div>
            <p className="text-[10.5px] text-slate-500 leading-snug">
              Explore forecasts, anomalies, and natural-language answers powered by your live data.
            </p>
            <span className="inline-flex items-center gap-1 bg-[#0F172A] text-white text-[10px] font-semibold px-3 py-1.5 rounded-lg">
              Explore AI Features <ArrowRight className="w-3 h-3" />
            </span>
          </button>
          <button
            onClick={() => setIsProfileOpen(true)}
            className="w-full rounded-xl border border-slate-200 p-2.5 flex items-center justify-between text-left cursor-pointer"
          >
            <span className="flex gap-2.5 items-center">
              <span className="w-7 h-7 rounded-lg bg-violet-50 text-violet-600 flex items-center justify-center">
                <Building2 className="w-3.5 h-3.5" />
              </span>
              <span>
                <span className="block text-xs font-bold leading-tight">{profile.organization}</span>
                <span className="block text-[10px] text-slate-400">Enterprise Plan</span>
              </span>
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>
        </div>
      </aside>

      <div className="flex-1 min-w-0">
        <header className="bg-white border-b border-slate-200/80 px-5 sm:px-8 py-3.5 flex items-center justify-between sticky top-0 z-30">
          <div className="relative w-full max-w-xl">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search for insights, products, transactions, or anything..."
              className="w-full pl-10 pr-10 py-2 bg-slate-50 border border-slate-200/80 rounded-full text-xs outline-none focus:bg-white focus:border-blue-400"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">⌘ K</span>
          </div>
          <div className="flex items-center gap-4 pl-4">
            <button
              onClick={() => setIsProfileOpen(true)}
              className="relative w-9 h-9 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center cursor-pointer"
            >
              <Bell className="w-4 h-4" />
              {profile.notificationsEnabled && activities.length > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full ring-2 ring-white" />
              )}
            </button>
            <button onClick={() => setIsProfileOpen(true)} className="flex items-center gap-2.5 text-left cursor-pointer">
              <span className="w-9 h-9 rounded-full bg-slate-800 text-white text-xs font-bold flex items-center justify-center">
                {initials}
              </span>
              <span className="hidden sm:block">
                <span className="block text-xs font-bold leading-tight">{profile.fullName}</span>
                <span className="block text-[10px] text-slate-400">{profile.role}</span>
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>
          </div>
        </header>

        <main className="p-4 sm:p-6 lg:p-8 space-y-4 max-w-[1600px] mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight flex items-center gap-2">
                AI Insights
                <Sparkles className="w-5 h-5 text-violet-500" />
              </h1>
              <p className="text-xs text-slate-500 mt-1 max-w-2xl">
                Turn your data into smarter decisions. Get AI-powered insights on your inventory, finances, and business performance.
              </p>
            </div>
            <div className="flex items-center gap-2.5">
              <button className="inline-flex items-center gap-2 bg-white border border-slate-200 text-xs font-semibold px-3.5 py-2 rounded-xl shadow-2xs cursor-pointer">
                <Calendar className="w-3.5 h-3.5" />
                Apr 1, 2025 – Apr 30, 2025
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </button>
              <button
                onClick={exportAll}
                className="inline-flex items-center gap-2 bg-[#0F172A] text-white text-xs font-semibold px-4 py-2 rounded-xl shadow-2xs cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                Export Report
              </button>
            </div>
          </div>

          <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5">
            {[
              { label: "Total Revenue", value: formatCurrency(accountingMetrics.totalRevenue), change: "12%", tone: "text-emerald-600", spark: "#3B82F6" },
              { label: "Total Profit Margin", value: `${profitMargin}%`, change: "3.4%", tone: "text-emerald-600", spark: "#22C55E" },
              { label: "Inventory Turnover", value: `${inventoryTurnover}x`, change: "1.2x", tone: "text-emerald-600", spark: "#60A5FA" },
              { label: "Cash Flow", value: formatCurrency(cashFlow), change: "8%", tone: "text-emerald-600", spark: "#818CF8" },
            ].map((card) => (
              <div key={card.label} className="rounded-2xl bg-white border border-slate-200/80 p-4 shadow-card-subtle">
                <div className="flex justify-between items-start">
                  <div className="text-[11px] font-medium text-slate-500">{card.label}</div>
                  <svg className="w-16 h-8" viewBox="0 0 64 30">
                    <path d="M 0 22 Q 12 18, 22 16 T 39 10 T 64 4" fill="none" stroke={card.spark} strokeWidth="1.7" />
                  </svg>
                </div>
                <div className="text-xl font-extrabold mt-2">{card.value}</div>
                <div className={`text-[10px] font-semibold mt-1 ${card.tone}`}>
                  ↑ {card.change} <span className="text-slate-400 font-normal ml-1">vs. last month</span>
                </div>
              </div>
            ))}
          </section>

          <section className="grid grid-cols-1 xl:grid-cols-12 gap-3.5">
            <div ref={forecastRef} className="xl:col-span-6 rounded-2xl bg-white border border-slate-200/80 p-4 shadow-card-subtle">
              <div className="flex items-start justify-between border-b border-slate-100 pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-bold">Sales Forecast</h2>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 text-[9px] font-semibold">
                      <Sparkles className="w-2.5 h-2.5" /> AI Prediction
                    </span>
                  </div>
                  <p className="text-[10.5px] text-slate-400 mt-1">Actual vs predicted sales for the selected period.</p>
                </div>
                <div className="flex gap-3 text-[10px] text-slate-500">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-600" /> Actual Sales</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-300" /> Predicted Sales</span>
                </div>
              </div>
              <div className="relative h-52 pt-3">
                <svg
                  className="w-full h-full"
                  viewBox="0 0 560 165"
                  preserveAspectRatio="none"
                  onMouseLeave={() => setHoverForecastDay(28)}
                >
                  {[0, 30, 60, 90, 120, 150].map((y) => (
                    <line key={y} x1="0" x2="560" y1={y} y2={y} stroke="#E8EEF7" />
                  ))}
                  <path d={forecastPath("predicted")} fill="none" stroke="#93C5FD" strokeWidth="2" strokeDasharray="5 4" />
                  <path d={forecastPath("actual")} fill="none" stroke="#2563EB" strokeWidth="2.2" />
                  {forecast.map((point) => {
                    const x = ((point.day - 1) / 29) * 560;
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
                  <circle cx={hoverX} cy={hoverY} r="4.5" fill="#2563EB" stroke="white" strokeWidth="2" />
                </svg>
                <div
                  className="absolute pointer-events-none bg-[#0F172A] text-white text-[10px] rounded-lg px-2.5 py-1.5 shadow-lg"
                  style={{ left: `clamp(8px, calc(${(activeForecast.day / 30) * 100}% - 40px), calc(100% - 110px))`, top: 18 }}
                >
                  <div className="font-semibold">{activeForecast.label}, 2025</div>
                  <div className="text-blue-200">{formatCurrency(activeForecast.predicted)} (predicted)</div>
                </div>
              </div>
              <div className="flex justify-between text-[9px] text-slate-400 px-1">
                <span>Apr 1</span><span>Apr 8</span><span>Apr 15</span><span>Apr 22</span><span>Apr 30</span>
              </div>
            </div>

            <div className="xl:col-span-3 rounded-2xl bg-white border border-slate-200/80 p-4 shadow-card-subtle">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h2 className="text-sm font-bold">Top Insights</h2>
                <span className="text-[10px] text-slate-400">{filteredInsights.length} live</span>
              </div>
              <div className="pt-3 space-y-3">
                {filteredInsights.map((insight) => {
                  const Icon =
                    insight.tone === "warning" ? AlertTriangle :
                    insight.tone === "fraud" ? ShieldAlert :
                    insight.tone === "success" ? CheckCircle2 :
                    TrendingUp;
                  const tone =
                    insight.tone === "warning" ? "bg-rose-50 text-rose-600" :
                    insight.tone === "fraud" ? "bg-violet-50 text-violet-600" :
                    insight.tone === "success" ? "bg-emerald-50 text-emerald-600" :
                    "bg-blue-50 text-blue-600";
                  return (
                    <button
                      key={insight.id}
                      onClick={() => scrollToSection(insight.tone === "fraud" ? "fraud" : insight.tone === "warning" ? "anomaly" : "forecasting")}
                      className="w-full text-left flex gap-2.5 cursor-pointer hover:bg-slate-50 rounded-xl p-1.5 -mx-1.5"
                    >
                      <span className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${tone}`}>
                        <Icon className="w-3.5 h-3.5" />
                      </span>
                      <span>
                        <b className="block text-[11px] text-slate-800 leading-snug">{insight.title}</b>
                        <span className="block text-[10px] text-slate-500 mt-0.5 leading-snug">{insight.description}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div ref={assistantRef} className="xl:col-span-3 rounded-2xl bg-white border border-slate-200/80 p-4 shadow-card-subtle flex flex-col min-h-[320px]">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <span className="w-7 h-7 rounded-lg bg-violet-50 text-violet-600 flex items-center justify-center">
                  <Sparkles className="w-3.5 h-3.5" />
                </span>
                <h2 className="text-sm font-bold">KPM AI Assistant</h2>
              </div>
              <div className="flex-1 overflow-y-auto space-y-2.5 py-3 max-h-52">
                {insightsState.messages.slice(-6).map((message) => (
                  <div
                    key={message.id}
                    className={`text-[11px] leading-relaxed rounded-xl px-3 py-2 ${
                      message.role === "assistant" ? "bg-slate-50 text-slate-700" : "bg-[#0F172A] text-white ml-6"
                    }`}
                  >
                    {message.content}
                  </div>
                ))}
                {aiLoading && <div className="text-[11px] text-slate-400 px-1">Thinking…</div>}
                <div ref={chatEndRef} />
              </div>
              <div className="flex flex-wrap gap-1.5 pb-2">
                {SUGGESTED_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => submitPrompt(prompt)}
                    className="px-2.5 py-1 rounded-full border border-slate-200 text-[9.5px] font-medium text-slate-600 hover:bg-slate-50 cursor-pointer"
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
                  className="flex-1 px-3 py-2 rounded-full bg-slate-50 border border-slate-200 text-[11px] outline-none focus:bg-white focus:border-violet-400"
                />
                <button
                  type="submit"
                  disabled={aiLoading || !aiPrompt.trim()}
                  className="w-8 h-8 rounded-full bg-[#0F172A] text-white flex items-center justify-center cursor-pointer disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </form>
            </div>
          </section>

          <section className="grid grid-cols-1 xl:grid-cols-12 gap-3.5">
            <div ref={inventoryRef} className="xl:col-span-8 rounded-2xl bg-white border border-slate-200/80 p-4 shadow-card-subtle space-y-4">
              <div>
                <h2 className="text-sm font-bold">Inventory Insights</h2>
                <p className="text-[10.5px] text-slate-400 mt-1">Live stock signals and recommended actions from your inventory engine.</p>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
                {[
                  { label: "Low Stock Items", value: inventoryState.metrics.lowStockCount || lowStockProducts.length, tone: "bg-rose-50 text-rose-700 border-rose-100" },
                  { label: "Overstocked Items", value: overstockedProducts.length || 5, tone: "bg-blue-50 text-blue-700 border-blue-100" },
                  { label: "Fast Moving Products", value: fastMoving.length || 3, tone: "bg-sky-50 text-sky-700 border-sky-100" },
                  { label: "Slow Moving Products", value: slowMoving.length || 2, tone: "bg-violet-50 text-violet-700 border-violet-100" },
                ].map((tile) => (
                  <div key={tile.label} className={`rounded-xl border px-3 py-2.5 ${tile.tone}`}>
                    <div className="text-lg font-extrabold leading-none">{tile.value}</div>
                    <div className="text-[10px] font-semibold mt-1 opacity-80">{tile.label}</div>
                  </div>
                ))}
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-bold text-slate-800">Stock Movement Trend</h3>
                  <div className="flex gap-3 text-[10px] text-slate-500">
                    <span>● Inflow</span>
                    <span className="text-slate-300">● Outflow</span>
                  </div>
                </div>
                <div className="h-36 flex items-end gap-3 px-1">
                  {stockMovement.map((point) => (
                    <div key={point.label} className="flex-1 flex flex-col items-center gap-1">
                      <div className="w-full flex items-end justify-center gap-1 h-28">
                        <div className="w-2.5 rounded-t bg-[#0F172A]" style={{ height: `${Math.min(100, point.inflow * 3.2)}%` }} />
                        <div className="w-2.5 rounded-t bg-[#93C5FD]" style={{ height: `${Math.min(100, point.outflow * 3.2)}%` }} />
                      </div>
                      <span className="text-[8.5px] text-slate-400">{point.label.replace("Apr ", "")}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-xs font-bold text-slate-800 mb-2">Recommended Actions</h3>
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200/80 px-3 py-2.5">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600">
                        <Headphones className="w-3.5 h-3.5" />
                      </span>
                      <span className="text-[11px] font-semibold text-slate-700 truncate">
                        Reorder {reorderTarget?.name || "Wireless Headphones"}
                      </span>
                    </div>
                    <Link href="/inventory" className="text-[10px] font-semibold bg-[#0F172A] text-white px-3 py-1.5 rounded-lg whitespace-nowrap">
                      Create Purchase Order
                    </Link>
                  </div>
                  <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200/80 px-3 py-2.5">
                    <span className="text-[11px] font-semibold text-slate-700">Move slow-moving items to promotion</span>
                    <Link href="/inventory" className="text-[10px] font-semibold border border-slate-200 px-3 py-1.5 rounded-lg whitespace-nowrap">
                      View Products
                    </Link>
                  </div>
                  <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200/80 px-3 py-2.5">
                    <span className="text-[11px] font-semibold text-slate-700">Review supplier performance</span>
                    <Link href="/sales" className="text-[10px] font-semibold border border-slate-200 px-3 py-1.5 rounded-lg whitespace-nowrap">
                      View Suppliers
                    </Link>
                  </div>
                </div>
              </div>
            </div>

            <div className="xl:col-span-4 rounded-2xl bg-white border border-slate-200/80 p-4 shadow-card-subtle">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h2 className="text-sm font-bold">Recent AI Reports</h2>
                <button onClick={exportAll} className="text-[10px] text-blue-600 font-semibold cursor-pointer">
                  Export all
                </button>
              </div>
              <div className="pt-2 space-y-2">
                {insightsState.reports.map((report) => (
                  <div key={report.id} className="flex items-center justify-between gap-2 rounded-xl border border-slate-100 px-2.5 py-2.5 hover:bg-slate-50">
                    <div className="min-w-0">
                      <div className="text-[11px] font-bold text-slate-800 truncate">{report.title}</div>
                      <div className="text-[9.5px] text-slate-400 mt-0.5">
                        {report.period} · <span className="text-violet-600 font-semibold">Generated by AI</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <span className="text-[9px] font-semibold text-slate-400 border border-slate-200 rounded px-1.5 py-0.5">
                        {report.format}
                      </span>
                      <button
                        onClick={() => exportReport(report)}
                        className="w-7 h-7 rounded-lg border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-white cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 rounded-xl bg-slate-50 border border-slate-100 p-3">
                <div className="text-[10px] font-bold text-slate-700 mb-2">Recent Activity</div>
                <div className="space-y-2">
                  {activities.slice(0, 3).map((activity) => (
                    <div key={activity.id} className="text-[10px]">
                      <div className="font-semibold text-slate-700">{activity.title}</div>
                      <div className="text-slate-400">{activity.subtitle || activity.time}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        </main>
      </div>

      {isProfileOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/45 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 p-6 text-xs">
            <div className="flex justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="font-bold text-base">Account Settings</h2>
                <p className="text-slate-400 mt-0.5">Profile and automation preferences</p>
              </div>
              <button onClick={() => setIsProfileOpen(false)} className="text-slate-400 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={saveProfile} className="space-y-3 pt-4">
              <label className="block font-semibold">
                Full name
                <input
                  value={profileForm.fullName}
                  onChange={(event) => setProfileForm({ ...profileForm, fullName: event.target.value })}
                  className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-xl"
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="font-semibold">
                  Role
                  <input
                    value={profileForm.role}
                    onChange={(event) => setProfileForm({ ...profileForm, role: event.target.value })}
                    className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-xl"
                  />
                </label>
                <label className="font-semibold">
                  Organization
                  <input
                    value={profileForm.organization}
                    onChange={(event) => setProfileForm({ ...profileForm, organization: event.target.value })}
                    className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-xl"
                  />
                </label>
              </div>
              <label className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-3 font-semibold">
                Auto-reconciliation
                <input
                  type="checkbox"
                  checked={profileForm.autoReconciliation}
                  onChange={(event) => setProfileForm({ ...profileForm, autoReconciliation: event.target.checked })}
                />
              </label>
              <label className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-3 font-semibold">
                Sales and payment notifications
                <input
                  type="checkbox"
                  checked={profileForm.notificationsEnabled}
                  onChange={(event) => setProfileForm({ ...profileForm, notificationsEnabled: event.target.checked })}
                />
              </label>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setIsProfileOpen(false)} className="px-4 py-2 border border-slate-200 rounded-xl font-semibold text-slate-600 cursor-pointer">
                  Cancel
                </button>
                <button className="px-5 py-2 bg-[#0F172A] text-white rounded-xl font-semibold cursor-pointer">Save Settings</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
