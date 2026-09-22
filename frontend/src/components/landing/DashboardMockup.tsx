"use client";

import React, { useState } from "react";
import {
  LayoutDashboard,
  Boxes,
  Receipt,
  Sparkles,
  Truck,
  Users,
  BarChart3,
  Settings,
  Bell,
  Search,
  ArrowUpRight,
  TrendingUp,
  PackageCheck,
  ShieldAlert,
  Network,
  ArrowRight,
  CheckCircle2,
  ChevronDown
} from "lucide-react";

interface DashboardMockupProps {
  onOrderNowClick: () => void;
  onViewForecastClick: () => void;
  onErrorDetectionClick: () => void;
  onB2BIntegrationClick: () => void;
}

export const DashboardMockup: React.FC<DashboardMockupProps> = ({
  onOrderNowClick,
  onViewForecastClick,
  onErrorDetectionClick,
  onB2BIntegrationClick,
}) => {
  const [activeTab, setActiveTab] = useState("Dashboard");
  const [searchQuery, setSearchQuery] = useState("");

  const sidebarItems = [
    { name: "Dashboard", icon: LayoutDashboard },
    { name: "Inventory", icon: Boxes },
    { name: "Accounting", icon: Receipt },
    { name: "AI Insights", icon: Sparkles },
    { name: "Suppliers", icon: Truck },
    { name: "B2B Partners", icon: Users },
    { name: "Reports", icon: BarChart3 },
    { name: "Settings", icon: Settings },
  ];

  return (
    <div className="relative w-full max-w-[700px] lg:max-w-none mx-auto select-none">
      {/* 3D Soft Curved Background Plate matching the screenshot */}
      <div className="absolute -top-10 -right-6 -bottom-8 -left-6 bg-gradient-to-tr from-slate-200/50 via-slate-100/60 to-slate-200/40 rounded-[40px] -rotate-1 transform -z-10 blur-[1px] hidden sm:block shadow-inner" />

      {/* Main Glass/White Dashboard Container */}
      <div className="bg-white rounded-[22px] border border-slate-200/80 shadow-[0_25px_60px_-15px_rgba(15,23,42,0.12)] p-3 sm:p-4 text-[#0F172A] relative z-10 transition-all">
        {/* Top App Header */}
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
          <div className="flex items-center space-x-2">
            <svg width="18" height="18" viewBox="0 0 32 30" fill="none">
              <path d="M4 3H10V27H4V3Z" fill="#0F172A" />
              <path d="M11 15L22 3H29L17 16L29 27H22L11 15Z" fill="#0F172A" />
            </svg>
            <span className="font-bold text-xs tracking-tight text-[#0F172A]">KPM</span>
          </div>

          {/* Search Input */}
          <div className="relative w-44 sm:w-60">
            <Search className="w-3 h-3 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search anything..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-7 pr-2 py-1 bg-slate-50 border border-slate-200/70 rounded-md text-[11px] text-slate-700 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-slate-300 transition-all"
            />
          </div>

          {/* User Profile & Notifications */}
          <div className="flex items-center space-x-2.5">
            <div className="relative cursor-pointer">
              <Bell className="w-3.5 h-3.5 text-slate-500 hover:text-slate-800" />
              <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-rose-500 rounded-full" />
            </div>
            <div className="flex items-center space-x-1.5 pl-1.5 border-l border-slate-100">
              <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-amber-400 to-orange-500 flex items-center justify-center text-[9px] font-bold text-white shadow-sm overflow-hidden">
                <img
                  src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=60&h=60&fit=crop&crop=faces"
                  alt="Alex"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="hidden sm:block text-left">
                <div className="text-[10px] font-bold text-slate-800 leading-none">Alex Johnson</div>
                <div className="text-[8px] text-slate-400 leading-tight">Admin</div>
              </div>
            </div>
          </div>
        </div>

        {/* Dashboard Body with Sidebar + Main View */}
        <div className="grid grid-cols-12 gap-3">
          {/* Mini Sidebar */}
          <div className="col-span-3 hidden sm:flex flex-col space-y-0.5 pr-2 border-r border-slate-100 text-[10.5px]">
            {sidebarItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.name;
              return (
                <button
                  key={item.name}
                  onClick={() => setActiveTab(item.name)}
                  className={`flex items-center space-x-2 px-2 py-1.5 rounded-lg text-left font-medium transition-colors cursor-pointer ${
                    isActive
                      ? "bg-blue-50/80 text-blue-600 font-semibold"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? "text-blue-600" : "text-slate-400"}`} />
                  <span className="truncate">{item.name}</span>
                </button>
              );
            })}
          </div>

          {/* Main Content Area */}
          <div className="col-span-12 sm:col-span-9 space-y-2.5">
            {/* Greeting Header */}
            <div>
              <h4 className="text-[13px] font-bold text-slate-900 leading-tight">
                Good morning, Alex 👋
              </h4>
              <p className="text-[10px] text-slate-400">
                Here&apos;s what&apos;s happening with your business today.
              </p>
            </div>

            {/* 4 Metric Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {/* Card 1 */}
              <div className="p-2 rounded-xl bg-slate-50/70 border border-slate-100">
                <div className="text-[9px] font-medium text-slate-500">Total Stock Value</div>
                <div className="text-[14px] font-bold text-slate-900 mt-0.5">$482,650</div>
                <div className="text-[8.5px] font-semibold text-emerald-600 flex items-center mt-0.5">
                  <ArrowUpRight className="w-2.5 h-2.5 mr-0.5" /> 12% vs last month
                </div>
              </div>

              {/* Card 2 */}
              <div className="p-2 rounded-xl bg-slate-50/70 border border-slate-100">
                <div className="text-[9px] font-medium text-slate-500 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Accounts Balanced
                </div>
                <div className="text-[14px] font-bold text-slate-900 mt-0.5">100%</div>
                <div className="text-[8.5px] font-semibold text-emerald-600 mt-0.5">
                  Auto-reconciled
                </div>
              </div>

              {/* Card 3 */}
              <div className="p-2 rounded-xl bg-slate-50/70 border border-slate-100">
                <div className="text-[9px] font-medium text-slate-500">Orders Processed</div>
                <div className="text-[14px] font-bold text-slate-900 mt-0.5">1,248</div>
                <div className="text-[8.5px] font-semibold text-emerald-600 flex items-center mt-0.5">
                  <ArrowUpRight className="w-2.5 h-2.5 mr-0.5" /> 8% vs last month
                </div>
              </div>

              {/* Card 4 */}
              <div className="p-2 rounded-xl bg-slate-50/70 border border-slate-100">
                <div className="text-[9px] font-medium text-slate-500 flex items-center gap-1 text-amber-600">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> Errors Detected
                </div>
                <div className="text-[14px] font-bold text-slate-900 mt-0.5">3</div>
                <div className="text-[8.5px] font-semibold text-emerald-600 mt-0.5">
                  Auto-resolved
                </div>
              </div>
            </div>

            {/* Middle Row: Inventory Chart + AI Insights */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
              {/* Inventory Overview Chart */}
              <div className="sm:col-span-8 p-2.5 rounded-xl bg-slate-50/50 border border-slate-100">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-bold text-slate-800">Inventory Overview</span>
                  <div className="flex items-center space-x-2 text-[8px] text-slate-500">
                    <span className="flex items-center gap-0.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Stock Level
                    </span>
                    <span className="flex items-center gap-0.5">
                      <span className="w-1.5 h-0.5 bg-slate-400" /> Reorder Level
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-semibold flex items-center gap-0.5 border border-emerald-200/60">
                      <CheckCircle2 className="w-2 h-2 text-emerald-600" /> Stock healthy
                    </span>
                  </div>
                </div>

                {/* Smooth Vector Line Chart */}
                <div className="h-20 w-full relative">
                  <svg className="w-full h-full overflow-visible" viewBox="0 0 280 70">
                    <defs>
                      <linearGradient id="stockGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10B981" stopOpacity="0.25" />
                        <stop offset="100%" stopColor="#10B981" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>

                    {/* Grid lines */}
                    <line x1="0" y1="15" x2="280" y2="15" stroke="#E2E8F0" strokeDasharray="3 3" strokeWidth="0.5" />
                    <line x1="0" y1="40" x2="280" y2="40" stroke="#E2E8F0" strokeDasharray="3 3" strokeWidth="0.5" />
                    <line x1="0" y1="65" x2="280" y2="65" stroke="#E2E8F0" strokeWidth="0.5" />

                    {/* Reorder Level Threshold Line */}
                    <line x1="0" y1="48" x2="280" y2="48" stroke="#94A3B8" strokeDasharray="2 2" strokeWidth="1" />

                    {/* Area fill */}
                    <path
                      d="M 0 52 Q 40 45, 80 32 T 160 30 T 220 22 T 280 18 L 280 68 L 0 68 Z"
                      fill="url(#stockGrad)"
                    />

                    {/* Green stock level line */}
                    <path
                      d="M 0 52 Q 40 45, 80 32 T 160 30 T 220 22 T 280 18"
                      fill="none"
                      stroke="#10B981"
                      strokeWidth="1.8"
                    />

                    {/* Plotted points */}
                    <circle cx="0" cy="52" r="2" fill="#10B981" />
                    <circle cx="45" cy="42" r="2" fill="#10B981" />
                    <circle cx="90" cy="30" r="2" fill="#10B981" />
                    <circle cx="140" cy="33" r="2" fill="#10B981" />
                    <circle cx="190" cy="26" r="2" fill="#10B981" />
                    <circle cx="235" cy="22" r="2" fill="#10B981" />
                    <circle cx="280" cy="18" r="2" fill="#10B981" />
                  </svg>
                </div>

                {/* X Axis Months */}
                <div className="flex justify-between text-[8px] text-slate-400 mt-1 px-1">
                  <span>Jan</span>
                  <span>Feb</span>
                  <span>Mar</span>
                  <span>Apr</span>
                  <span>May</span>
                  <span>Jun</span>
                  <span>Jul</span>
                </div>
              </div>

              {/* AI Insights Card */}
              <div className="sm:col-span-4 p-2.5 rounded-xl bg-gradient-to-br from-indigo-50/70 to-purple-50/50 border border-indigo-100 flex flex-col justify-between">
                <div>
                  <div className="flex items-center space-x-1.5 text-indigo-700 text-[10px] font-bold">
                    <Sparkles className="w-3 h-3 text-indigo-600" />
                    <span>AI Insights</span>
                  </div>
                  <p className="text-[9.5px] text-slate-600 leading-snug mt-1.5">
                    Demand for laptops is expected to increase by <span className="font-semibold text-slate-900">26%</span> next month.
                  </p>
                </div>
                <button
                  onClick={onViewForecastClick}
                  className="mt-2 w-full py-1 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white text-[9px] font-semibold transition-colors cursor-pointer"
                >
                  View Forecast
                </button>
              </div>
            </div>

            {/* Bottom Row: Recent Activity */}
            <div className="p-2 rounded-xl bg-slate-50/50 border border-slate-100">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-bold text-slate-800">Recent Activity</span>
                <span className="text-[8.5px] text-blue-600 font-medium cursor-pointer hover:underline">
                  View all
                </span>
              </div>
              <div className="space-y-1 text-[9px]">
                <div className="flex items-center justify-between text-slate-600">
                  <span className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500" /> Reconciled 3 transactions
                  </span>
                  <span className="text-slate-400 text-[8px]">2 mins ago</span>
                </div>
                <div className="flex items-center justify-between text-slate-600">
                  <span className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Auto-ordered from Supplier (Acme Ltd.)
                  </span>
                  <span className="text-slate-400 text-[8px]">5 mins ago</span>
                </div>
                <div className="flex items-center justify-between text-slate-600">
                  <span className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> Flagged 2 potential duplicate invoices
                  </span>
                  <span className="text-slate-400 text-[8px]">12 mins ago</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* 4 OVERLAPPING FLOATING PILLS / CARDS MATCHING THE SCREENSHOT */}
      {/* ============================================================ */}

      {/* 1. Top-Left: AI Forecasting */}
      <div className="absolute -top-7 -left-6 sm:-left-12 z-20 bg-white/95 backdrop-blur-md rounded-2xl p-3 shadow-floating-badge border border-slate-200/80 w-44 sm:w-52 transform hover:-translate-y-1 transition-all duration-300">
        <div className="flex items-start space-x-2.5">
          <div className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center flex-shrink-0">
            <TrendingUp className="w-4 h-4 text-blue-600" />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-900 leading-tight">AI Forecasting</div>
            <p className="text-[10px] text-slate-500 mt-0.5 leading-snug">
              Predict demand, prevent stock-outs, maximize profit.
            </p>
          </div>
        </div>
      </div>

      {/* 2. Middle-Left: Auto Reorder */}
      <div className="absolute top-[44%] -left-8 sm:-left-14 z-20 bg-white/95 backdrop-blur-md rounded-2xl p-3 shadow-floating-badge border border-slate-200/80 w-40 sm:w-44 transform hover:-translate-y-1 transition-all duration-300">
        <div className="flex flex-col items-center text-center">
          {/* 3D Isometric Cardboard Box Icon */}
          <div className="w-9 h-9 mb-1.5 relative flex items-center justify-center">
            <svg width="34" height="34" viewBox="0 0 48 48" fill="none">
              <path d="M24 4L42 14V34L24 44L6 34V14L24 4Z" fill="#D97706" />
              <path d="M24 4L42 14L24 24L6 14L24 4Z" fill="#F59E0B" />
              <path d="M24 24V44L6 34V14L24 24Z" fill="#B45309" />
              <path d="M24 24V44L42 34V14L24 24Z" fill="#D97706" />
              <line x1="24" y1="4" x2="24" y2="24" stroke="#78350F" strokeWidth="1.5" strokeDasharray="2 2" />
            </svg>
          </div>
          <div className="text-xs font-bold text-slate-900">Auto Reorder</div>
          <div className="text-[10px] text-slate-500">Stock hits threshold.</div>
          <button
            onClick={onOrderNowClick}
            className="mt-2 w-full py-1 rounded-lg border border-blue-500/20 bg-blue-50 hover:bg-blue-100 text-blue-600 text-[10px] font-bold transition-all cursor-pointer shadow-sm"
          >
            Order Now
          </button>
        </div>
      </div>

      {/* 3. Top-Right: Error Detection */}
      <div
        onClick={onErrorDetectionClick}
        className="absolute -top-3 -right-6 sm:-right-10 z-20 bg-white/95 backdrop-blur-md rounded-2xl p-3 shadow-floating-badge border border-slate-200/80 w-44 sm:w-52 transform hover:-translate-y-1 transition-all duration-300 cursor-pointer group"
      >
        <div className="flex items-start justify-between">
          <div className="w-7 h-7 rounded-lg bg-rose-50 border border-rose-200 flex items-center justify-center flex-shrink-0">
            <ShieldAlert className="w-4 h-4 text-rose-500" />
          </div>
          <div className="w-5 h-5 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center group-hover:bg-slate-900 group-hover:text-white transition-colors">
            <ArrowRight className="w-3 h-3 text-slate-400 group-hover:text-white" />
          </div>
        </div>
        <div className="text-xs font-bold text-slate-900 mt-1.5">Error Detection</div>
        <p className="text-[10px] text-slate-500 mt-0.5 leading-snug">
          Find and fix accounting & inventory errors.
        </p>
      </div>

      {/* 4. Bottom-Right: B2B Integration */}
      <div
        onClick={onB2BIntegrationClick}
        className="absolute bottom-6 -right-6 sm:-right-12 z-20 bg-white/95 backdrop-blur-md rounded-2xl p-3 shadow-floating-badge border border-slate-200/80 w-44 sm:w-52 transform hover:-translate-y-1 transition-all duration-300 cursor-pointer group"
      >
        <div className="flex items-start justify-between">
          <div className="w-7 h-7 rounded-lg bg-purple-50 border border-purple-200 flex items-center justify-center flex-shrink-0">
            <Network className="w-4 h-4 text-purple-600" />
          </div>
          <div className="w-5 h-5 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center group-hover:bg-slate-900 group-hover:text-white transition-colors">
            <ArrowRight className="w-3 h-3 text-slate-400 group-hover:text-white" />
          </div>
        </div>
        <div className="text-xs font-bold text-slate-900 mt-1.5">B2B Integration</div>
        <p className="text-[10px] text-slate-500 mt-0.5 leading-snug">
          Connect with suppliers, partners and marketplaces.
        </p>
      </div>
    </div>
  );
};
