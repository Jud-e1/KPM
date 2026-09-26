"use client";

import React, { useMemo, useState } from "react";
import { KpmLogoImage } from "@/components/ui/Logo";
import {
  LayoutDashboard,
  Boxes,
  Receipt,
  LineChart,
  Truck,
  Users,
  BarChart3,
  Settings,
  Bell,
  Search,
  ArrowUpRight,
  TrendingUp,
  ShieldAlert,
  Network,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";

interface DashboardMockupProps {
  onOrderNowClick: () => void;
  onViewForecastClick: () => void;
  onErrorDetectionClick: () => void;
  onB2BIntegrationClick: () => void;
}

/** Marketing-only numbers — not connected to live app stores. */
const MARKETING = {
  fullName: "Alex Morgan",
  organization: "Northwind Trading",
  stockValue: 482650,
  ordersProcessed: 1248,
  reconciliationRate: 98,
  errorCount: 3,
  stockTrend: 12,
  demandLift: 24,
  activities: [
    { id: "a1", title: "Reconciled 3 transactions", time: "2 mins ago", tone: "blue" as const },
    { id: "a2", title: "Auto-ordered from Supplier (Acme Ltd.)", time: "5 mins ago", tone: "emerald" as const },
    { id: "a3", title: "Flagged 2 potential duplicate invoices", time: "12 mins ago", tone: "amber" as const },
  ],
};

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}

function greetingForHour(hour: number) {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function profileInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export const DashboardMockup: React.FC<DashboardMockupProps> = ({
  onOrderNowClick,
  onViewForecastClick,
  onErrorDetectionClick,
  onB2BIntegrationClick,
}) => {
  const [activeTab, setActiveTab] = useState("Dashboard");
  const [searchQuery, setSearchQuery] = useState("");

  const firstName = MARKETING.fullName.split(" ")[0];
  const greeting = greetingForHour(new Date().getHours());
  const initials = useMemo(() => profileInitials(MARKETING.fullName), []);

  const chartPoints = useMemo(() => {
    const totalUnits = 1200;
    const xs = [0, 45, 90, 140, 190, 235, 280];
    return xs.map((x, index) => {
      const wave = Math.sin((index + 1) / 2.1) * 0.12 + index * 0.035;
      const value = totalUnits * (0.72 + wave);
      const max = totalUnits * 1.05;
      const y = 62 - (value / max) * 48;
      return { x, y: Math.max(12, Math.min(58, y)) };
    });
  }, []);

  const chartPath = chartPoints
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y.toFixed(1)}`)
    .join(" ");
  const areaPath = `${chartPath} L 280 68 L 0 68 Z`;

  const filteredActivity = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return MARKETING.activities.slice(0, 3);
    return MARKETING.activities.filter((item) => item.title.toLowerCase().includes(q)).slice(0, 3);
  }, [searchQuery]);

  const sidebarItems = [
    { name: "Dashboard", icon: LayoutDashboard },
    { name: "Inventory", icon: Boxes },
    { name: "Accounting", icon: Receipt },
    { name: "Insights", icon: LineChart },
    { name: "Suppliers", icon: Truck },
    { name: "B2B Partners", icon: Users },
    { name: "Reports", icon: BarChart3 },
    { name: "Settings", icon: Settings },
  ];

  return (
    <div className="relative mx-auto w-full max-w-[920px] overflow-hidden rounded-2xl border border-white/60 bg-[#F4F7FB] shadow-[0_40px_80px_-40px_rgba(15,23,42,0.45)]">
      <div className="flex min-h-[420px]">
        <aside className="hidden w-[200px] shrink-0 border-r border-[#E8EEF6] bg-[var(--app-surface)] p-4 md:block">
          <div className="mb-6 flex items-center gap-2">
            <KpmLogoImage className="h-7 w-7" />
            <span className="text-sm font-bold tracking-tight text-[#0F172A]">KPM</span>
          </div>
          <nav className="space-y-1">
            {sidebarItems.map((item) => {
              const Icon = item.icon;
              const active = activeTab === item.name;
              return (
                <button
                  key={item.name}
                  type="button"
                  onClick={() => setActiveTab(item.name)}
                  className={`flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-[12px] font-medium ${
                    active ? "bg-[#0F172A] text-white" : "text-[#64748B] hover:bg-[#F1F5F9]"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {item.name}
                </button>
              );
            })}
          </nav>
        </aside>

        <div className="min-w-0 flex-1 p-4 sm:p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-medium text-[#94A3B8]">{MARKETING.organization}</p>
              <h3 className="text-[18px] font-bold tracking-tight text-[#0F172A]">
                {greeting}, {firstName}
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative hidden sm:block">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#94A3B8]" />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search…"
                  className="h-8 w-40 rounded-full border border-[#E2E8F0] bg-[var(--app-surface)] pl-8 pr-3 text-[11px] outline-none"
                />
              </div>
              <button type="button" className="flex h-8 w-8 items-center justify-center rounded-full border border-[#E2E8F0] bg-[var(--app-surface)] text-[#64748B]">
                <Bell className="h-3.5 w-3.5" />
              </button>
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#0F172A] text-[10px] font-bold text-white">
                {initials || "AM"}
              </div>
            </div>
          </div>

          <div className="mb-3 grid grid-cols-2 gap-2 lg:grid-cols-4">
            {[
              { label: "Stock value", value: formatCurrency(MARKETING.stockValue), delta: `+${MARKETING.stockTrend}%` },
              { label: "Orders", value: MARKETING.ordersProcessed.toLocaleString(), delta: "+8%" },
              { label: "Reconciled", value: `${MARKETING.reconciliationRate}%`, delta: "Auto" },
              { label: "Alerts", value: String(MARKETING.errorCount), delta: "Watch" },
            ].map((card) => (
              <div key={card.label} className="rounded-xl border border-[#E7EEF8] bg-[var(--app-surface)] p-3">
                <div className="text-[10px] text-[#94A3B8]">{card.label}</div>
                <div className="mt-1 text-[16px] font-bold text-[#0F172A]">{card.value}</div>
                <div className="mt-1 inline-flex items-center gap-0.5 text-[10px] font-semibold text-emerald-600">
                  <ArrowUpRight className="h-3 w-3" /> {card.delta}
                </div>
              </div>
            ))}
          </div>

          <div className="grid gap-3 lg:grid-cols-5">
            <div className="rounded-xl border border-[#E7EEF8] bg-[var(--app-surface)] p-3 lg:col-span-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[12px] font-semibold text-[#0F172A]">Inventory trend</span>
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600">
                  <TrendingUp className="h-3 w-3" /> Demand +{MARKETING.demandLift}%
                </span>
              </div>
              <svg viewBox="0 0 280 68" className="h-24 w-full">
                <path d={areaPath} fill="#DBEAFE" opacity="0.8" />
                <path d={chartPath} fill="none" stroke="#2563EB" strokeWidth="2.2" />
              </svg>
              <div className="mt-2 flex flex-wrap gap-2">
                <button type="button" onClick={onOrderNowClick} className="inline-flex items-center gap-1 rounded-lg bg-[#0F172A] px-2.5 py-1.5 text-[10px] font-semibold text-white">
                  Order now <ArrowRight className="h-3 w-3" />
                </button>
                <button type="button" onClick={onViewForecastClick} className="inline-flex items-center gap-1 rounded-lg border border-[#E2E8F0] px-2.5 py-1.5 text-[10px] font-semibold text-[#334155]">
                  View forecast
                </button>
              </div>
            </div>

            <div className="space-y-2 lg:col-span-2">
              <div className="rounded-xl border border-[#E7EEF8] bg-[var(--app-surface)] p-3">
                <div className="mb-2 text-[12px] font-semibold">Live activity</div>
                <ul className="space-y-2">
                  {filteredActivity.map((item) => (
                    <li key={item.id} className="flex items-start gap-2 text-[11px]">
                      <CheckCircle2
                        className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${
                          item.tone === "emerald" ? "text-emerald-500" : item.tone === "amber" ? "text-amber-500" : "text-blue-500"
                        }`}
                      />
                      <span>
                        <span className="font-medium text-[#0F172A]">{item.title}</span>
                        <span className="mt-0.5 block text-[#94A3B8]">{item.time}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={onErrorDetectionClick} className="rounded-xl border border-[#FEE2E2] bg-[#FEF2F2] p-2.5 text-left">
                  <ShieldAlert className="mb-1 h-3.5 w-3.5 text-rose-500" />
                  <div className="text-[10px] font-semibold text-[#0F172A]">Error detection</div>
                </button>
                <button type="button" onClick={onB2BIntegrationClick} className="rounded-xl border border-[#DBEAFE] bg-[#EFF6FF] p-2.5 text-left">
                  <Network className="mb-1 h-3.5 w-3.5 text-blue-600" />
                  <div className="text-[10px] font-semibold text-[#0F172A]">B2B sync</div>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
