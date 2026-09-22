"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import {
  Home,
  Boxes,
  TrendingUp,
  ShoppingCart,
  FileText,
  Sparkles,
  Users,
  BarChart3,
  Settings,
  Search,
  Bell,
  ChevronDown,
  ChevronRight,
  ArrowRight,
  ArrowUpRight,
  Calendar,
  MoreHorizontal,
  Plus,
  SlidersHorizontal,
  Download,
  CheckCircle2,
  Building2,
  Headphones,
  Watch,
  Folder,
  Cable,
  BookOpen,
  X,
  User,
  Tag,
} from "lucide-react";
import {
  salesStore,
  SalesOrder,
  SalesState,
} from "@/lib/salesStore";
import { createSalesOrder, updateSalesOrderStatus } from "@/lib/api";

export default function SalesPage() {
  const [salesState, setSalesState] = useState<SalesState>(salesStore.getState());
  const [searchQuery, setSearchQuery] = useState("");
  const [tableSearchQuery, setTableSearchQuery] = useState("");
  const [chartMetric, setChartMetric] = useState<"Revenue" | "Orders" | "Units Sold">("Revenue");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [channelFilter, setChannelFilter] = useState<string>("All");
  const [actionDropdownOrderId, setActionDropdownOrderId] = useState<string | null>(null);
  const salesOrdersRef = useRef<HTMLDivElement>(null);

  // New Order Form State
  const [newOrderForm, setNewOrderForm] = useState({
    customerName: "",
    itemsCount: 3,
    totalAmount: 450.0,
    channel: "Online Store" as SalesOrder["channel"],
    status: "Completed" as SalesOrder["status"],
  });

  // Subscribe to salesStore on mount
  useEffect(() => {
    const unsub = salesStore.subscribe((newState) => {
      setSalesState({ ...newState });
    });
    const disconnectLiveSync = salesStore.connectLive();
    return () => {
      unsub();
      disconnectLiveSync();
    };
  }, []);

  // Close action menus on outside click
  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (actionDropdownOrderId && !(e.target as HTMLElement).closest(".sales-action-container")) {
        setActionDropdownOrderId(null);
      }
    };
    window.addEventListener("click", handleOutside);
    return () => window.removeEventListener("click", handleOutside);
  }, [actionDropdownOrderId]);

  const { orders, metrics } = salesState;

  // Filtered orders for table
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      if (o.status === "Cancelled") return false;
      if (statusFilter !== "All" && o.status !== statusFilter) return false;
      if (channelFilter !== "All" && o.channel !== channelFilter) return false;

      const q = (tableSearchQuery || searchQuery).trim().toLowerCase();
      if (q) {
        const matchNum = o.orderNumber.toLowerCase().includes(q);
        const matchCust = o.customerName.toLowerCase().includes(q);
        const matchId = o.customerId.toLowerCase().includes(q);
        if (!matchNum && !matchCust && !matchId) return false;
      }
      return true;
    });
  }, [orders, statusFilter, channelFilter, tableSearchQuery, searchQuery]);

  // Paginated slice
  const totalPages = Math.ceil(filteredOrders.length / itemsPerPage) || 1;
  const paginatedOrders = useMemo(() => {
    const start = (Math.min(currentPage, totalPages) - 1) * itemsPerPage;
    return filteredOrders.slice(start, start + itemsPerPage);
  }, [filteredOrders, currentPage, totalPages]);

  // Checkbox selection
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedOrderIds(new Set(paginatedOrders.map((o) => o.id)));
    } else {
      setSelectedOrderIds(new Set());
    }
  };

  const handleSelectRow = (id: string) => {
    setSelectedOrderIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Create Order Submit
  const handleCreateOrderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrderForm.customerName.trim()) return;

    const created = salesStore.createOrder({
      customerName: newOrderForm.customerName,
      itemsCount: Number(newOrderForm.itemsCount) || 1,
      totalAmount: Number(newOrderForm.totalAmount) || 0,
      channel: newOrderForm.channel,
      status: newOrderForm.status,
    });

    try {
      await createSalesOrder({
        id: created.id,
        order_number: created.orderNumber,
        customer_name: created.customerName,
        customer_id: created.customerId,
        items_count: created.itemsCount,
        total_amount: created.totalAmount,
        status: created.status,
        channel: created.channel,
      });
      salesStore.markOrderSynced(created.id);
    } catch {
      void salesStore.syncFromBackend(true);
    }

    setIsCreateModalOpen(false);
    setNewOrderForm({
      customerName: "",
      itemsCount: 3,
      totalAmount: 450.0,
      channel: "Online Store",
      status: "Completed",
    });
  };

  // Toggle order status
  const handleToggleStatus = async (order: SalesOrder) => {
    const newStatus: SalesOrder["status"] = order.status === "Completed" ? "Pending" : "Completed";
    salesStore.updateOrderStatus(order.id, newStatus);
    setActionDropdownOrderId(null);
    try {
      await updateSalesOrderStatus(order.id, newStatus);
      salesStore.markOrderSynced(order.id);
    } catch {
      // The supplied baseline may not yet exist in a fresh database. Creating
      // it on first mutation keeps that action durable without delaying the UI.
      try {
        await createSalesOrder({
          id: order.id,
          order_number: order.orderNumber,
          customer_name: order.customerName,
          customer_id: order.customerId,
          items_count: order.itemsCount,
          total_amount: order.totalAmount,
          status: newStatus,
          channel: order.channel,
        });
        salesStore.markOrderSynced(order.id);
      } catch {
        void salesStore.syncFromBackend(true);
      }
    }
  };

  const handleCancelOrder = async (order: SalesOrder) => {
    salesStore.updateOrderStatus(order.id, "Cancelled");
    setActionDropdownOrderId(null);
    try {
      await updateSalesOrderStatus(order.id, "Cancelled");
      salesStore.markOrderSynced(order.id);
    } catch {
      try {
        await createSalesOrder({
          id: order.id,
          order_number: order.orderNumber,
          customer_name: order.customerName,
          customer_id: order.customerId,
          items_count: order.itemsCount,
          total_amount: order.totalAmount,
          status: "Cancelled",
          channel: order.channel,
        });
        salesStore.markOrderSynced(order.id);
      } catch {
        void salesStore.syncFromBackend(true);
      }
    }
  };

  // Export CSV
  const handleExportCSV = () => {
    const csvContent = salesStore.exportOrdersCSV();
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `kpm_sales_orders_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const focusSalesOrders = (orderNumber?: string) => {
    setStatusFilter("All");
    setChannelFilter("All");
    setTableSearchQuery(orderNumber || "");
    setCurrentPage(1);
    salesOrdersRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const renderProductThumb = (type: string) => {
    let Icon = Headphones;
    if (type === "watch") Icon = Watch;
    else if (type === "backpack") Icon = Folder;
    else if (type === "cable") Icon = Cable;
    else if (type === "notebook") Icon = BookOpen;

    return (
      <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200/80 flex items-center justify-center text-slate-700 flex-shrink-0">
        <Icon className="w-5 h-5 text-slate-800 stroke-[1.8]" />
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] flex font-sans antialiased selection:bg-[#0F172A] selection:text-white">
      
      {/* ========================================================= */}
      {/* 1. LEFT SIDEBAR                                           */}
      {/* ========================================================= */}
      <aside className="w-64 bg-white border-r border-slate-200/80 p-5 flex flex-col justify-between hidden md:flex flex-shrink-0">
        <div className="space-y-6">
          
          {/* Logo */}
          <Link href="/dashboard" className="block px-2 group">
            <div className="flex items-center space-x-2.5">
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
            <div className="text-[11px] font-medium text-slate-400 mt-1 pl-0.5">
              Inventory &middot; Accounting &middot; AI
            </div>
          </Link>

          {/* Navigation Links with Active Sales Pill */}
          <nav className="space-y-1">
            {[
              { name: "Home", icon: Home, href: "/dashboard", hasChevron: false },
              { name: "Inventory", icon: Boxes, href: "/inventory", hasChevron: true },
              { name: "Sales", icon: TrendingUp, href: "/sales", active: true, hasChevron: false },
              { name: "Purchases", icon: ShoppingCart, href: "#", hasChevron: true },
              { name: "Accounting", icon: FileText, href: "#", hasChevron: true },
              { name: "AI Insights", icon: Sparkles, href: "/insights", hasChevron: true },
              { name: "Suppliers", icon: Users, href: "#", hasChevron: true },
              { name: "Customers", icon: Users, href: "#", hasChevron: true },
              { name: "Reports", icon: BarChart3, href: "#", hasChevron: true },
              { name: "Settings", icon: Settings, href: "#", hasChevron: true },
            ].map((item) => {
              const Icon = item.icon;
              const isActive = item.active;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    isActive
                      ? "bg-[#0F172A] text-white shadow-sm"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <Icon className={`w-4 h-4 ${isActive ? "text-white" : "text-slate-500"}`} />
                    <span>{item.name}</span>
                  </div>
                  {item.hasChevron && (
                    <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Bottom Sidebar Cards: Grow Your Business & Org Switcher */}
        <div className="space-y-3 pt-4 border-t border-slate-100">
          
          {/* Grow Your Business Card */}
          <div className="rounded-2xl bg-gradient-to-br from-indigo-50/70 via-blue-50/40 to-slate-50 border border-indigo-100/70 p-3.5 space-y-2.5 shadow-2xs">
            <div className="flex items-center space-x-2">
              <div className="w-6 h-6 rounded-lg bg-indigo-600/10 text-indigo-600 flex items-center justify-center">
                <Sparkles className="w-3.5 h-3.5" />
              </div>
              <span className="text-xs font-bold text-slate-900">Grow Your Business</span>
            </div>
            <p className="text-[11px] text-slate-500 leading-snug">
              Get AI-powered insights to make smarter decisions and increase your profits.
            </p>
            <button
              onClick={() => alert("Upgrade Plan: Enterprise Tier Active")}
              className="w-full inline-flex items-center justify-center space-x-1.5 bg-[#0F172A] hover:bg-slate-800 text-white text-[11px] font-semibold py-1.5 px-3 rounded-lg shadow-2xs transition-colors cursor-pointer"
            >
              <span>Upgrade Plan</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          {/* Org Selector */}
          <div className="rounded-xl border border-slate-200/80 p-2.5 flex items-center justify-between hover:bg-slate-50 cursor-pointer transition-colors">
            <div className="flex items-center space-x-2.5">
              <div className="w-7 h-7 rounded-lg bg-blue-100/70 text-blue-700 flex items-center justify-center">
                <Building2 className="w-3.5 h-3.5" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-900 leading-tight">Acme Trading Co.</div>
                <div className="text-[10px] text-slate-400">Enterprise Plan</div>
              </div>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </div>
        </div>
      </aside>

      {/* ========================================================= */}
      {/* 2. MAIN CONTENT AREA                                      */}
      {/* ========================================================= */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        
        {/* Top Navbar */}
        <header className="bg-white border-b border-slate-200/80 px-4 sm:px-8 py-3.5 flex items-center justify-between sticky top-0 z-30">
          <div className="relative w-full max-w-md sm:max-w-xl">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search sales, customers, orders, or invoice..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200/80 rounded-full text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-blue-400 transition-all"
            />
          </div>

          {/* Profile & Bell */}
          <div className="flex items-center space-x-4 pl-4">
            <div className="relative">
              <button 
                onClick={() => alert("3 unread sales notifications")}
                className="w-9 h-9 rounded-full bg-slate-50 hover:bg-slate-100 border border-slate-200/70 flex items-center justify-center text-slate-600 transition-colors cursor-pointer relative"
              >
                <Bell className="w-4 h-4" />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full ring-2 ring-white" />
              </button>
            </div>

            <div className="flex items-center space-x-2.5 cursor-pointer pl-1">
              <div className="w-9 h-9 rounded-full bg-slate-800 text-white font-bold text-xs flex items-center justify-center border border-slate-200 shadow-2xs">
                JA
              </div>
              <div className="hidden sm:block text-left">
                <div className="text-xs font-bold text-slate-800 leading-tight">Jude Azane</div>
                <div className="text-[10px] text-slate-400">Admin</div>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden sm:block" />
            </div>
          </div>
        </header>

        {/* Sales Main Body */}
        <main className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-[1600px] w-full mx-auto">
          
          {/* Header Row */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0F172A] tracking-tight">
                Sales
              </h1>
              <p className="text-xs sm:text-[13px] text-slate-500 mt-1">
                Track your sales performance, manage orders, and keep{" "}
                <span className="text-blue-600 font-semibold cursor-pointer hover:underline">
                  your customers happy
                </span>{" "}
                &mdash; all in one place.
              </p>
            </div>

            {/* Top Right Actions */}
            <div className="flex items-center space-x-2.5 flex-shrink-0">
              {/* Date Filter Pill */}
              <button 
                onClick={() => alert("Filter applied: Apr 1, 2025 - Apr 30, 2025")}
                className="inline-flex items-center space-x-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold px-3.5 py-2 rounded-xl shadow-2xs transition-colors cursor-pointer"
              >
                <Calendar className="w-3.5 h-3.5 text-slate-500" />
                <span>Apr 1, 2025 – Apr 30, 2025</span>
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </button>

              {/* Three dots button */}
              <button 
                onClick={handleExportCSV}
                className="w-9 h-9 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-600 shadow-2xs transition-colors cursor-pointer"
              >
                <MoreHorizontal className="w-4 h-4" />
              </button>

              {/* Create Sales Order Button */}
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="inline-flex items-center space-x-1.5 bg-[#0F172A] hover:bg-slate-800 text-white text-xs font-semibold px-4 py-2 rounded-xl shadow-2xs transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create Sales Order</span>
              </button>
            </div>
          </div>

          {/* ========================================================= */}
          {/* 4 TOP METRIC CARDS WITH SPARKLINES                        */}
          {/* ========================================================= */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            
            {/* 1. Total Sales Revenue */}
            <div className="rounded-2xl bg-white border border-slate-200/80 p-4 shadow-card-subtle flex flex-col justify-between relative overflow-hidden">
              <div className="flex items-center justify-between">
                <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center">
                  <Tag className="w-4 h-4" />
                </div>
                {/* Smooth Sparkline */}
                <div className="w-20 h-8">
                  <svg className="w-full h-full" viewBox="0 0 80 30">
                    <path
                      d="M 0 25 Q 20 22, 35 15 T 60 12 T 80 5"
                      fill="none"
                      stroke="#3B82F6"
                      strokeWidth="2"
                    />
                  </svg>
                </div>
              </div>

              <div className="mt-3">
                <div className="text-[11px] font-medium text-slate-500">
                  Total Sales <span className="text-slate-400">Revenue</span>
                </div>
                <div className="text-2xl font-black text-slate-900 tracking-tight mt-0.5">
                  ${metrics.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div className="text-[10px] font-semibold text-emerald-600 flex items-center pt-1">
                  <ArrowUpRight className="w-3 h-3 mr-0.5" />
                  <span>12%</span>
                  <span className="text-slate-400 font-normal ml-1">vs. last month</span>
                </div>
              </div>
            </div>

            {/* 2. Total Orders */}
            <div className="rounded-2xl bg-white border border-slate-200/80 p-4 shadow-card-subtle flex flex-col justify-between relative overflow-hidden">
              <div className="flex items-center justify-between">
                <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center">
                  <Calendar className="w-4 h-4" />
                </div>
                <div className="w-20 h-8">
                  <svg className="w-full h-full" viewBox="0 0 80 30">
                    <path
                      d="M 0 24 Q 25 22, 45 14 T 70 16 T 80 6"
                      fill="none"
                      stroke="#3B82F6"
                      strokeWidth="2"
                    />
                  </svg>
                </div>
              </div>

              <div className="mt-3">
                <div className="text-[11px] font-medium text-slate-500">Total Orders</div>
                <div className="text-2xl font-black text-slate-900 tracking-tight mt-0.5">
                  {metrics.totalOrders}
                </div>
                <div className="text-[10px] font-semibold text-emerald-600 flex items-center pt-1">
                  <ArrowUpRight className="w-3 h-3 mr-0.5" />
                  <span>8%</span>
                  <span className="text-slate-400 font-normal ml-1">vs. last month</span>
                </div>
              </div>
            </div>

            {/* 3. Average Order Value */}
            <div className="rounded-2xl bg-white border border-slate-200/80 p-4 shadow-card-subtle flex flex-col justify-between relative overflow-hidden">
              <div className="flex items-center justify-between">
                <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center">
                  <Tag className="w-4 h-4" />
                </div>
                <div className="w-20 h-8">
                  <svg className="w-full h-full" viewBox="0 0 80 30">
                    <path
                      d="M 0 20 Q 20 18, 40 16 T 60 10 T 80 4"
                      fill="none"
                      stroke="#475569"
                      strokeWidth="2"
                    />
                  </svg>
                </div>
              </div>

              <div className="mt-3">
                <div className="text-[11px] font-medium text-slate-500">Average Order Value</div>
                <div className="text-2xl font-black text-slate-900 tracking-tight mt-0.5">
                  ${metrics.averageOrderValue.toFixed(2)}
                </div>
                <div className="text-[10px] font-semibold text-emerald-600 flex items-center pt-1">
                  <ArrowUpRight className="w-3 h-3 mr-0.5" />
                  <span>5%</span>
                  <span className="text-slate-400 font-normal ml-1">vs. last month</span>
                </div>
              </div>
            </div>

            {/* 4. Outstanding Invoices */}
            <div className="rounded-2xl bg-white border border-slate-200/80 p-4 shadow-card-subtle flex flex-col justify-between relative overflow-hidden">
              <div className="flex items-center justify-between">
                <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center">
                  <FileText className="w-4 h-4" />
                </div>
                <div className="flex items-center space-x-2">
                  <button 
                    onClick={() => {
                      setStatusFilter("Pending");
                      setCurrentPage(1);
                    }}
                    className="text-[10px] font-semibold text-slate-400 hover:text-blue-600 flex items-center gap-0.5 cursor-pointer"
                  >
                    <span>View all</span>
                    <ArrowRight className="w-2.5 h-2.5" />
                  </button>
                  <div className="w-16 h-8">
                    <svg className="w-full h-full" viewBox="0 0 80 30">
                      <path
                        d="M 0 22 Q 25 18, 45 15 T 70 8 T 80 4"
                        fill="none"
                        stroke="#475569"
                        strokeWidth="2"
                      />
                    </svg>
                  </div>
                </div>
              </div>

              <div className="mt-3">
                <div className="text-[11px] font-medium text-slate-500">Outstanding Invoices</div>
                <div className="text-2xl font-black text-slate-900 tracking-tight mt-0.5">
                  ${metrics.outstandingInvoices.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div className="text-[10px] font-semibold text-rose-500 flex items-center pt-1">
                  <ArrowUpRight className="w-3 h-3 mr-0.5" />
                  <span>3%</span>
                  <span className="text-slate-400 font-normal ml-1">vs. last month</span>
                </div>
              </div>
            </div>

          </div>

          {/* ========================================================= */}
          {/* MIDDLE ROW: Sales Overview | Sales by Channel | Recent Sales */}
          {/* ========================================================= */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
            
            {/* 1. Sales Overview Curve Chart (6 cols) */}
            <div className="lg:col-span-6 rounded-2xl bg-white border border-slate-200/80 p-5 shadow-card-subtle flex flex-col justify-between">
              <div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-[#0F172A]">Sales Overview</h3>
                    <p className="text-[10.5px] text-slate-400 mt-0.5">
                      Revenue and order trends over the selected period.
                    </p>
                  </div>

                  {/* Toggle pills: Revenue | Orders | Units Sold */}
                  <div className="flex items-center bg-slate-100 rounded-lg p-0.5 border border-slate-200/60">
                    {(["Revenue", "Orders", "Units Sold"] as const).map((tab) => {
                      const isActive = chartMetric === tab;
                      return (
                        <button
                          key={tab}
                          onClick={() => setChartMetric(tab)}
                          className={`px-3 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${
                            isActive
                              ? "bg-[#0F172A] text-white shadow-2xs"
                              : "text-slate-600 hover:text-slate-900"
                          }`}
                        >
                          {tab}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Legend */}
                <div className="flex items-center justify-end space-x-4 pt-3 text-[10.5px] text-slate-500">
                  <div className="flex items-center space-x-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#0F172A]" />
                    <span>This Period</span>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <span className="w-2 h-2 rounded-full bg-slate-300" />
                    <span>Last Period</span>
                  </div>
                </div>

                {/* Spline Chart SVG */}
                <div className="h-44 w-full relative mt-2">
                  <svg className="w-full h-full" viewBox="0 0 450 140" preserveAspectRatio="none">
                    {/* Horizontal Grid lines */}
                    <line x1="0" y1="20" x2="450" y2="20" stroke="#F1F5F9" strokeWidth="1" />
                    <line x1="0" y1="55" x2="450" y2="55" stroke="#F1F5F9" strokeWidth="1" />
                    <line x1="0" y1="90" x2="450" y2="90" stroke="#F1F5F9" strokeWidth="1" />
                    <line x1="0" y1="125" x2="450" y2="125" stroke="#F1F5F9" strokeWidth="1" />

                    {/* Last Period Dashed line */}
                    <path
                      d="M 10 115 Q 70 110, 130 95 T 250 85 T 350 65 T 440 60"
                      fill="none"
                      stroke="#CBD5E1"
                      strokeWidth="1.8"
                      strokeDasharray="4 4"
                    />

                    {/* This Period Solid Black Spline */}
                    <path
                      d="M 10 100 Q 50 95, 100 85 T 180 70 T 260 55 T 320 62 T 390 35 T 440 40"
                      fill="none"
                      stroke="#0F172A"
                      strokeWidth="2.4"
                    />
                  </svg>
                </div>

                {/* X-axis Ticks */}
                <div className="flex justify-between text-[10px] text-slate-400 mt-1 px-1">
                  <span>Apr 1</span>
                  <span>Apr 5</span>
                  <span>Apr 10</span>
                  <span>Apr 15</span>
                  <span>Apr 20</span>
                  <span>Apr 25</span>
                  <span>Apr 30</span>
                </div>
              </div>
            </div>

            {/* 2. Sales by Channel (3 cols) */}
            <div className="lg:col-span-3 rounded-2xl bg-white border border-slate-200/80 p-5 shadow-card-subtle flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-bold text-[#0F172A] pb-2 border-b border-slate-100">
                  Sales by Channel
                </h3>

                {/* Donut Chart */}
                <div className="relative w-32 h-32 mx-auto my-3">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="40" fill="transparent" stroke="#F1F5F9" strokeWidth="13" />
                    {/* Online Store (52%) - Dark #0F172A */}
                    <circle
                      cx="50"
                      cy="50"
                      r="40"
                      fill="transparent"
                      stroke="#0F172A"
                      strokeWidth="13"
                      strokeDasharray="251.2"
                      strokeDashoffset={251.2 - (251.2 * 52) / 100}
                      strokeLinecap="round"
                    />
                    {/* Direct Sales (24%) - Blue #3B82F6 */}
                    <circle
                      cx="50"
                      cy="50"
                      r="40"
                      fill="transparent"
                      stroke="#3B82F6"
                      strokeWidth="13"
                      strokeDasharray="251.2"
                      strokeDashoffset={251.2 - (251.2 * (52 + 24)) / 100}
                    />
                    {/* Retail Partners (14%) - Sky #60A5FA */}
                    <circle
                      cx="50"
                      cy="50"
                      r="40"
                      fill="transparent"
                      stroke="#60A5FA"
                      strokeWidth="13"
                      strokeDasharray="251.2"
                      strokeDashoffset={251.2 - (251.2 * (52 + 24 + 14)) / 100}
                    />
                    {/* Wholesale (10%) - Lavender #818CF8 */}
                    <circle
                      cx="50"
                      cy="50"
                      r="40"
                      fill="transparent"
                      stroke="#818CF8"
                      strokeWidth="13"
                      strokeDasharray="251.2"
                      strokeDashoffset={251.2 - (251.2 * 10) / 100}
                    />
                  </svg>

                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-xs font-bold text-slate-900 leading-none">
                      ${Math.round(metrics.totalRevenue / 1000)}k
                    </span>
                    <span className="text-[8.5px] font-semibold text-slate-400 mt-0.5">
                      Total Sales
                    </span>
                  </div>
                </div>

                {/* Channel Legend matching screenshot */}
                <div className="space-y-1.5 text-xs">
                  {metrics.channelBreakdown.map((item) => (
                    <div key={item.name} className="flex items-center justify-between text-[11px]">
                      <div className="flex items-center space-x-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: item.color }}
                        />
                        <span className="text-slate-600 font-medium truncate">{item.name}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-slate-400">{item.percentage}%</span>
                        <span className="font-bold text-slate-900">
                          ${item.amount.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* 3. Recent Sales List (3 cols) */}
            <div className="lg:col-span-3 rounded-2xl bg-white border border-slate-200/80 p-5 shadow-card-subtle flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <h3 className="text-sm font-bold text-[#0F172A]">Recent Sales</h3>
                  <button 
                    onClick={() => focusSalesOrders()}
                    className="text-[11px] font-bold text-blue-600 hover:underline flex items-center gap-0.5 cursor-pointer"
                  >
                    <span>View all</span>
                    <ArrowRight className="w-2.5 h-2.5" />
                  </button>
                </div>

                <div className="space-y-3 pt-2">
                  {orders.filter((order) => order.status !== "Cancelled").slice(0, 5).map((order) => (
                    <div
                      key={order.id}
                      onClick={() => focusSalesOrders(order.orderNumber)}
                      className="flex items-center justify-between p-1.5 rounded-xl hover:bg-slate-50 cursor-pointer transition-colors group"
                    >
                      <div className="flex items-center space-x-2.5">
                        <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200/60 flex items-center justify-center text-slate-500">
                          <FileText className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                            {order.orderNumber}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {order.date} &middot; {order.time}
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-xs font-bold text-slate-900">
                          ${order.totalAmount.toFixed(2)}
                        </div>
                        <div className="flex items-center justify-end space-x-1">
                          {order.status === "Completed" ? (
                            <span className="text-[10px] font-semibold text-emerald-600">
                              Completed
                            </span>
                          ) : (
                            <span className="text-[10px] font-semibold text-amber-600 flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                              Pending
                            </span>
                          )}
                          <ChevronRight className="w-3 h-3 text-slate-400" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

          </div>

          {/* ========================================================= */}
          {/* BOTTOM ROW: Sales Orders Table (9 cols) | Top Products (3 cols) */}
          {/* ========================================================= */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            
            {/* Sales Orders Table (8 or 9 cols) */}
            <div ref={salesOrdersRef} className="lg:col-span-8 xl:col-span-9 rounded-2xl bg-white border border-slate-200/80 p-5 shadow-card-subtle space-y-4">
              
              {/* Table Header & Controls */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-100">
                <div>
                  <h3 className="text-sm font-bold text-[#0F172A]">Sales Orders</h3>
                  <p className="text-[10.5px] text-slate-400 mt-0.5">
                    Manage and track all your sales orders in real time.
                  </p>
                </div>

                <div className="flex items-center space-x-2">
                  <div className="relative w-56 sm:w-64">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Search by order number, customer, or product..."
                      value={tableSearchQuery}
                      onChange={(e) => {
                        setTableSearchQuery(e.target.value);
                        setCurrentPage(1);
                      }}
                      className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:border-blue-400 outline-none transition-all"
                    />
                  </div>

                  <button
                    onClick={() => setIsFilterModalOpen(true)}
                    className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border border-slate-200/90 text-slate-700 hover:bg-slate-50 text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" />
                    <span>Filter</span>
                  </button>

                  <button
                    onClick={handleExportCSV}
                    className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border border-slate-200/90 text-slate-700 hover:bg-slate-50 text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 text-slate-500" />
                    <span>Export</span>
                  </button>
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/50 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      <th className="py-3 px-3 w-10">
                        <input
                          type="checkbox"
                          checked={
                            paginatedOrders.length > 0 &&
                            selectedOrderIds.size === paginatedOrders.length
                          }
                          onChange={handleSelectAll}
                          className="w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-0 cursor-pointer"
                        />
                      </th>
                      <th className="py-3 px-3">Order #</th>
                      <th className="py-3 px-3">Customer</th>
                      <th className="py-3 px-3">Date</th>
                      <th className="py-3 px-3">Items</th>
                      <th className="py-3 px-3">Total Amount</th>
                      <th className="py-3 px-3">Status</th>
                      <th className="py-3 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {paginatedOrders.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-10 text-center text-slate-400">
                          No sales orders found.
                        </td>
                      </tr>
                    ) : (
                      paginatedOrders.map((order) => {
                        const isChecked = selectedOrderIds.has(order.id);
                        return (
                          <tr
                            key={order.id}
                            className={`group hover:bg-slate-50/70 transition-colors ${
                              isChecked ? "bg-blue-50/30" : ""
                            }`}
                          >
                            <td className="py-3 px-3">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => handleSelectRow(order.id)}
                                className="w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-0 cursor-pointer"
                              />
                            </td>

                            {/* Order # */}
                            <td className="py-3 px-3 font-mono font-bold text-slate-900">
                              {order.orderNumber}
                            </td>

                            {/* Customer */}
                            <td className="py-3 px-3">
                              <div className="flex items-center space-x-2.5">
                                <div className="w-7 h-7 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center">
                                  <User className="w-3.5 h-3.5" />
                                </div>
                                <div>
                                  <div className="font-bold text-slate-900 leading-tight">
                                    {order.customerName}
                                  </div>
                                  <div className="text-[10px] text-slate-400 font-mono">
                                    {order.customerId}
                                  </div>
                                </div>
                              </div>
                            </td>

                            {/* Date */}
                            <td className="py-3 px-3 text-slate-600">
                              <div>{order.date}</div>
                              <div className="text-[10px] text-slate-400">{order.time}</div>
                            </td>

                            {/* Items */}
                            <td className="py-3 px-3 font-semibold text-slate-700">
                              {order.itemsCount}
                            </td>

                            {/* Total Amount */}
                            <td className="py-3 px-3 font-bold text-slate-900">
                              ${order.totalAmount.toFixed(2)}
                            </td>

                            {/* Status Badge with bullet */}
                            <td className="py-3 px-3">
                              {order.status === "Completed" ? (
                                <span className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-[10.5px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                  <span>Completed</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-[10.5px] font-semibold bg-amber-50 text-amber-700 border border-amber-200/60">
                                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                  <span>Pending</span>
                                </span>
                              )}
                            </td>

                            {/* Actions Menu */}
                            <td className="py-3 px-3 text-right relative sales-action-container">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActionDropdownOrderId(
                                    actionDropdownOrderId === order.id ? null : order.id
                                  );
                                }}
                                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                              >
                                <MoreHorizontal className="w-4 h-4" />
                              </button>

                              {actionDropdownOrderId === order.id && (
                                <div className="absolute right-3 top-8 w-44 bg-white rounded-2xl border border-slate-200 shadow-xl p-1.5 z-40 text-xs animate-in fade-in duration-100 text-left">
                                  <button
                                    onClick={() => handleToggleStatus(order)}
                                    className="w-full flex items-center space-x-2 px-3 py-2 rounded-xl hover:bg-slate-50 text-slate-700 font-medium cursor-pointer"
                                  >
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    <span>
                                      Mark as {order.status === "Completed" ? "Pending" : "Completed"}
                                    </span>
                                  </button>
                                  <button
                                    onClick={() => {
                                      if (confirm(`Cancel ${order.orderNumber}?`)) {
                                        void handleCancelOrder(order);
                                      }
                                    }}
                                    className="w-full flex items-center space-x-2 px-3 py-2 rounded-xl hover:bg-rose-50 text-rose-600 font-medium cursor-pointer"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                    <span>Cancel Order</span>
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination matching screenshot: Showing 1-5 of 248 orders */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-100 text-xs text-slate-500">
                <div>
                  Showing {Math.min(1, filteredOrders.length)}-{Math.min(5, filteredOrders.length)} of{" "}
                  {filteredOrders.length} orders
                </div>

                <div className="flex items-center space-x-1">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="w-7 h-7 rounded-lg border border-slate-200 flex items-center justify-center hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
                  >
                    &lt;
                  </button>

                  {[1, 2, 3, 4, 5].map((pageNum) => (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`w-7 h-7 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                        currentPage === pageNum
                          ? "bg-[#0F172A] text-white"
                          : "text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      {pageNum}
                    </button>
                  ))}
                  <span className="px-1 text-slate-400">..</span>
                  <button
                    onClick={() => setCurrentPage(50)}
                    className={`w-7 h-7 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                      currentPage === 50
                        ? "bg-[#0F172A] text-white"
                        : "text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    50
                  </button>

                  <button
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage >= totalPages}
                    className="w-7 h-7 rounded-lg border border-slate-200 flex items-center justify-center hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
                  >
                    &gt;
                  </button>
                </div>
              </div>

            </div>

            {/* Right Column: Top Selling Products & Promo Card */}
            <div className="lg:col-span-4 xl:col-span-3 space-y-4">
              
              {/* Top Selling Products */}
              <div className="rounded-2xl bg-white border border-slate-200/80 p-5 shadow-card-subtle space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <h3 className="text-sm font-bold text-[#0F172A]">Top Selling Products</h3>
                  <Link
                    href="/inventory"
                    className="text-[11px] font-bold text-blue-600 hover:underline flex items-center gap-0.5 cursor-pointer"
                  >
                    <span>View all</span>
                    <ArrowRight className="w-2.5 h-2.5" />
                  </Link>
                </div>

                <div className="space-y-3 pt-1">
                  {metrics.topProducts.map((p) => (
                    <div key={p.id} className="flex items-center justify-between text-xs group">
                      <div className="flex items-center space-x-2.5">
                        {renderProductThumb(p.iconType)}
                        <div>
                          <div className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                            {p.name}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            SKU: {p.sku} &middot; {p.soldCount} sold
                          </div>
                        </div>
                      </div>

                      <div className="font-bold text-slate-900 text-right">
                        ${p.revenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Promo Banner Card: Smarter Sales. Bigger Growth. */}
              <div className="rounded-2xl bg-gradient-to-br from-slate-50 via-blue-50/20 to-white border border-slate-200/80 p-4 shadow-card-subtle flex items-center gap-3">
                {/* Left image mockup */}
                <div className="w-20 h-16 rounded-xl overflow-hidden flex-shrink-0 bg-slate-200 relative">
                  <img
                    src="/images/warehouse.jpg"
                    alt="Growth"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-900/40 to-transparent" />
                </div>

                <div className="flex-1 min-w-0 space-y-1">
                  <div className="text-xs font-bold text-slate-900 leading-tight">
                    Smarter Sales. <br />
                    Bigger Growth.
                  </div>
                  <div className="text-[10px] text-slate-500 leading-snug">
                    Let KPM handle the numbers while you focus on what matters.
                  </div>
                  <button
                    onClick={() => alert("Sales Automation Suite Active")}
                    className="inline-flex items-center space-x-1 bg-[#0F172A] hover:bg-slate-800 text-white text-[10px] font-semibold px-2.5 py-1 rounded-lg mt-1 cursor-pointer"
                  >
                    <span>Get Started</span>
                    <ArrowRight className="w-2.5 h-2.5" />
                  </button>
                </div>
              </div>

            </div>

          </div>

        </main>
      </div>

      {/* ========================================================= */}
      {/* 3. MODALS (Create Sales Order, Filters)                   */}
      {/* ========================================================= */}

      {/* CREATE SALES ORDER MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-slate-200 text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-base">Create Sales Order</h3>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateOrderSubmit} className="space-y-3">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Customer Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Acme Superstores Ltd."
                  value={newOrderForm.customerName}
                  onChange={(e) =>
                    setNewOrderForm({ ...newOrderForm, customerName: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:border-blue-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Items Count</label>
                  <input
                    type="number"
                    min="1"
                    value={newOrderForm.itemsCount}
                    onChange={(e) =>
                      setNewOrderForm({ ...newOrderForm, itemsCount: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:border-blue-500 outline-none"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Total Amount ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={newOrderForm.totalAmount}
                    onChange={(e) =>
                      setNewOrderForm({ ...newOrderForm, totalAmount: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:border-blue-500 outline-none font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Channel</label>
                  <select
                    value={newOrderForm.channel}
                    onChange={(e) =>
                      setNewOrderForm({
                        ...newOrderForm,
                        channel: e.target.value as SalesOrder["channel"],
                      })
                    }
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:border-blue-500 outline-none bg-white cursor-pointer"
                  >
                    <option value="Online Store">Online Store</option>
                    <option value="Direct Sales">Direct Sales</option>
                    <option value="Retail Partners">Retail Partners</option>
                    <option value="Wholesale">Wholesale</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Status</label>
                  <select
                    value={newOrderForm.status}
                    onChange={(e) =>
                      setNewOrderForm({
                        ...newOrderForm,
                        status: e.target.value as SalesOrder["status"],
                      })
                    }
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:border-blue-500 outline-none bg-white cursor-pointer"
                  >
                    <option value="Completed">Completed</option>
                    <option value="Pending">Pending</option>
                  </select>
                </div>
              </div>

              <div className="pt-3 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#0F172A] text-white rounded-xl font-semibold hover:bg-slate-800 cursor-pointer shadow-sm"
                >
                  Create Order
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* FILTER MODAL */}
      {isFilterModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-sm w-full p-5 shadow-2xl space-y-4 border border-slate-200 text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm">Filter Orders</h3>
              <button
                onClick={() => setIsFilterModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Status</label>
                <div className="flex gap-2">
                  {["All", "Completed", "Pending"].map((s) => (
                    <button
                      key={s}
                      onClick={() => {
                        setStatusFilter(s);
                        setCurrentPage(1);
                      }}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer ${
                        statusFilter === s
                          ? "bg-[#0F172A] text-white"
                          : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Channel</label>
                <select
                  value={channelFilter}
                  onChange={(e) => {
                    setChannelFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:border-blue-500 outline-none bg-white cursor-pointer"
                >
                  <option value="All">All Channels</option>
                  <option value="Online Store">Online Store</option>
                  <option value="Direct Sales">Direct Sales</option>
                  <option value="Retail Partners">Retail Partners</option>
                  <option value="Wholesale">Wholesale</option>
                </select>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  onClick={() => setIsFilterModalOpen(false)}
                  className="px-4 py-2 bg-[#0F172A] text-white rounded-xl font-semibold cursor-pointer"
                >
                  Apply Filters
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
