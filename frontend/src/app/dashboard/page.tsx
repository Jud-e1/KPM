"use client";

import React, { startTransition, useMemo, useState } from "react";
import Link from "next/link";
import {
  Home,
  Boxes,
  FileText,
  Sparkles,
  Users,
  BarChart3,
  Settings,
  Search,
  Bell,
  ChevronDown,
  ArrowRight,
  TrendingUp,
  Wallet,
  ShoppingCart,
  AlertTriangle,
  CheckCircle2,
  Package,
  Layers,
  Zap,
  Play,
  ArrowUpRight,
  ArrowDownRight,
  ShieldCheck,
  RotateCw,
  Send,
  SlidersHorizontal,
  ChevronRight,
  Activity,
  Calculator,
  GitFork,
  Cog,
  X,
  Lock,
  Server,
  Database
} from "lucide-react";

import { inventoryStore, InventoryState } from "@/lib/inventoryStore";
import { salesStore, SalesState } from "@/lib/salesStore";
import { accountingStore, AccountingState } from "@/lib/accountingStore";
import { updateAccountingProfile } from "@/lib/api";

function formatCurrency(amount: number) {
  return `$${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function profileInitials(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  return `${parts[0]?.[0] || ""}${parts[1]?.[0] || ""}`.toUpperCase() || "JA";
}

function relativeSyncLabel(iso: string) {
  const syncedAt = new Date(iso).getTime();
  if (Number.isNaN(syncedAt)) return "Just now";
  const minutes = Math.max(0, Math.round((Date.now() - syncedAt) / 60000));
  if (minutes < 1) return "Just now";
  if (minutes === 1) return "1 min ago";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  return hours === 1 ? "1 hr ago" : `${hours} hr ago`;
}

export default function DashboardPage() {
  const [activeNav, setActiveNav] = useState("Home");
  const [activeModuleTab, setActiveModuleTab] = useState("Inventory Engine");
  const [searchQuery, setSearchQuery] = useState("");
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  const [notificationOpen, setNotificationOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState<any | null>(null);
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [chartDay, setChartDay] = useState(5);

  // Real-time Inventory Store Subscription
  const [inventoryState, setInventoryState] = useState<InventoryState>(inventoryStore.getState());
  const [salesState, setSalesState] = useState<SalesState>(salesStore.getState());
  const [accountingState, setAccountingState] = useState<AccountingState>(accountingStore.getState());
  const [settingsForm, setSettingsForm] = useState(accountingStore.getState().profile);

  React.useEffect(() => {
    const unsub = inventoryStore.subscribe((newState) => {
      startTransition(() => setInventoryState(newState));
    });
    return () => { unsub(); };
  }, []);

  React.useEffect(() => {
    const unsub = salesStore.subscribe((newState) => {
      startTransition(() => setSalesState(newState));
    });
    const disconnectLiveSync = salesStore.connectLive();
    return () => {
      unsub();
      disconnectLiveSync();
    };
  }, []);

  React.useEffect(() => {
    const unsub = accountingStore.subscribe((newState) => {
      startTransition(() => setAccountingState(newState));
    });
    const disconnectLiveSync = accountingStore.connectLive();
    return () => {
      unsub();
      disconnectLiveSync();
    };
  }, []);

  React.useEffect(() => {
    if (activeModal !== "Settings") {
      setSettingsForm(accountingState.profile);
    }
  }, [accountingState.profile, activeModal]);

  const { profile, metrics: accountingMetrics, activities: accountingActivities, lastSync } = accountingState;
  const initials = useMemo(() => profileInitials(profile.fullName), [profile.fullName]);
  const reconciliationRate = useMemo(() => {
    const total = accountingState.transactions.length;
    if (!total) return 100;
    const cleared = accountingState.transactions.filter((transaction) => transaction.status === "Cleared").length;
    return Math.round((cleared / total) * 100);
  }, [accountingState.transactions]);
  const unreadNotifications = useMemo(
    () => (profile.notificationsEnabled ? accountingActivities.slice(0, 3) : []),
    [profile.notificationsEnabled, accountingActivities]
  );
  const errorCount = useMemo(
    () => inventoryState.alerts.filter((alert) => alert.type === "critical" || alert.type === "warning").length || inventoryState.metrics.lowStockCount || 3,
    [inventoryState.alerts, inventoryState.metrics.lowStockCount]
  );
  const latestSync = useMemo(() => {
    const stamps = [lastSync, inventoryState.lastSync, salesState.lastSync]
      .map((value) => new Date(value).getTime())
      .filter((value) => !Number.isNaN(value));
    if (!stamps.length) return lastSync;
    return new Date(Math.max(...stamps)).toISOString();
  }, [lastSync, inventoryState.lastSync, salesState.lastSync]);
  const profitMargin = useMemo(() => {
    if (accountingMetrics.totalRevenue <= 0) return 0;
    return Number(((accountingMetrics.netProfit / accountingMetrics.totalRevenue) * 100).toFixed(1));
  }, [accountingMetrics.netProfit, accountingMetrics.totalRevenue]);
  const stockTrendPct = useMemo(() => {
    return Math.min(24, Math.max(4, Math.round((inventoryState.metrics.inStockPercentage / 8) + (salesState.metrics.totalOrders % 7))));
  }, [inventoryState.metrics.inStockPercentage, salesState.metrics.totalOrders]);
  const weeklyStockSeries = useMemo(() => {
    const totalUnits = inventoryState.products.reduce((sum, product) => sum + product.stock, 0) || 1200;
    const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    return days.map((label, index) => {
      const wave = Math.sin((index + 1) / 2.1) * 0.12 + index * 0.035;
      const value = Math.round(totalUnits * (0.72 + wave));
      return { label, value, x: (index / 6) * 300, y: 70 - ((value / (totalUnits * 1.15)) * 55) };
    });
  }, [inventoryState.products]);
  const activeChartPoint = weeklyStockSeries[Math.min(chartDay, weeklyStockSeries.length - 1)] || weeklyStockSeries[5];
  const chartPath = useMemo(() => {
    if (!weeklyStockSeries.length) return "";
    return weeklyStockSeries
      .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
      .join(" ");
  }, [weeklyStockSeries]);
  const chartAreaPath = useMemo(() => {
    if (!weeklyStockSeries.length) return "";
    return `${chartPath} L 300 80 L 0 80 Z`;
  }, [chartPath, weeklyStockSeries]);
  const inStockRing = useMemo(() => {
    const pct = Math.max(0, Math.min(100, inventoryState.metrics.inStockPercentage || 0));
    const radius = 10;
    const circumference = 2 * Math.PI * radius;
    return {
      pct,
      dash: `${(pct / 100) * circumference} ${circumference}`,
    };
  }, [inventoryState.metrics.inStockPercentage]);

  // Module Tabs matching Section B
  const moduleTabs = [
    {
      id: "Inventory Engine",
      name: "Inventory Engine",
      sub: "Track · Reorder · Sync",
      icon: Boxes,
      href: "/inventory",
    },
    {
      id: "Accounting Layer",
      name: "Accounting Layer",
      sub: "Reconcile · Ledger · Balance",
      icon: Calculator,
      href: "/accounting",
    },
    {
      id: "AI/ML Intelligence",
      name: "AI/ML Intelligence",
      sub: "Forecast · Detect · Predict",
      icon: Sparkles,
      href: "/insights",
    },
    {
      id: "Integration Layer",
      name: "Integration Layer",
      sub: "APIs · EDI · B2B",
      icon: GitFork,
    },
    {
      id: "Automation Engine",
      name: "Automation Engine",
      sub: "24/7 · Event-driven",
      icon: Cog,
    },
    {
      id: "Notifications & Insights",
      name: "Notifications & Insights",
      sub: "Alerts · Reports · Growth",
      icon: Bell,
    },
  ];

  // Recent Activity Feed
  const recentActivities = [
    {
      id: 1,
      title: "Stock Replenishment",
      desc: "Auto-order placed for 3 products",
      time: "12m ago",
      icon: ShoppingCart,
      color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
    },
    {
      id: 2,
      title: "Accounting Reconciled",
      desc: "Bank transactions matched",
      time: "34m ago",
      icon: FileText,
      color: "bg-blue-500/10 text-blue-600 border-blue-500/20",
    },
    {
      id: 3,
      title: "Anomaly Detected",
      desc: "Mismatch in inventory count (SKU #4582)",
      time: "1h ago",
      icon: AlertTriangle,
      color: "bg-rose-500/10 text-rose-500 border-rose-500/20",
    },
    {
      id: 4,
      title: "B2B Order Received",
      desc: "From GlobalMart Ltd. (PO #7789)",
      time: "2h ago",
      icon: Users,
      color: "bg-purple-500/10 text-purple-600 border-purple-500/20",
    },
    {
      id: 5,
      title: "Forecast Updated",
      desc: "Demand forecast for next 30 days",
      time: "3h ago",
      icon: TrendingUp,
      color: "bg-sky-500/10 text-sky-600 border-sky-500/20",
    },
  ];

  // Dynamically merge live inventory, sales, and accounting events into the activity feed.
  const liveCombinedActivities = useMemo(() => {
    const invActivities = inventoryState.alerts.map((a, idx) => ({
      id: `inv-act-${a.id}-${idx}`,
      title: a.title,
      desc: a.subtitle,
      time: a.time,
      icon: a.type === "critical" || a.type === "warning" ? AlertTriangle : (a.type === "success" ? CheckCircle2 : Boxes),
      color: a.type === "critical"
        ? "bg-rose-500/10 text-rose-500 border-rose-500/20"
        : a.type === "warning"
        ? "bg-amber-500/10 text-amber-600 border-amber-500/20"
        : a.type === "success"
        ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
        : "bg-blue-500/10 text-blue-600 border-blue-500/20",
    }));
    const salesActivities = salesState.orders
      .filter((order) => order.status !== "Cancelled")
      .slice(0, 3)
      .map((order) => ({
        id: `sales-act-${order.id}`,
        title: `Sales order ${order.orderNumber}`,
        desc: `${order.customerName} • $${order.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
        time: order.time || "Just now",
        icon: order.status === "Pending" ? ShoppingCart : CheckCircle2,
        color: order.status === "Pending"
          ? "bg-amber-500/10 text-amber-600 border-amber-500/20"
          : "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
      }));
    const liveAccountingActivities = accountingActivities.slice(0, 4).map((activity) => ({
      id: `acct-act-${activity.id}`,
      title: activity.title,
      desc: activity.subtitle || profile.organization,
      time: activity.time || "Just now",
      icon: activity.tone === "expense" ? Wallet : activity.tone === "income" ? CheckCircle2 : FileText,
      color: activity.tone === "expense"
        ? "bg-rose-500/10 text-rose-500 border-rose-500/20"
        : activity.tone === "income"
        ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
        : "bg-blue-500/10 text-blue-600 border-blue-500/20",
    }));
    return [...liveAccountingActivities, ...salesActivities, ...invActivities.slice(0, 3), ...recentActivities].slice(0, 5);
  }, [inventoryState.alerts, salesState.orders, accountingActivities, profile.organization]);

  // Filtered activities based on search bar
  const filteredActivities = useMemo(() => {
    if (!searchQuery.trim()) return liveCombinedActivities;
    const query = searchQuery.toLowerCase();
    return liveCombinedActivities.filter(
      (act) =>
        act.title.toLowerCase().includes(query) ||
        act.desc.toLowerCase().includes(query)
    );
  }, [searchQuery, liveCombinedActivities]);

  const handleSearchSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const query = searchQuery.trim().toLowerCase();
    if (!query) return;
    if (query.includes("stock") || query.includes("inventory") || query.includes("sku")) {
      window.location.href = "/inventory";
      return;
    }
    if (query.includes("account") || query.includes("invoice") || query.includes("ledger")) {
      window.location.href = "/accounting";
      return;
    }
    if (query.includes("insight") || query.includes("forecast") || query.includes("ai")) {
      window.location.href = "/insights";
      return;
    }
    if (query.includes("sale") || query.includes("order")) {
      window.location.href = "/sales";
      return;
    }
    setActiveModal("activity-log");
  };

  const openSettings = () => {
    setSettingsForm(accountingStore.getState().profile);
    setActiveNav("Settings");
    setActiveModal("Settings");
  };

  const saveSettings = async (event: React.FormEvent) => {
    event.preventDefault();
    setSettingsSaving(true);
    accountingStore.updateProfile(settingsForm);
    try {
      await updateAccountingProfile({
        full_name: settingsForm.fullName,
        role: settingsForm.role,
        organization: settingsForm.organization,
        auto_reconciliation: settingsForm.autoReconciliation,
        notifications_enabled: settingsForm.notificationsEnabled,
      });
    } catch {
      void accountingStore.syncFromBackend(true);
    } finally {
      setSettingsSaving(false);
      setActiveModal(null);
    }
  };

  const handleAiSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiPrompt.trim()) return;
    setAiLoading(true);
    setAiResponse(null);

    setTimeout(() => {
      setAiLoading(false);
      const query = aiPrompt.toLowerCase();
      if (query.includes("wrong") || query.includes("error") || query.includes("anomaly")) {
        setAiResponse(
          "Anomaly detected in SKU #4582: Warehouse physical count was 142 while invoice showed 150. KPM auto-flagged vendor credit memo #VC-992 and balanced the ledger."
        );
      } else if (query.includes("forecast") || query.includes("demand")) {
        setAiResponse(
          "Demand for enterprise laptop units is projected to spike by 26% over the next 3 weeks. Recommended safety stock replenishment: 200 units."
        );
      } else if (query.includes("revenue") || query.includes("profit") || query.includes("financial") || query.includes("account") || query.includes("insight")) {
        setAiResponse(
          `Live books for ${profile.organization}: revenue ${formatCurrency(accountingMetrics.totalRevenue)}, margin ${profitMargin}%, net ${formatCurrency(accountingMetrics.netProfit)}. Stock value $${inventoryState.metrics.totalStockValue.toLocaleString()} with ${inventoryState.metrics.lowStockCount} low-stock SKUs.`
        );
      } else if (query.includes("stock") || query.includes("inventory")) {
        setAiResponse(
          `Inventory snapshot: ${inventoryState.metrics.totalProducts} SKUs, ${inventoryState.metrics.inStockCount} in stock (${inventoryState.metrics.inStockPercentage}%), ${inventoryState.metrics.lowStockCount} low stock. Total value $${inventoryState.metrics.totalStockValue.toLocaleString()}.`
        );
      } else {
        setAiResponse(
          `Analysis complete for "${aiPrompt}": ${salesState.metrics.totalOrders} orders processed, accounts ${reconciliationRate}% balanced, ${errorCount} alerts monitored. Ask about stock, revenue, or anomalies.`
        );
      }
    }, 500);
  };

  return (
    <div className="min-h-screen bg-[#F4F6F9] text-[#0F172A] flex font-sans antialiased selection:bg-[#0F172A] selection:text-white">
      
      {/* ========================================================= */}
      {/* 1. LEFT SIDEBAR                                           */}
      {/* ========================================================= */}
      <aside className="w-64 bg-white border-r border-slate-200/80 p-5 flex flex-col justify-between hidden md:flex flex-shrink-0">
        <div className="space-y-6">
          {/* Logo with 4-lozenge stylized mark */}
          <Link href="/" className="flex items-center space-x-2.5 px-2 group">
            <div className="flex items-center space-x-1.5">
              <svg width="26" height="26" viewBox="0 0 32 32" fill="none">
                <rect x="4" y="4" width="10" height="10" rx="3" fill="#3B82F6" />
                <rect x="18" y="4" width="10" height="10" rx="3" fill="#60A5FA" />
                <rect x="4" y="18" width="10" height="10" rx="3" fill="#2563EB" />
                <rect x="18" y="18" width="10" height="10" rx="3" fill="#1D4ED8" />
              </svg>
              <span className="font-extrabold text-2xl tracking-tight text-[#0F172A]">
                KPM
              </span>
            </div>
          </Link>

          {/* Navigation Links */}
          <nav className="space-y-1">
            {[
              { name: "Home", icon: Home, href: "/dashboard" },
              { name: "Inventory", icon: Boxes, href: "/inventory" },
              { name: "Accounting", icon: FileText, href: "/accounting" },
              { name: "AI Insights", icon: Sparkles, href: "/insights" },
              { name: "B2B Partners", icon: Users, href: "/sales" },
              { name: "Reports", icon: BarChart3, href: "/insights" },
              { name: "Settings", icon: Settings, href: "#", action: "Settings" },
            ].map((item) => {
              const Icon = item.icon;
              const isActive = activeNav === item.name || (item.name === "Home" && activeNav === "Home");
              if (item.href !== "#") {
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => setActiveNav(item.name)}
                    className={`relative w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                      isActive
                        ? "bg-[#EFF6FF] text-[#2563EB] shadow-2xs"
                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                    }`}
                  >
                    {isActive && <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full bg-[#2563EB]" />}
                    <Icon className={`w-4 h-4 ${isActive ? "text-[#2563EB]" : "text-slate-400"}`} />
                    <span>{item.name}</span>
                  </Link>
                );
              }
              return (
                <button
                  key={item.name}
                  onClick={() => {
                    if (item.action === "Settings") {
                      openSettings();
                      return;
                    }
                    setActiveNav(item.name);
                    setActiveModal(item.name);
                  }}
                  className={`relative w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    isActive
                      ? "bg-[#EFF6FF] text-[#2563EB] shadow-2xs"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  }`}
                >
                  {isActive && <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full bg-[#2563EB]" />}
                  <Icon className={`w-4 h-4 ${isActive ? "text-[#2563EB]" : "text-slate-400"}`} />
                  <span>{item.name}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom Sidebar Card: KPM AI Assistant */}
        <Link
          href="/insights"
          className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50/70 to-blue-50/50 p-3.5 flex items-center justify-between group cursor-pointer hover:border-indigo-200 transition-all shadow-2xs"
        >
          <div className="space-y-0.5">
            <div className="flex items-center space-x-1.5 text-xs font-bold text-[#0F172A]">
              <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
              <span>KPM AI</span>
            </div>
            <p className="text-[10px] text-slate-500 leading-tight">
              Your autonomous <br /> business assistant
            </p>
          </div>
          <div className="w-6 h-6 rounded-full bg-white flex items-center justify-center text-slate-700 shadow-2xs group-hover:translate-x-0.5 transition-transform">
            <ArrowRight className="w-3 h-3" />
          </div>
        </Link>
      </aside>

      {/* ========================================================= */}
      {/* 2. MAIN CONTENT AREA                                      */}
      {/* ========================================================= */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        
        {/* Top Navbar matching screenshot */}
        <header className="bg-white border-b border-slate-200/80 px-4 sm:px-8 py-3.5 flex items-center justify-between sticky top-0 z-30">
          {/* Search Input Bar */}
          <form onSubmit={handleSearchSubmit} className="relative w-full max-w-md sm:max-w-lg">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search anything... (e.g. stock, invoice, report)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200/80 rounded-full text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-blue-400 transition-all"
            />
          </form>

          {/* User Profile & Bell */}
          <div className="flex items-center space-x-4 pl-4">
            {/* Notification Bell */}
            <div className="relative">
              <button
                onClick={() => setNotificationOpen(!notificationOpen)}
                className="w-9 h-9 rounded-full bg-slate-50 hover:bg-slate-100 border border-slate-200/70 flex items-center justify-center text-slate-600 transition-colors cursor-pointer"
              >
                <Bell className="w-4 h-4" />
                {unreadNotifications.length > 0 && (
                  <span className="absolute top-1 right-1 w-2 h-2 bg-rose-500 rounded-full ring-2 ring-white" />
                )}
              </button>

              {/* Notification Popover */}
              {notificationOpen && (
                <div className="absolute right-0 mt-2 w-72 bg-white rounded-2xl border border-slate-200 shadow-xl p-3 z-50 text-xs animate-in fade-in duration-150">
                  <div className="font-bold text-slate-900 pb-2 border-b border-slate-100 flex items-center justify-between">
                    <span>Notifications ({unreadNotifications.length} unread)</span>
                    <button onClick={() => setNotificationOpen(false)} className="text-slate-400 hover:text-slate-600">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="space-y-2 mt-2">
                    {(unreadNotifications.length ? unreadNotifications : accountingActivities.slice(0, 3)).map((item) => (
                      <button
                        key={item.id}
                        onClick={() => {
                          setNotificationOpen(false);
                          setSelectedActivity({
                            id: `acct-act-${item.id}`,
                            title: item.title,
                            desc: item.subtitle || profile.organization,
                            time: item.time,
                            icon: FileText,
                            color: "bg-blue-500/10 text-blue-600 border-blue-500/20",
                          });
                        }}
                        className="w-full text-left p-2 rounded-xl bg-slate-50 hover:bg-slate-100 cursor-pointer"
                      >
                        <div className="font-semibold text-slate-800">{item.title}</div>
                        <div className="text-[10px] text-slate-500">{item.subtitle || item.time}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* User Profile Dropdown */}
            <div className="relative">
              <button
                onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                className="flex items-center space-x-2.5 cursor-pointer pl-1"
              >
                <div className="w-9 h-9 rounded-full bg-slate-200 border border-slate-300/80 flex items-center justify-center font-bold text-xs text-slate-700">
                  {initials}
                </div>
                <div className="hidden sm:block text-left">
                  <div className="text-xs font-bold text-slate-800 leading-tight">{profile.fullName}</div>
                  <div className="text-[10px] text-slate-400">{profile.role}</div>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden sm:block" />
              </button>

              {userDropdownOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-2xl border border-slate-200 shadow-xl p-2 z-50 text-xs animate-in fade-in duration-150">
                  <button
                    onClick={() => {
                      setUserDropdownOpen(false);
                      openSettings();
                    }}
                    className="w-full text-left px-3 py-2 rounded-xl hover:bg-slate-50 text-slate-700 cursor-pointer"
                  >
                    Account Settings
                  </button>
                  <Link href="/insights" className="block px-3 py-2 rounded-xl hover:bg-slate-50 text-slate-700">
                    AI Insights
                  </Link>
                  <Link href="/accounting" className="block px-3 py-2 rounded-xl hover:bg-slate-50 text-slate-700">
                    Accounting
                  </Link>
                  <Link href="/" className="block px-3 py-2 rounded-xl hover:bg-slate-50 text-slate-700">
                    Landing Page
                  </Link>
                  <Link href="/signup" className="block px-3 py-2 rounded-xl hover:bg-slate-50 text-slate-700">
                    Switch Account
                  </Link>
                  <button
                    onClick={() => {
                      setUserDropdownOpen(false);
                      window.location.href = "/signup";
                    }}
                    className="w-full text-left px-3 py-2 rounded-xl hover:bg-rose-50 text-rose-600 font-medium cursor-pointer"
                  >
                    Log Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Dashboard Main Grid Body */}
        <main className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-[1500px] w-full mx-auto">
          
          {/* ======================================================= */}
          {/* SECTION A: TOP HERO BANNER + 4 METRIC CARDS             */}
          {/* ======================================================= */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
            
            {/* Left Hero Card */}
            <div className="lg:col-span-8 rounded-[26px] bg-white border border-slate-200/80 p-6 sm:p-8 shadow-card-subtle flex flex-col justify-between relative overflow-hidden">
              {/* Background Warehouse Image Overlay on Right */}
              <div className="absolute right-0 top-0 bottom-0 w-[46%] hidden sm:block pointer-events-none rounded-r-[26px] overflow-hidden">
                <img
                  src="/images/warehouse.jpg"
                  alt="Warehouse"
                  className="w-full h-full object-cover object-center"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-white via-white/50 to-transparent" />
              </div>

              {/* Text content */}
              <div className="max-w-md space-y-3 z-10">
                <div className="inline-block px-3 py-1 rounded-full bg-slate-100 border border-slate-200/60 text-[11px] font-semibold text-slate-700">
                  B2B SaaS Platform
                </div>

                <h1 className="text-2xl sm:text-[32px] font-extrabold text-[#0F172A] tracking-tight leading-[1.12]">
                  Smarter Inventory. <br />
                  Healthier Finances. <br />
                  <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">
                    Fully Autonomous.
                  </span>
                </h1>

                <p className="text-slate-600 text-xs sm:text-[13px] leading-relaxed font-normal">
                  KPM is an AI-powered inventory and accounting platform for B2B businesses. We track your stock, reconcile your accounts, catch errors, and run autonomously — even when you&apos;re not logged in.
                </p>

                {/* Buttons */}
                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <Link
                    href="/inventory"
                    className="inline-flex items-center space-x-2 bg-[#0F172A] hover:bg-[#1E293B] text-white text-xs font-semibold px-5 py-2.5 rounded-full shadow-md transition-all"
                  >
                    <span>Get Started</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>

                  <button
                    onClick={() => setActiveModal("demo")}
                    className="inline-flex items-center space-x-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 text-xs font-semibold px-4 py-2.5 rounded-full shadow-2xs transition-all cursor-pointer"
                  >
                    <Play className="w-3 h-3 fill-slate-800 text-slate-800" />
                    <span>Watch Demo</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Right Status & 4 Metric Cards */}
            <div className="lg:col-span-4 flex flex-col justify-between space-y-3">
              
              {/* Top System Running Status Bar */}
              <div 
                onClick={() => setActiveModal("system-status")}
                className="p-3.5 rounded-2xl bg-white border border-slate-200/80 shadow-2xs flex items-center justify-between cursor-pointer hover:bg-slate-50/80 transition-colors"
              >
                <div className="flex items-center space-x-2.5">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                  </span>
                  <div>
                    <div className="text-xs font-bold text-emerald-700 leading-tight">System Running</div>
                    <div className="text-[10px] text-slate-400">All systems operational • Last sync {relativeSyncLabel(latestSync)}</div>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </div>

              {/* 4 Metric Cards (2x2 Grid) */}
              <div className="grid grid-cols-2 gap-3 flex-1">
                {/* 1. Total Stock Value */}
                <Link 
                  href="/inventory"
                  className="p-3.5 rounded-2xl bg-white border border-slate-200/80 shadow-card-subtle flex flex-col justify-between hover:border-slate-300 cursor-pointer transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
                      <Boxes className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="mt-3">
                    <div className="text-[10px] font-semibold text-slate-500">Total Stock Value</div>
                    <div className="text-lg sm:text-xl font-extrabold text-slate-900 mt-0.5">
                      ${inventoryState.metrics.totalStockValue.toLocaleString()}
                    </div>
                    <div className="text-[9.5px] font-semibold text-emerald-600 mt-1 flex items-center">
                      <ArrowUpRight className="w-3 h-3 mr-0.5" /> {stockTrendPct}% <span className="text-slate-400 font-normal ml-1">vs. last month</span>
                    </div>
                  </div>
                </Link>

                {/* 2. Accounts Balanced */}
                <Link
                  href="/accounting"
                  className="p-3.5 rounded-2xl bg-white border border-slate-200/80 shadow-card-subtle flex flex-col justify-between hover:border-slate-300 cursor-pointer transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
                      <Wallet className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="mt-3">
                    <div className="text-[10px] font-semibold text-slate-500">Accounts Balanced</div>
                    <div className="text-lg sm:text-xl font-extrabold text-slate-900 mt-0.5">{reconciliationRate}%</div>
                    <div className="text-[9.5px] font-semibold text-emerald-600 mt-1">
                      {profile.autoReconciliation ? "Auto-reconciled" : "Manual review"}
                    </div>
                  </div>
                </Link>

                {/* 3. Orders Processed */}
                <Link
                  href="/sales"
                  className="p-3.5 rounded-2xl bg-white border border-slate-200/80 shadow-card-subtle flex flex-col justify-between hover:border-slate-300 cursor-pointer transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
                      <ShoppingCart className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="mt-3">
                    <div className="text-[10px] font-semibold text-slate-500">Orders Processed</div>
                    <div className="text-lg sm:text-xl font-extrabold text-slate-900 mt-0.5">{salesState.metrics.totalOrders.toLocaleString()}</div>
                    <div className="text-[9.5px] font-semibold text-emerald-600 mt-1 flex items-center">
                      <ArrowUpRight className="w-3 h-3 mr-0.5" /> 8% <span className="text-slate-400 font-normal ml-1">vs. last 7 days</span>
                    </div>
                  </div>
                </Link>

                {/* 4. Errors Detected */}
                <button
                  type="button"
                  onClick={() => setActiveModal("errors")}
                  className="text-left p-3.5 rounded-2xl bg-white border border-slate-200/80 shadow-card-subtle flex flex-col justify-between hover:border-slate-300 cursor-pointer transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div className="w-8 h-8 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600">
                      <AlertTriangle className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="mt-3">
                    <div className="text-[10px] font-semibold text-slate-500">Errors Detected</div>
                    <div className="text-lg sm:text-xl font-extrabold text-slate-900 mt-0.5">{errorCount}</div>
                    <div className="text-[9.5px] font-semibold text-emerald-600 mt-1">
                      Auto-resolved
                    </div>
                  </div>
                </button>
              </div>
            </div>
          </div>

          {/* ======================================================= */}
          {/* SECTION B: 6 MODULE PILLS / CARDS ROW                   */}
          {/* ======================================================= */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {moduleTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeModuleTab === tab.id;
              const tabClassName = `relative p-3.5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
                isActive
                  ? "bg-white border-blue-500/80 shadow-card-subtle ring-1 ring-blue-500/20"
                  : "bg-white border-slate-200/80 hover:border-slate-300 hover:bg-slate-50/50 shadow-2xs"
              }`;
              const tabBody = (
                <>
                  <div className="flex items-center space-x-2.5">
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                        isActive
                          ? "bg-blue-600 text-white shadow-xs"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <div className="truncate">
                      <div className="text-[11.5px] font-bold text-slate-900 truncate">
                        {tab.name}
                      </div>
                      <div className="text-[9px] text-slate-400 truncate mt-0.5">
                        {tab.sub}
                      </div>
                    </div>
                  </div>
                  {isActive && (
                    <div className="absolute -bottom-[1px] left-6 right-6 h-[2.5px] bg-blue-600 rounded-full" />
                  )}
                </>
              );
              if (tab.href) {
                return (
                  <Link
                    key={tab.id}
                    href={tab.href}
                    onClick={() => setActiveModuleTab(tab.id)}
                    className={tabClassName}
                  >
                    {tabBody}
                  </Link>
                );
              }
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setActiveModuleTab(tab.id);
                    if (tab.id === "Integration Layer") setActiveModal("orders");
                    if (tab.id === "Automation Engine") setActiveModal("system-status");
                    if (tab.id === "Notifications & Insights") setActiveModal("activity-log");
                  }}
                  className={tabClassName}
                >
                  {tabBody}
                </button>
              );
            })}
          </div>

          {/* ======================================================= */}
          {/* SECTION C: LOWER THREE-COLUMN GRID                      */}
          {/* ======================================================= */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            
            {/* COLUMN 1: Inventory Overview (Col 4) */}
            <div className="lg:col-span-4 rounded-3xl bg-white border border-slate-200/80 p-5 shadow-card-subtle flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <h3 className="text-sm font-bold text-[#0F172A]">Inventory Overview</h3>
                  <Link 
                    href="/inventory" 
                    className="text-[11px] font-bold text-blue-600 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <span>View all</span> <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>

                {/* 3 Mini Inventory Metrics */}
                <div className="grid grid-cols-3 gap-2 my-4">
                  <div className="p-2.5 rounded-xl bg-slate-50/70 border border-slate-100">
                    <div className="text-[9px] font-medium text-slate-500">Total SKUs</div>
                    <div className="text-sm font-bold text-slate-900 mt-0.5">
                      {inventoryState.metrics.totalProducts.toLocaleString()}
                    </div>
                    <div className="text-[8.5px] font-semibold text-emerald-600 mt-0.5">↑ {stockTrendPct}%</div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-50/70 border border-slate-100">
                    <div className="text-[9px] font-medium text-slate-500">In Stock</div>
                    <div className="text-sm font-bold text-slate-900 mt-0.5">
                      {inventoryState.metrics.inStockCount.toLocaleString()}
                    </div>
                    <div className="text-[8.5px] font-semibold text-emerald-600 mt-0.5 flex items-center gap-1">
                      <span>{inStockRing.pct}%</span>
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="10" fill="none" stroke="#E2E8F0" strokeWidth="3" />
                        <circle
                          cx="12"
                          cy="12"
                          r="10"
                          fill="none"
                          stroke="#10B981"
                          strokeWidth="3"
                          strokeLinecap="round"
                          strokeDasharray={inStockRing.dash}
                          transform="rotate(-90 12 12)"
                        />
                      </svg>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => { window.location.href = "/inventory"; }}
                    className="text-left p-2.5 rounded-xl bg-slate-50/70 border border-slate-100 hover:border-amber-200 cursor-pointer"
                  >
                    <div className="text-[9px] font-medium text-slate-500">Low Stock</div>
                    <div className="text-sm font-bold text-slate-900 mt-0.5">
                      {inventoryState.metrics.lowStockCount.toLocaleString()}
                    </div>
                    <div className="text-[8.5px] font-semibold text-amber-600 mt-0.5 flex items-center gap-0.5">
                      <span>{inventoryState.metrics.lowStockPercentage}%</span>
                      <AlertTriangle className="w-2.5 h-2.5 text-amber-500" />
                    </div>
                  </button>
                </div>

                {/* Chart Graphic matching screenshot */}
                <div className="pt-2 relative">
                  <div
                    className="absolute z-10 px-2.5 py-1 rounded-lg bg-white border border-slate-200 shadow-md text-[9px] font-bold text-slate-800 flex items-center space-x-1.5 pointer-events-none"
                    style={{ left: `clamp(0px, ${activeChartPoint.x - 36}px, calc(100% - 120px))`, top: Math.max(0, activeChartPoint.y - 8) }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    <span>Stock increased</span>
                    <span className="text-emerald-600 font-semibold">+{stockTrendPct}%</span>
                  </div>

                  <div className="h-28 w-full relative">
                    <svg className="w-full h-full overflow-visible" viewBox="0 0 300 80">
                      <defs>
                        <linearGradient id="invGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.25" />
                          <stop offset="100%" stopColor="#3B82F6" stopOpacity="0.0" />
                        </linearGradient>
                      </defs>
                      <path d={chartAreaPath} fill="url(#invGradient)" />
                      <path d={chartPath} fill="none" stroke="#3B82F6" strokeWidth="2.2" strokeLinejoin="round" />
                      <circle cx={activeChartPoint.x} cy={activeChartPoint.y} r="4" fill="#3B82F6" stroke="#FFFFFF" strokeWidth="2" />
                      {weeklyStockSeries.map((point, index) => (
                        <rect
                          key={point.label}
                          x={point.x - 18}
                          y={0}
                          width={36}
                          height={80}
                          fill="transparent"
                          className="cursor-pointer"
                          onMouseEnter={() => setChartDay(index)}
                          onClick={() => setChartDay(index)}
                        />
                      ))}
                    </svg>
                  </div>

                  <div className="flex justify-between text-[9px] text-slate-400 mt-1 px-1">
                    {weeklyStockSeries.map((point, index) => (
                      <button
                        key={point.label}
                        type="button"
                        onClick={() => setChartDay(index)}
                        className={`cursor-pointer ${chartDay === index ? "text-blue-600 font-semibold" : ""}`}
                      >
                        {point.label}
                      </button>
                    ))}
                  </div>
                  <div className="text-[9px] text-slate-500 mt-1">
                    {activeChartPoint.label}: {activeChartPoint.value.toLocaleString()} units
                  </div>
                </div>
              </div>

              <div className="text-[10px] text-slate-400 pt-2 border-t border-slate-100 flex justify-between">
                <span>Total Active SKU Units</span>
                <span className="font-semibold text-slate-700">
                  {inventoryState.products.reduce((acc, p) => acc + p.stock, 0).toLocaleString()} units
                </span>
              </div>
            </div>

            {/* COLUMN 2: Recent Activity (Col 4) */}
            <div className="lg:col-span-4 rounded-3xl bg-white border border-slate-200/80 p-5 shadow-card-subtle flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <h3 className="text-sm font-bold text-[#0F172A]">Recent Activity</h3>
                  <button 
                    onClick={() => setActiveModal("activity-log")} 
                    className="text-[11px] font-bold text-blue-600 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <span>View all</span> <ArrowRight className="w-3 h-3" />
                  </button>
                </div>

                {/* Activity Feed Items */}
                <div className="space-y-3 mt-3.5">
                  {filteredActivities.map((act) => {
                    const Icon = act.icon;
                    return (
                      <div
                        key={act.id}
                        onClick={() => setSelectedActivity(act)}
                        className="flex items-start space-x-3 p-2 rounded-2xl hover:bg-slate-50 transition-colors cursor-pointer group"
                      >
                        <div
                          className={`w-8 h-8 rounded-xl border flex items-center justify-center flex-shrink-0 ${act.color}`}
                        >
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                              {act.title}
                            </span>
                            <span className="text-[9.5px] text-slate-400">{act.time}</span>
                          </div>
                          <p className="text-[11px] text-slate-500 truncate mt-0.5">
                            {act.desc}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="text-[10px] text-slate-400 pt-2 border-t border-slate-100 flex justify-between">
                <span>Auto-Reconciliation Engine</span>
                <span className="font-semibold text-emerald-600">Active (24/7)</span>
              </div>
            </div>

            {/* COLUMN 3: KPM AI & Business Performance (Col 4) */}
            <div className="lg:col-span-4 flex flex-col justify-between space-y-4">
              
              {/* Top: KPM AI Interactive Prompt Card */}
              <div className="rounded-3xl bg-[#0F172A] text-white p-5 shadow-xl relative overflow-hidden flex flex-col justify-between">
                {/* Wavy abstract fluid ribbon SVG in top right */}
                <div className="absolute top-0 right-0 w-44 h-40 pointer-events-none opacity-40">
                  <svg viewBox="0 0 200 200" className="w-full h-full">
                    <path
                      d="M 50 0 C 80 40, 140 30, 180 80 C 220 130, 160 170, 200 200 L 200 0 Z"
                      fill="url(#aiMeshGrad)"
                    />
                    <defs>
                      <linearGradient id="aiMeshGrad" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="#6366F1" />
                        <stop offset="50%" stopColor="#A855F7" />
                        <stop offset="100%" stopColor="#3B82F6" />
                      </linearGradient>
                    </defs>
                  </svg>
                </div>

                <div className="relative z-10 space-y-2">
                  <div className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-slate-800/80 border border-slate-700/60 text-[10px] font-semibold text-slate-300">
                    <Sparkles className="w-3 h-3 text-indigo-400" />
                    <span>KPM AI</span>
                  </div>

                  <h3 className="text-base font-bold text-white tracking-tight">
                    Ask anything. Get answers.
                  </h3>
                  <p className="text-[11.5px] text-slate-300 leading-snug font-normal">
                    From stock levels to financial insights — just ask in plain English.
                  </p>

                  {/* AI Response Display if available */}
                  {aiResponse && (
                    <div className="mt-2 p-2.5 rounded-xl bg-slate-800/90 border border-slate-700 text-[11px] text-slate-200 animate-in fade-in duration-150">
                      {aiResponse}
                    </div>
                  )}
                </div>

                {/* Interactive AI Input Bar */}
                <form onSubmit={handleAiSubmit} className="relative mt-4 z-10">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    id="ai-search-input"
                    type="text"
                    placeholder="e.g. Show me what went wrong this month..."
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    className="w-full pl-9 pr-10 py-2.5 rounded-full bg-slate-800/90 border border-slate-700/80 text-[11px] text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500 transition-all"
                  />
                  <button
                    type="submit"
                    disabled={aiLoading}
                    className="w-7 h-7 rounded-full bg-white hover:bg-slate-200 text-slate-900 flex items-center justify-center absolute right-1.5 top-1/2 -translate-y-1/2 shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </form>
              </div>

              {/* Bottom: Business Performance Card */}
              <div className="rounded-3xl bg-white border border-slate-200/80 p-5 shadow-card-subtle flex flex-col justify-between flex-1">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <h3 className="text-xs font-bold text-[#0F172A]">Business Performance</h3>
                  <button 
                    onClick={() => setActiveModal("financial-report")}
                    className="text-[10px] font-bold text-blue-600 hover:underline flex items-center gap-0.5 cursor-pointer"
                  >
                    <span>View report</span> <ArrowRight className="w-2.5 h-2.5" />
                  </button>
                </div>

                {/* Performance Metrics: Revenue & Profit Margin */}
                <div className="grid grid-cols-2 gap-3 my-3">
                  <div>
                    <div className="text-[9px] font-medium text-slate-400">Revenue (YTD)</div>
                    <div className="text-base font-extrabold text-slate-900 mt-0.5">{formatCurrency(accountingMetrics.totalRevenue)}</div>
                    <div className="text-[8.5px] font-semibold text-emerald-600 mt-0.5 flex items-center">
                      <ArrowUpRight className="w-2.5 h-2.5 mr-0.5" /> 18%
                    </div>
                    {/* Mini bar chart matching screenshot */}
                    <div className="flex items-end space-x-1 h-5 mt-2">
                      <div className="w-1.5 bg-blue-200 rounded-xs h-2" />
                      <div className="w-1.5 bg-blue-300 rounded-xs h-2.5" />
                      <div className="w-1.5 bg-blue-400 rounded-xs h-3.5" />
                      <div className="w-1.5 bg-blue-500 rounded-xs h-4" />
                      <div className="w-1.5 bg-blue-600 rounded-xs h-5" />
                    </div>
                  </div>

                  <div>
                    <div className="text-[9px] font-medium text-slate-400">Profit Margin</div>
                    <div className="text-base font-extrabold text-slate-900 mt-0.5">
                      {profitMargin.toFixed(1)}%
                    </div>
                    <div className="text-[8.5px] font-semibold text-emerald-600 mt-0.5 flex items-center">
                      <ArrowUpRight className="w-2.5 h-2.5 mr-0.5" /> 4.2%
                    </div>
                    {/* Mini Sparkline */}
                    <div className="h-5 w-full mt-2">
                      <svg className="w-full h-full" viewBox="0 0 60 20">
                        <path
                          d="M 0 16 Q 15 12, 30 14 T 60 4"
                          fill="none"
                          stroke="#3B82F6"
                          strokeWidth="1.8"
                        />
                      </svg>
                    </div>
                  </div>
                </div>

                <div className="text-[9.5px] text-slate-400 pt-1.5 border-t border-slate-100 flex justify-between">
                  <span>Audited Financials</span>
                  <span className="font-semibold text-slate-700">GAAP Compliant</span>
                </div>
              </div>
            </div>
          </div>

          {/* ======================================================= */}
          {/* SECTION D: BOTTOM SECURITY & COMPLIANCE FOOTER          */}
          {/* ======================================================= */}
          <div className="rounded-2xl bg-white border border-slate-200/80 px-5 py-3.5 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-slate-600">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <span className="inline-flex items-center gap-1.5 font-medium">
                <ShieldCheck className="w-3.5 h-3.5 text-blue-600" /> Enterprise-grade security
              </span>
              <span className="inline-flex items-center gap-1.5 font-medium">
                <Lock className="w-3.5 h-3.5 text-blue-600" /> Zero-trust architecture
              </span>
              <span className="inline-flex items-center gap-1.5 font-medium">
                <Server className="w-3.5 h-3.5 text-blue-600" /> End-to-end encryption
              </span>
              <span className="inline-flex items-center gap-1.5 font-medium">
                <Database className="w-3.5 h-3.5 text-blue-600" /> SOC 2 ready
              </span>
            </div>
            <button 
              onClick={() => setActiveModal("security")}
              className="font-bold text-blue-600 hover:underline flex items-center space-x-1 flex-shrink-0 cursor-pointer"
            >
              <span>Learn more</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </main>
      </div>

      {/* ========================================================= */}
      {/* INTERACTIVE MODALS & DETAIL POPUPS                        */}
      {/* ========================================================= */}

      {/* 1. Activity Detail Modal */}
      {selectedActivity && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2.5">
                <div className={`w-8 h-8 rounded-xl border flex items-center justify-center ${selectedActivity.color}`}>
                  <selectedActivity.icon className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-slate-900 text-sm">{selectedActivity.title}</h3>
              </div>
              <button onClick={() => setSelectedActivity(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-2 text-xs text-slate-600">
              <p><strong>Description:</strong> {selectedActivity.desc}</p>
              <p><strong>Timestamp:</strong> {selectedActivity.time}</p>
              <p><strong>Status:</strong> <span className="text-emerald-600 font-semibold">Processed Autonomously</span></p>
            </div>
            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setSelectedActivity(null)}
                className="px-4 py-2 bg-slate-900 text-white rounded-full text-xs font-semibold hover:bg-slate-800"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Generic Modal Dialogs (Demo, System Status, Reports, Security) */}
      {activeModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-base capitalize">
                {activeModal === "demo" && "Autonomous Reconciliation Demo"}
                {activeModal === "system-status" && "System Health & Live Telemetry"}
                {activeModal === "financial-report" && "Business Financial Report"}
                {activeModal === "security" && "Security & Compliance Overview"}
                {activeModal === "Inventory" && "Inventory SKU Registry"}
                {activeModal === "Accounting" && "General Ledger & Bank Feeds"}
                {activeModal === "Settings" && "Account Settings"}
                {activeModal === "orders" && "B2B Order Stream"}
                {activeModal === "errors" && "Automated Error Resolution"}
                {activeModal === "activity-log" && "Full Activity Audit Trail"}
              </h3>
              <button onClick={() => setActiveModal(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-600">
              {activeModal === "demo" && (
                <div className="space-y-2">
                  <div className="p-3 rounded-2xl bg-slate-900 text-white font-mono text-[11px] leading-relaxed">
                    <p className="text-emerald-400">&gt; Initializing KPM autonomous daemon...</p>
                    <p className="text-blue-300">&gt; Synced {inventoryState.metrics.totalProducts.toLocaleString()} SKUs ({inventoryState.metrics.inStockPercentage}% in stock)</p>
                    <p className="text-amber-300">&gt; Checking ledger against {accountingState.transactions.length} transactions...</p>
                    <p className="text-emerald-400">&gt; {reconciliationRate}% matched. {errorCount} alerts auto-triaged.</p>
                  </div>
                  <p className="text-slate-500">KPM operates 24/7 in the background with zero manual spreadsheets needed.</p>
                  <Link href="/insights" className="inline-flex items-center gap-1 text-blue-600 font-semibold">
                    Open AI Insights <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              )}

              {activeModal === "system-status" && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50">
                    <span className="font-semibold">FastAPI Microservice</span>
                    <span className="text-emerald-600 font-bold flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> 99.99% Uptime</span>
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50">
                    <span className="font-semibold">PostgreSQL Relational DB</span>
                    <span className="text-emerald-600 font-bold flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> Connected</span>
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50">
                    <span className="font-semibold">Accounting Live Sync</span>
                    <span className="text-emerald-600 font-bold flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> {relativeSyncLabel(latestSync)}</span>
                  </div>
                </div>
              )}

              {activeModal === "financial-report" && (
                <div className="space-y-2">
                  <p><strong>Total Revenue:</strong> {formatCurrency(accountingMetrics.totalRevenue)}</p>
                  <p><strong>Total Expenses:</strong> {formatCurrency(accountingMetrics.totalExpenses)}</p>
                  <p><strong>Net Profit:</strong> {formatCurrency(accountingMetrics.netProfit)}</p>
                  <p><strong>Cash Balance:</strong> {formatCurrency(accountingMetrics.cashBalance)}</p>
                  <p><strong>Outstanding Invoices:</strong> {formatCurrency(accountingMetrics.outstandingInvoices)}</p>
                </div>
              )}

              {activeModal === "security" && (
                <div className="space-y-2">
                  <p><strong>Encryption:</strong> AES-256 at rest, TLS 1.3 in transit.</p>
                  <p><strong>Compliance:</strong> SOC 2 Type II certified, GDPR & HIPAA ready.</p>
                  <p><strong>Access Control:</strong> Role-based RBAC with multi-factor authentication (MFA).</p>
                </div>
              )}

              {activeModal === "Inventory" && (
                <div className="space-y-2">
                  <p><strong>Total Active SKUs:</strong> {inventoryState.metrics.totalProducts.toLocaleString()} items</p>
                  <p><strong>In Stock:</strong> {inventoryState.metrics.inStockCount.toLocaleString()} ({inventoryState.metrics.inStockPercentage}% fill rate)</p>
                  <p><strong>Low Stock Alert:</strong> {inventoryState.metrics.lowStockCount.toLocaleString()} items</p>
                  <p><strong>Stock Value:</strong> ${inventoryState.metrics.totalStockValue.toLocaleString()}</p>
                  <Link href="/inventory" className="inline-flex items-center gap-1 text-blue-600 font-semibold pt-1">
                    Open Inventory <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              )}

              {activeModal === "Accounting" && (
                <div className="space-y-2">
                  <p><strong>Organization:</strong> {profile.organization}</p>
                  <p><strong>Cash Balance:</strong> {formatCurrency(accountingMetrics.cashBalance)}</p>
                  <p><strong>Auto-Reconciliation:</strong> {profile.autoReconciliation ? `${reconciliationRate}% enabled` : "Disabled"}</p>
                  <p><strong>Outstanding Invoices:</strong> {formatCurrency(accountingMetrics.outstandingInvoices)}</p>
                  <Link href="/accounting" className="inline-flex items-center gap-1 text-blue-600 font-semibold pt-1">
                    Open Accounting <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              )}

              {activeModal === "Settings" && (
                <form onSubmit={saveSettings} className="space-y-3">
                  <label className="block font-semibold text-slate-700">
                    Full name
                    <input
                      value={settingsForm.fullName}
                      onChange={(event) => setSettingsForm({ ...settingsForm, fullName: event.target.value })}
                      className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-xl outline-none focus:border-blue-400"
                    />
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="font-semibold text-slate-700">
                      Role
                      <input
                        value={settingsForm.role}
                        onChange={(event) => setSettingsForm({ ...settingsForm, role: event.target.value })}
                        className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-xl outline-none focus:border-blue-400"
                      />
                    </label>
                    <label className="font-semibold text-slate-700">
                      Organization
                      <input
                        value={settingsForm.organization}
                        onChange={(event) => setSettingsForm({ ...settingsForm, organization: event.target.value })}
                        className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-xl outline-none focus:border-blue-400"
                      />
                    </label>
                  </div>
                  <label className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-3 font-semibold">
                    Auto-reconciliation
                    <input
                      type="checkbox"
                      checked={settingsForm.autoReconciliation}
                      onChange={(event) => setSettingsForm({ ...settingsForm, autoReconciliation: event.target.checked })}
                    />
                  </label>
                  <label className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-3 font-semibold">
                    Sales and payment notifications
                    <input
                      type="checkbox"
                      checked={settingsForm.notificationsEnabled}
                      onChange={(event) => setSettingsForm({ ...settingsForm, notificationsEnabled: event.target.checked })}
                    />
                  </label>
                  <div className="flex justify-end gap-2 pt-1">
                    <button type="button" onClick={() => setActiveModal(null)} className="px-4 py-2 border border-slate-200 rounded-xl font-semibold text-slate-600 cursor-pointer">
                      Cancel
                    </button>
                    <button disabled={settingsSaving} className="px-5 py-2 bg-slate-900 text-white rounded-xl font-semibold cursor-pointer disabled:opacity-60">
                      {settingsSaving ? "Saving..." : "Save Settings"}
                    </button>
                  </div>
                </form>
              )}

              {activeModal === "orders" && (
                <div className="space-y-2">
                  <p><strong>Orders Processed:</strong> {salesState.metrics.totalOrders.toLocaleString()}</p>
                  <p><strong>Sales Revenue:</strong> {formatCurrency(salesState.metrics.totalRevenue)}</p>
                  <p><strong>Average Order Value:</strong> {formatCurrency(salesState.metrics.averageOrderValue)}</p>
                  <Link href="/sales" className="inline-flex items-center gap-1 text-blue-600 font-semibold pt-1">
                    Open Sales <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              )}

              {activeModal === "errors" && (
                <div className="space-y-2">
                  <p><strong>Errors Detected:</strong> {errorCount}</p>
                  <p><strong>Low Stock SKUs:</strong> {inventoryState.metrics.lowStockCount}</p>
                  <p><strong>Status:</strong> Auto-triaged by KPM with live inventory alerts</p>
                  <div className="space-y-1.5 max-h-36 overflow-y-auto">
                    {inventoryState.alerts.slice(0, 4).map((alert) => (
                      <div key={alert.id} className="p-2 rounded-xl bg-slate-50">
                        <div className="font-semibold text-slate-800">{alert.title}</div>
                        <div className="text-[10px] text-slate-500">{alert.subtitle}</div>
                      </div>
                    ))}
                  </div>
                  <Link href="/inventory" className="inline-flex items-center gap-1 text-blue-600 font-semibold pt-1">
                    Review Inventory <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              )}

              {activeModal === "activity-log" && (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {filteredActivities.map((act) => (
                    <div key={act.id} className="p-2 bg-slate-50 rounded-xl">
                      <div className="font-semibold text-slate-800">{act.title}</div>
                      <div className="text-[10px] text-slate-500">{act.desc} • {act.time}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {activeModal !== "Settings" && (
            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setActiveModal(null)}
                className="px-5 py-2 bg-slate-900 text-white rounded-full text-xs font-semibold hover:bg-slate-800 cursor-pointer"
              >
                Close
              </button>
            </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
