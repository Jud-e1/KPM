"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import {
  Home,
  Boxes,
  Tag,
  ShoppingCart,
  FileText,
  Sparkles,
  Users,
  BarChart3,
  Settings,
  Search,
  Bell,
  ChevronDown,
  ArrowRight,
  ArrowUpRight,
  ArrowDownRight,
  SlidersHorizontal,
  LayoutGrid,
  List,
  MoreHorizontal,
  Plus,
  Upload,
  AlertTriangle,
  CheckCircle2,
  Package,
  Armchair,
  Cpu,
  Watch,
  Folder,
  Layers,
  X,
  Edit2,
  Trash2,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  RotateCcw,
  Check,
  Building2,
  Headphones,
  Laptop,
  Mouse,
  Cable,
  HardDrive,
  Coffee,
  Lamp,
  BookOpen,
} from "lucide-react";
import {
  inventoryStore,
  InventoryProduct,
  InventoryAlert,
  InventoryMetrics,
  InventoryState,
} from "@/lib/inventoryStore";
import { adjustInventoryStock, deleteInventoryProduct } from "@/lib/api";

export default function InventoryPage() {
  const [storeState, setStoreState] = useState<InventoryState>(inventoryStore.getState());
  const [activeTab, setActiveTab] = useState<"all" | "in_stock" | "low_stock" | "out_of_stock">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Modal States
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<InventoryProduct | null>(null);
  const [adjustingProduct, setAdjustingProduct] = useState<InventoryProduct | null>(null);
  const [actionMenuOpenId, setActionMenuOpenId] = useState<string | null>(null);
  const [aiChatOpen, setAiChatOpen] = useState(false);
  const [aiInput, setAiInput] = useState("");
  const [aiMessage, setAiMessage] = useState<string | null>(null);

  // New Product Form State
  const [formData, setFormData] = useState({
    name: "",
    subtitle: "",
    sku: "",
    category: "Electronics",
    stock: 50,
    price: 49.99,
    lowStockThreshold: 15,
  });

  // Stock Adjust State
  const [customStockAmount, setCustomStockAmount] = useState<number>(0);

  // Filter Popover States
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>("All");

  // Subscribe to inventoryStore on mount
  useEffect(() => {
    const unsubscribe = inventoryStore.subscribe((newState) => {
      setStoreState({ ...newState });
    });
    return () => unsubscribe();
  }, []);

  // Close menus on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (actionMenuOpenId && !(e.target as HTMLElement).closest(".action-menu-container")) {
        setActionMenuOpenId(null);
      }
    };
    window.addEventListener("click", handleClickOutside);
    return () => window.removeEventListener("click", handleClickOutside);
  }, [actionMenuOpenId]);

  const { products, alerts, metrics } = storeState;

  // Filter Products based on activeTab, categoryFilter, and search query
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      // Tab filter
      if (activeTab === "in_stock" && p.status !== "In Stock") return false;
      if (activeTab === "low_stock" && p.status !== "Low Stock") return false;
      if (activeTab === "out_of_stock" && p.status !== "Out of Stock") return false;

      // Category filter
      if (selectedCategoryFilter !== "All" && p.category !== selectedCategoryFilter) return false;

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = p.name.toLowerCase().includes(q);
        const matchSku = p.sku.toLowerCase().includes(q);
        const matchSub = p.subtitle?.toLowerCase().includes(q) || false;
        const matchCat = p.category.toLowerCase().includes(q);
        if (!matchName && !matchSku && !matchSub && !matchCat) return false;
      }

      return true;
    });
  }, [products, activeTab, selectedCategoryFilter, searchQuery]);

  // Checkbox selection
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      const allIds = new Set(filteredProducts.map((p) => p.id));
      setSelectedIds(allIds);
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectRow = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Add Product Submit
  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    if (editingProduct) {
      inventoryStore.updateProduct(editingProduct.id, {
        name: formData.name,
        subtitle: formData.subtitle,
        sku: formData.sku,
        category: formData.category,
        stock: Number(formData.stock),
        price: Number(formData.price),
        lowStockThreshold: Number(formData.lowStockThreshold),
      });
      setEditingProduct(null);
    } else {
      inventoryStore.addProduct({
        name: formData.name,
        subtitle: formData.subtitle || "Standard Item",
        sku: formData.sku || `SKU-${Math.floor(100 + Math.random() * 900)}`,
        category: formData.category,
        stock: Number(formData.stock) || 0,
        price: Number(formData.price) || 0,
        lowStockThreshold: Number(formData.lowStockThreshold) || 15,
      });
    }

    setIsAddModalOpen(false);
    setFormData({
      name: "",
      subtitle: "",
      sku: "",
      category: "Electronics",
      stock: 50,
      price: 49.99,
      lowStockThreshold: 15,
    });
  };

  const handleOpenEdit = (p: InventoryProduct) => {
    setEditingProduct(p);
    setFormData({
      name: p.name,
      subtitle: p.subtitle || "",
      sku: p.sku,
      category: p.category,
      stock: p.stock,
      price: p.price,
      lowStockThreshold: p.lowStockThreshold || 15,
    });
    setIsAddModalOpen(true);
    setActionMenuOpenId(null);
  };

  const handleDeleteProduct = async (id: string) => {
    if (!confirm("Are you sure you want to delete this product from inventory?")) return;
    inventoryStore.deleteProduct(id);
    setActionMenuOpenId(null);
    try {
      await deleteInventoryProduct(id);
    } catch {}
  };

  const handleQuickAdjustStock = async (product: InventoryProduct, delta: number) => {
    inventoryStore.adjustStock(product.id, delta, true);
    try {
      await adjustInventoryStock(product.id, delta, true);
    } catch {}
  };

  const handleSetExactStock = async () => {
    if (!adjustingProduct) return;
    inventoryStore.adjustStock(adjustingProduct.id, customStockAmount, false);
    try {
      await adjustInventoryStock(adjustingProduct.id, customStockAmount, false);
    } catch {}
    setAdjustingProduct(null);
  };

  // Bulk Delete
  const handleBulkDelete = () => {
    if (!confirm(`Delete ${selectedIds.size} selected products?`)) return;
    selectedIds.forEach((id) => inventoryStore.deleteProduct(id));
    setSelectedIds(new Set());
  };

  // Automated Reordering trigger
  const handleAutomateReorder = () => {
    const res = inventoryStore.triggerAutomateReorder();
    alert(res.message);
  };

  // AI Assistant Chat Handler
  const handleAiChatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiInput.trim()) return;
    const q = aiInput.toLowerCase();
    if (q.includes("low") || q.includes("reorder")) {
      setAiMessage(
        `There are currently ${metrics.lowStockCount} items running low (e.g. Laptop Backpack with 32 units, Office Chair with 18 units). Reorder PO can be triggered anytime with 1-click.`
      );
    } else if (q.includes("out of stock") || q.includes("zero")) {
      setAiMessage(
        `3 products are currently out of stock: Wireless Mouse (WM-022), Mechanical Gaming Keyboard (KB-093), and Ceramic Water Carafe (WC-104). Immediate supplier order recommended.`
      );
    } else if (q.includes("value") || q.includes("total")) {
      setAiMessage(
        `Total inventory valuation is $${metrics.totalStockValue.toLocaleString()} across ${metrics.totalProducts} products, led by Electronics ($202,450) and Furniture ($86,760).`
      );
    } else {
      setAiMessage(
        `KPM AI Analysis for "${aiInput}": Real-time inventory sync is active. System health is 100% operational with ${metrics.inStockPercentage}% in-stock availability rate.`
      );
    }
  };

  // Helper for Product Icons
  const renderProductIcon = (p: InventoryProduct) => {
    const nameLower = p.name.toLowerCase();
    const catLower = p.category.toLowerCase();

    let IconComp = Package;
    if (nameLower.includes("headphone") || nameLower.includes("earbud")) IconComp = Headphones;
    else if (nameLower.includes("watch")) IconComp = Watch;
    else if (nameLower.includes("backpack") || nameLower.includes("folder")) IconComp = Folder;
    else if (nameLower.includes("mouse")) IconComp = Mouse;
    else if (nameLower.includes("cable")) IconComp = Cable;
    else if (nameLower.includes("chair")) IconComp = Armchair;
    else if (nameLower.includes("notebook") || nameLower.includes("pen")) IconComp = BookOpen;
    else if (nameLower.includes("hard drive") || nameLower.includes("camera")) IconComp = HardDrive;
    else if (nameLower.includes("mug") || nameLower.includes("coffee") || nameLower.includes("teapot")) IconComp = Coffee;
    else if (nameLower.includes("lamp")) IconComp = Lamp;
    else if (catLower.includes("electronics")) IconComp = Cpu;
    else if (catLower.includes("furniture")) IconComp = Armchair;

    return (
      <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200/80 flex items-center justify-center text-slate-700 flex-shrink-0 group-hover:scale-105 transition-transform">
        <IconComp className="w-5 h-5 text-slate-800 stroke-[1.8]" />
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
          
          {/* Logo & Subtitle */}
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

          {/* Navigation Links */}
          <nav className="space-y-1">
            {[
              { name: "Home", icon: Home, href: "/dashboard" },
              { name: "Inventory", icon: Boxes, href: "/inventory", active: true },
              { name: "Sales", icon: Tag, href: "/dashboard" },
              { name: "Purchases", icon: ShoppingCart, href: "/dashboard" },
              { name: "Accounting", icon: FileText, href: "/dashboard" },
              { name: "AI Insights", icon: Sparkles, href: "/insights" },
              { name: "Suppliers", icon: Users, href: "/dashboard" },
              { name: "Customers", icon: Users, href: "/dashboard" },
              { name: "Reports", icon: BarChart3, href: "/dashboard" },
              { name: "Settings", icon: Settings, href: "/dashboard" },
            ].map((item) => {
              const Icon = item.icon;
              const isActive = item.active;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    isActive
                      ? "bg-[#0F172A] text-white shadow-sm"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? "text-white" : "text-slate-500"}`} />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Bottom Sidebar Cards: AI Assistant & Org Switcher */}
        <div className="space-y-3 pt-4 border-t border-slate-100">
          {/* AI Assistant Card */}
          <div className="rounded-2xl bg-gradient-to-br from-indigo-50/70 via-blue-50/40 to-slate-50 border border-indigo-100/70 p-3.5 space-y-2.5 shadow-2xs">
            <div className="flex items-center space-x-2">
              <div className="w-6 h-6 rounded-lg bg-indigo-600/10 text-indigo-600 flex items-center justify-center">
                <Sparkles className="w-3.5 h-3.5" />
              </div>
              <span className="text-xs font-bold text-slate-900">AI Assistant</span>
            </div>
            <p className="text-[11px] text-slate-500 leading-snug">
              Ask anything about your inventory, sales or finances.
            </p>
            <button
              onClick={() => setAiChatOpen(true)}
              className="w-full inline-flex items-center justify-center space-x-1.5 bg-[#0F172A] hover:bg-slate-800 text-white text-[11px] font-semibold py-1.5 px-3 rounded-lg shadow-2xs transition-colors cursor-pointer"
            >
              <span>Chat Now</span>
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
          {/* Global Search */}
          <div className="relative w-full max-w-md sm:max-w-xl">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search products, SKU, suppliers, or anything..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-12 py-2 bg-slate-50 border border-slate-200/80 rounded-full text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-blue-400 transition-all"
            />
            <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-slate-400 bg-white border border-slate-200 px-1.5 py-0.5 rounded shadow-2xs">
              ⌘ K
            </span>
          </div>

          {/* User Profile & Bell */}
          <div className="flex items-center space-x-4 pl-4">
            {/* Bell */}
            <div className="relative">
              <button 
                onClick={() => alert(`Active alerts: ${alerts.length} unread updates`)}
                className="w-9 h-9 rounded-full bg-slate-50 hover:bg-slate-100 border border-slate-200/70 flex items-center justify-center text-slate-600 transition-colors cursor-pointer relative"
              >
                <Bell className="w-4 h-4" />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full ring-2 ring-white" />
              </button>
            </div>

            {/* Profile */}
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

        {/* Inventory Main Body */}
        <main className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-[1600px] w-full mx-auto">
          
          {/* Header & Smarter Inventory Banner Row */}
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0F172A] tracking-tight">
                Inventory
              </h1>
              <p className="text-xs sm:text-[13px] text-slate-500 mt-1">
                Track your stock, manage products, and keep your business moving.
              </p>
            </div>

            {/* Smarter Inventory Warehouse Banner */}
            <div className="relative rounded-2xl bg-white border border-slate-200/80 shadow-card-subtle px-5 py-3.5 flex items-center justify-between gap-6 overflow-hidden max-w-xl w-full">
              {/* Background Warehouse image faded */}
              <div className="absolute right-0 top-0 bottom-0 w-44 pointer-events-none opacity-40">
                <img
                  src="/images/warehouse.jpg"
                  alt="Warehouse"
                  className="w-full h-full object-cover rounded-r-2xl"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-white via-white/80 to-transparent" />
              </div>

              <div className="relative z-10 space-y-1">
                <div className="text-xs font-bold text-slate-900 leading-tight">
                  Smarter inventory. Stronger business.
                </div>
                <div className="text-[10.5px] text-slate-500 leading-tight">
                  Real-time stock, automated reordering, AI-powered insights.
                </div>
              </div>

              <div className="relative z-10 flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => {
                    setEditingProduct(null);
                    setFormData({
                      name: "",
                      subtitle: "",
                      sku: `SKU-${Math.floor(100 + Math.random() * 900)}`,
                      category: "Electronics",
                      stock: 50,
                      price: 49.99,
                      lowStockThreshold: 15,
                    });
                    setIsAddModalOpen(true);
                  }}
                  className="inline-flex items-center space-x-1.5 bg-[#0F172A] hover:bg-slate-800 text-white text-xs font-semibold px-3.5 py-2 rounded-xl shadow-2xs transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Product</span>
                </button>

                <button
                  onClick={() => setIsImportModalOpen(true)}
                  className="inline-flex items-center space-x-1.5 bg-white hover:bg-slate-50 border border-slate-200/90 text-slate-700 text-xs font-semibold px-3 py-2 rounded-xl shadow-2xs transition-colors cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Import</span>
                </button>
              </div>
            </div>
          </div>

          {/* 4 Metric Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: Total Products */}
            <div className="rounded-2xl bg-white border border-slate-200/80 p-4 shadow-card-subtle flex items-start space-x-3.5">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
                <Package className="w-5 h-5" />
              </div>
              <div className="space-y-0.5">
                <div className="text-[11px] font-medium text-slate-500">Total Products</div>
                <div className="text-2xl font-black text-slate-900 tracking-tight">
                  {metrics.totalProducts}
                </div>
                <div className="text-[10px] font-semibold text-emerald-600 flex items-center pt-0.5">
                  <ArrowUpRight className="w-3 h-3 mr-0.5" />
                  <span>12%</span>
                  <span className="text-slate-400 font-normal ml-1">vs last month</span>
                </div>
              </div>
            </div>

            {/* Card 2: Total Stock Value */}
            <div className="rounded-2xl bg-white border border-slate-200/80 p-4 shadow-card-subtle flex items-start space-x-3.5">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center flex-shrink-0">
                <FileText className="w-5 h-5" />
              </div>
              <div className="space-y-0.5">
                <div className="text-[11px] font-medium text-slate-500">Total Stock Value</div>
                <div className="text-2xl font-black text-slate-900 tracking-tight">
                  ${metrics.totalStockValue.toLocaleString()}
                </div>
                <div className="text-[10px] font-semibold text-emerald-600 flex items-center pt-0.5">
                  <ArrowUpRight className="w-3 h-3 mr-0.5" />
                  <span>8%</span>
                  <span className="text-slate-400 font-normal ml-1">vs last month</span>
                </div>
              </div>
            </div>

            {/* Card 3: Low Stock Items */}
            <div className="rounded-2xl bg-white border border-slate-200/80 p-4 shadow-card-subtle flex items-start space-x-3.5">
              <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-500 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="space-y-0.5">
                <div className="text-[11px] font-medium text-slate-500">Low Stock Items</div>
                <div className="text-2xl font-black text-slate-900 tracking-tight">
                  {metrics.lowStockCount}
                </div>
                <div className="text-[10px] font-semibold text-rose-500 flex items-center pt-0.5">
                  <ArrowDownRight className="w-3 h-3 mr-0.5" />
                  <span>40%</span>
                  <span className="text-slate-400 font-normal ml-1">vs last week</span>
                </div>
              </div>
            </div>

            {/* Card 4: Out of Stock */}
            <div className="rounded-2xl bg-white border border-slate-200/80 p-4 shadow-card-subtle flex items-start space-x-3.5">
              <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center flex-shrink-0">
                <TrendingDown className="w-5 h-5" />
              </div>
              <div className="space-y-0.5">
                <div className="text-[11px] font-medium text-slate-500">Out of Stock</div>
                <div className="text-2xl font-black text-slate-900 tracking-tight">
                  {metrics.outOfStockCount}
                </div>
                <div className="text-[10px] font-semibold text-rose-500 flex items-center pt-0.5">
                  <ArrowDownRight className="w-3 h-3 mr-0.5" />
                  <span>67%</span>
                  <span className="text-slate-400 font-normal ml-1">vs last week</span>
                </div>
              </div>
            </div>
          </div>

          {/* Main 2-Column Split: Table Area (Left 8 cols) & Analytics Panel (Right 4 cols) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* LEFT COLUMN: Filter Tabs & Products Table */}
            <div className="lg:col-span-8 space-y-4">
              
              {/* Tab Filters Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 pb-1 border-b border-slate-200">
                {/* 4 Tabs */}
                <div className="flex items-center space-x-1 sm:space-x-4">
                  {[
                    { id: "all", label: `All Products (${metrics.totalProducts})` },
                    { id: "in_stock", label: `In Stock (${metrics.inStockCount})` },
                    { id: "low_stock", label: `Low Stock (${metrics.lowStockCount})` },
                    { id: "out_of_stock", label: `Out of Stock (${metrics.outOfStockCount})` },
                  ].map((tab) => {
                    const isActive = activeTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`text-xs font-semibold py-2.5 px-2 relative transition-colors cursor-pointer ${
                          isActive
                            ? "text-[#0F172A] font-bold"
                            : "text-slate-500 hover:text-slate-800"
                        }`}
                      >
                        <span>{tab.label}</span>
                        {isActive && (
                          <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#0F172A] rounded-full" />
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Right controls: Filters button, Grid toggle, List toggle */}
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setIsFiltersOpen(!isFiltersOpen)}
                    className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors cursor-pointer ${
                      selectedCategoryFilter !== "All"
                        ? "bg-blue-50 border-blue-200 text-blue-700"
                        : "bg-white border-slate-200/90 text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5" />
                    <span>Filters</span>
                    {selectedCategoryFilter !== "All" && (
                      <span className="w-2 h-2 rounded-full bg-blue-600" />
                    )}
                  </button>

                  <div className="flex items-center bg-slate-100 rounded-lg p-0.5 border border-slate-200/70">
                    <button
                      onClick={() => setViewMode("grid")}
                      className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                        viewMode === "grid"
                          ? "bg-white text-slate-900 shadow-2xs"
                          : "text-slate-400 hover:text-slate-600"
                      }`}
                      title="Grid View"
                    >
                      <LayoutGrid className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setViewMode("list")}
                      className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                        viewMode === "list"
                          ? "bg-white text-slate-900 shadow-2xs"
                          : "text-slate-400 hover:text-slate-600"
                      }`}
                      title="List View"
                    >
                      <List className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Bulk Action Bar if Items Selected */}
              {selectedIds.size > 0 && (
                <div className="p-3 bg-slate-900 text-white rounded-xl flex items-center justify-between text-xs animate-in fade-in duration-150">
                  <div className="font-semibold flex items-center space-x-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>{selectedIds.size} products selected</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={handleBulkDelete}
                      className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-lg flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Delete Selected</span>
                    </button>
                    <button
                      onClick={() => setSelectedIds(new Set())}
                      className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg cursor-pointer"
                    >
                      Deselect
                    </button>
                  </div>
                </div>
              )}

              {/* Category Filter Drawer Popover */}
              {isFiltersOpen && (
                <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-lg space-y-3 animate-in fade-in duration-150 text-xs">
                  <div className="flex items-center justify-between font-bold text-slate-800">
                    <span>Filter by Category</span>
                    <button onClick={() => setIsFiltersOpen(false)} className="text-slate-400 hover:text-slate-600">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {["All", "Electronics", "Furniture", "Accessories", "Home & Kitchen", "Stationery", "Bags & Luggage", "Others"].map(
                      (cat) => (
                        <button
                          key={cat}
                          onClick={() => {
                            setSelectedCategoryFilter(cat);
                            setIsFiltersOpen(false);
                          }}
                          className={`px-3 py-1.5 rounded-full font-medium transition-colors cursor-pointer ${
                            selectedCategoryFilter === cat
                              ? "bg-[#0F172A] text-white"
                              : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                          }`}
                        >
                          {cat}
                        </button>
                      )
                    )}
                  </div>
                </div>
              )}

              {/* LIST VIEW TABLE */}
              {viewMode === "list" ? (
                <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card-subtle overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-100 bg-slate-50/50 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                          <th className="py-3 px-4 w-10">
                            <input
                              type="checkbox"
                              checked={
                                filteredProducts.length > 0 &&
                                selectedIds.size === filteredProducts.length
                              }
                              onChange={handleSelectAll}
                              className="w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-0 cursor-pointer"
                            />
                          </th>
                          <th className="py-3 px-4">Product</th>
                          <th className="py-3 px-4">SKU</th>
                          <th className="py-3 px-4">Category</th>
                          <th className="py-3 px-4">Stock</th>
                          <th className="py-3 px-4">Status</th>
                          <th className="py-3 px-4">Price</th>
                          <th className="py-3 px-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs">
                        {filteredProducts.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="py-12 text-center text-slate-400">
                              No products found matching your search.
                            </td>
                          </tr>
                        ) : (
                          filteredProducts.slice(0, 30).map((product) => {
                            const isChecked = selectedIds.has(product.id);
                            return (
                              <tr
                                key={product.id}
                                className={`group hover:bg-slate-50/70 transition-colors ${
                                  isChecked ? "bg-blue-50/30" : ""
                                }`}
                              >
                                {/* Checkbox */}
                                <td className="py-3.5 px-4">
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => handleSelectRow(product.id)}
                                    className="w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-0 cursor-pointer"
                                  />
                                </td>

                                {/* Product Name & Subtitle */}
                                <td className="py-3.5 px-4">
                                  <div className="flex items-center space-x-3">
                                    {renderProductIcon(product)}
                                    <div>
                                      <div className="font-bold text-slate-900 leading-tight group-hover:text-blue-600 transition-colors">
                                        {product.name}
                                      </div>
                                      <div className="text-[10.5px] text-slate-400 mt-0.5">
                                        {product.subtitle}
                                      </div>
                                    </div>
                                  </div>
                                </td>

                                {/* SKU */}
                                <td className="py-3.5 px-4 font-mono text-[11px] font-medium text-slate-500">
                                  {product.sku}
                                </td>

                                {/* Category */}
                                <td className="py-3.5 px-4 text-slate-600 font-medium">
                                  {product.category}
                                </td>

                                {/* Stock */}
                                <td className="py-3.5 px-4">
                                  <span className="font-bold text-slate-900">
                                    {product.stock}
                                  </span>
                                </td>

                                {/* Status Badge */}
                                <td className="py-3.5 px-4">
                                  {product.status === "In Stock" && (
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10.5px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                                      In Stock
                                    </span>
                                  )}
                                  {product.status === "Low Stock" && (
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10.5px] font-semibold bg-amber-50 text-amber-700 border border-amber-200/60">
                                      Low Stock
                                    </span>
                                  )}
                                  {product.status === "Out of Stock" && (
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10.5px] font-semibold bg-rose-50 text-rose-600 border border-rose-200/60">
                                      Out of Stock
                                    </span>
                                  )}
                                </td>

                                {/* Price */}
                                <td className="py-3.5 px-4 font-bold text-slate-900">
                                  ${product.price.toFixed(2)}
                                </td>

                                {/* Actions Menu */}
                                <td className="py-3.5 px-4 text-right relative action-menu-container">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setActionMenuOpenId(
                                        actionMenuOpenId === product.id ? null : product.id
                                      );
                                    }}
                                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                                  >
                                    <MoreHorizontal className="w-4 h-4" />
                                  </button>

                                  {/* Actions Dropdown */}
                                  {actionMenuOpenId === product.id && (
                                    <div className="absolute right-4 top-10 w-44 bg-white rounded-2xl border border-slate-200 shadow-xl p-1.5 z-40 text-xs animate-in fade-in duration-100 text-left">
                                      <button
                                        onClick={() => handleOpenEdit(product)}
                                        className="w-full flex items-center space-x-2 px-3 py-2 rounded-xl hover:bg-slate-50 text-slate-700 font-medium cursor-pointer"
                                      >
                                        <Edit2 className="w-3.5 h-3.5" />
                                        <span>Edit Details</span>
                                      </button>
                                      <button
                                        onClick={() => {
                                          setAdjustingProduct(product);
                                          setCustomStockAmount(product.stock);
                                          setActionMenuOpenId(null);
                                        }}
                                        className="w-full flex items-center space-x-2 px-3 py-2 rounded-xl hover:bg-slate-50 text-slate-700 font-medium cursor-pointer"
                                      >
                                        <RefreshCw className="w-3.5 h-3.5" />
                                        <span>Adjust Stock</span>
                                      </button>
                                      <div className="flex items-center justify-between px-3 py-1.5 text-[11px] text-slate-500 border-t border-b border-slate-100 my-1">
                                        <span>Quick Stock:</span>
                                        <div className="flex items-center gap-1">
                                          <button
                                            onClick={() => handleQuickAdjustStock(product, -10)}
                                            className="px-1.5 py-0.5 bg-slate-100 hover:bg-slate-200 rounded font-bold"
                                            title="Reduce 10"
                                          >
                                            -10
                                          </button>
                                          <button
                                            onClick={() => handleQuickAdjustStock(product, 10)}
                                            className="px-1.5 py-0.5 bg-slate-100 hover:bg-slate-200 rounded font-bold"
                                            title="Add 10"
                                          >
                                            +10
                                          </button>
                                        </div>
                                      </div>
                                      <button
                                        onClick={() => handleDeleteProduct(product.id)}
                                        className="w-full flex items-center space-x-2 px-3 py-2 rounded-xl hover:bg-rose-50 text-rose-600 font-medium cursor-pointer"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                        <span>Delete Product</span>
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

                  {filteredProducts.length > 30 && (
                    <div className="p-3 text-center border-t border-slate-100 text-xs text-slate-400">
                      Showing 30 of {filteredProducts.length} items. Use search to find specific items.
                    </div>
                  )}
                </div>
              ) : (
                /* GRID VIEW */
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredProducts.map((product) => (
                    <div
                      key={product.id}
                      className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-card-subtle flex flex-col justify-between space-y-3"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center space-x-3">
                          {renderProductIcon(product)}
                          <div>
                            <div className="font-bold text-slate-900 text-xs leading-tight">
                              {product.name}
                            </div>
                            <div className="text-[10px] text-slate-400 mt-0.5">
                              {product.sku} &middot; {product.category}
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => handleOpenEdit(product)}
                          className="text-slate-400 hover:text-slate-600 p-1"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                        <div>
                          <span className="text-[10px] text-slate-400 block">Stock</span>
                          <span className="font-bold text-slate-900">{product.stock}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block">Price</span>
                          <span className="font-bold text-slate-900">${product.price.toFixed(2)}</span>
                        </div>
                        <div>
                          {product.status === "In Stock" && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700">
                              In Stock
                            </span>
                          )}
                          {product.status === "Low Stock" && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700">
                              Low Stock
                            </span>
                          )}
                          {product.status === "Out of Stock" && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-50 text-rose-600">
                              Out of Stock
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* RIGHT COLUMN: Analytics Panel (Stock Overview Donut, Top Categories, Alerts, Reorder Banner) */}
            <div className="lg:col-span-4 space-y-5">
              
              {/* 1. Stock Overview Donut Chart */}
              <div className="rounded-2xl bg-white border border-slate-200/80 p-5 shadow-card-subtle space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <h3 className="text-xs font-bold text-slate-900">Stock Overview</h3>
                  <div className="flex items-center space-x-1 text-[11px] font-semibold text-slate-500 cursor-pointer hover:text-slate-800">
                    <span>This month</span>
                    <ChevronDown className="w-3 h-3 text-slate-400" />
                  </div>
                </div>

                {/* Donut Chart & Legend */}
                <div className="flex items-center justify-between gap-4 pt-1">
                  {/* SVG Donut */}
                  <div className="relative w-32 h-32 flex-shrink-0">
                    <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                      {/* Background circle */}
                      <circle
                        cx="50"
                        cy="50"
                        r="40"
                        fill="transparent"
                        stroke="#F1F5F9"
                        strokeWidth="12"
                      />
                      {/* In Stock arc (Dark Slate #0F172A) */}
                      <circle
                        cx="50"
                        cy="50"
                        r="40"
                        fill="transparent"
                        stroke="#0F172A"
                        strokeWidth="12"
                        strokeDasharray="251.2"
                        strokeDashoffset={251.2 - (251.2 * metrics.inStockPercentage) / 100}
                        strokeLinecap="round"
                        className="transition-all duration-500"
                      />
                      {/* Low Stock arc (Amber #F59E0B) */}
                      <circle
                        cx="50"
                        cy="50"
                        r="40"
                        fill="transparent"
                        stroke="#F59E0B"
                        strokeWidth="12"
                        strokeDasharray="251.2"
                        strokeDashoffset={
                          251.2 - (251.2 * (metrics.inStockPercentage + metrics.lowStockPercentage)) / 100
                        }
                        className="transition-all duration-500"
                      />
                      {/* Out of Stock arc (Rose #EF4444) */}
                      <circle
                        cx="50"
                        cy="50"
                        r="40"
                        fill="transparent"
                        stroke="#EF4444"
                        strokeWidth="12"
                        strokeDasharray="251.2"
                        strokeDashoffset={251.2 - (251.2 * metrics.outOfStockPercentage) / 100}
                        className="transition-all duration-500"
                      />
                    </svg>
                    
                    {/* Donut Center Label */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <span className="text-base font-extrabold text-slate-900 leading-none">
                        {metrics.totalProducts}
                      </span>
                      <span className="text-[9px] font-semibold text-slate-400 mt-0.5">
                        Total Products
                      </span>
                    </div>
                  </div>

                  {/* Legend matching screenshot */}
                  <div className="space-y-2 text-xs flex-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#0F172A]" />
                        <span className="text-slate-600 font-medium">In Stock</span>
                      </div>
                      <span className="font-bold text-slate-900">
                        {metrics.inStockCount} ({metrics.inStockPercentage}%)
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                        <span className="text-slate-600 font-medium">Low Stock</span>
                      </div>
                      <span className="font-bold text-slate-900">
                        {metrics.lowStockCount} ({metrics.lowStockPercentage}%)
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                        <span className="text-slate-600 font-medium">Out of Stock</span>
                      </div>
                      <span className="font-bold text-slate-900">
                        {metrics.outOfStockCount} ({metrics.outOfStockPercentage}%)
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 2. Top Categories Progress Card */}
              <div className="rounded-2xl bg-white border border-slate-200/80 p-5 shadow-card-subtle space-y-3.5">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <h3 className="text-xs font-bold text-slate-900">Top Categories</h3>
                  <div className="flex items-center space-x-1 text-[11px] font-semibold text-slate-500 cursor-pointer hover:text-slate-800">
                    <span>Value</span>
                    <ChevronDown className="w-3 h-3 text-slate-400" />
                  </div>
                </div>

                <div className="space-y-3 pt-1">
                  {metrics.topCategories.map((cat) => {
                    let Icon = Package;
                    if (cat.name === "Electronics") Icon = Cpu;
                    else if (cat.name === "Furniture") Icon = Armchair;
                    else if (cat.name === "Accessories") Icon = Tag;
                    else if (cat.name === "Home & Kitchen") Icon = Home;
                    else if (cat.name === "Stationery") Icon = BookOpen;
                    else Icon = Layers;

                    return (
                      <div key={cat.name} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center space-x-2">
                            <Icon className="w-3.5 h-3.5 text-slate-500" />
                            <span className="font-medium text-slate-700">{cat.name}</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <span className="text-[11px] text-slate-400">{cat.percentage}%</span>
                            <span className="font-bold text-slate-900">
                              ${cat.value.toLocaleString()}
                            </span>
                          </div>
                        </div>

                        {/* Progress bar */}
                        <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#0F172A] rounded-full transition-all duration-500"
                            style={{ width: `${Math.min(100, Math.max(5, cat.percentage))}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 3. Recent Alerts Card */}
              <div className="rounded-2xl bg-white border border-slate-200/80 p-5 shadow-card-subtle space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <h3 className="text-xs font-bold text-slate-900">Recent Alerts</h3>
                  <button
                    onClick={() => alert("All system telemetry alerts operational.")}
                    className="text-[11px] font-bold text-blue-600 hover:underline flex items-center gap-0.5 cursor-pointer"
                  >
                    <span>View all</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>

                <div className="space-y-3 pt-1">
                  {alerts.slice(0, 4).map((alertItem) => (
                    <div key={alertItem.id} className="flex items-start space-x-3 text-xs">
                      {alertItem.type === "critical" && (
                        <div className="w-7 h-7 rounded-full bg-rose-50 text-rose-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <AlertTriangle className="w-3.5 h-3.5" />
                        </div>
                      )}
                      {alertItem.type === "warning" && (
                        <div className="w-7 h-7 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <AlertTriangle className="w-3.5 h-3.5" />
                        </div>
                      )}
                      {alertItem.type === "info" && (
                        <div className="w-7 h-7 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <RotateCcw className="w-3.5 h-3.5" />
                        </div>
                      )}
                      {alertItem.type === "success" && (
                        <div className="w-7 h-7 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        </div>
                      )}

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-900 truncate">
                            {alertItem.title}
                          </span>
                          <span className="text-[10px] text-slate-400 flex-shrink-0 ml-1">
                            {alertItem.time}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                          {alertItem.subtitle}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 4. Automate Reordering Banner Card */}
              <div className="rounded-2xl bg-gradient-to-br from-amber-50/70 via-orange-50/40 to-slate-50 border border-amber-200/60 p-4 shadow-card-subtle flex items-center justify-between gap-3">
                <div className="w-12 h-12 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center flex-shrink-0 shadow-2xs">
                  <Package className="w-6 h-6" />
                </div>
                <div className="flex-1 min-w-0 space-y-0.5">
                  <div className="text-xs font-bold text-slate-900">
                    Automate Reordering
                  </div>
                  <div className="text-[10.5px] text-slate-500 leading-snug">
                    Let KPM handle low stock alerts and supplier orders.
                  </div>
                  <button
                    onClick={handleAutomateReorder}
                    className="text-[11px] font-bold text-slate-900 hover:text-blue-600 flex items-center gap-1 pt-1 cursor-pointer"
                  >
                    <span>Set up now</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>

            </div>
          </div>
        </main>
      </div>

      {/* ========================================================= */}
      {/* 3. MODALS (Add/Edit, Stock Adjust, Import, AI Assistant) */}
      {/* ========================================================= */}

      {/* A. ADD / EDIT PRODUCT MODAL */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-slate-200 text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-base">
                {editingProduct ? "Edit Product" : "Add New Product"}
              </h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="space-y-3">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Product Name *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Wireless Bluetooth Headphones"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:border-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Subtitle / Details</label>
                <input
                  type="text"
                  value={formData.subtitle}
                  onChange={(e) => setFormData({ ...formData, subtitle: e.target.value })}
                  placeholder="e.g. Noise Cancelling, Black"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:border-blue-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">SKU</label>
                  <input
                    type="text"
                    value={formData.sku}
                    onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                    placeholder="e.g. WH-001"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:border-blue-500 outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Category</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:border-blue-500 outline-none bg-white cursor-pointer"
                  >
                    <option value="Electronics">Electronics</option>
                    <option value="Furniture">Furniture</option>
                    <option value="Accessories">Accessories</option>
                    <option value="Home & Kitchen">Home & Kitchen</option>
                    <option value="Stationery">Stationery</option>
                    <option value="Bags & Luggage">Bags & Luggage</option>
                    <option value="Others">Others</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Stock Qty</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.stock}
                    onChange={(e) => setFormData({ ...formData, stock: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:border-blue-500 outline-none font-bold"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Price ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:border-blue-500 outline-none font-bold"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Low Alert</label>
                  <input
                    type="number"
                    min="1"
                    value={formData.lowStockThreshold}
                    onChange={(e) =>
                      setFormData({ ...formData, lowStockThreshold: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:border-blue-500 outline-none"
                  />
                </div>
              </div>

              <div className="pt-3 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#0F172A] text-white rounded-xl font-semibold hover:bg-slate-800 cursor-pointer shadow-sm"
                >
                  {editingProduct ? "Save Changes" : "Create Product"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* B. QUICK STOCK ADJUST MODAL */}
      {adjustingProduct && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl space-y-4 border border-slate-200 text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Adjust Stock Level</h3>
                <p className="text-[11px] text-slate-400 mt-0.5">{adjustingProduct.name}</p>
              </div>
              <button
                onClick={() => setAdjustingProduct(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-center space-x-4 py-2">
                <button
                  onClick={() => setCustomStockAmount(Math.max(0, customStockAmount - 10))}
                  className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-base cursor-pointer"
                >
                  -10
                </button>
                <input
                  type="number"
                  min="0"
                  value={customStockAmount}
                  onChange={(e) => setCustomStockAmount(Math.max(0, Number(e.target.value)))}
                  className="w-24 text-center py-2 text-xl font-extrabold text-slate-900 border border-slate-200 rounded-xl"
                />
                <button
                  onClick={() => setCustomStockAmount(customStockAmount + 10)}
                  className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-base cursor-pointer"
                >
                  +10
                </button>
              </div>

              <div className="flex justify-between text-[11px] text-slate-500">
                <span>Threshold: {adjustingProduct.lowStockThreshold || 15} units</span>
                <span className="font-semibold">
                  Result: {customStockAmount === 0 ? "Out of Stock" : customStockAmount <= (adjustingProduct.lowStockThreshold || 15) ? "Low Stock" : "In Stock"}
                </span>
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  onClick={() => setAdjustingProduct(null)}
                  className="px-4 py-2 border border-slate-200 rounded-xl font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSetExactStock}
                  className="px-4 py-2 bg-[#0F172A] text-white rounded-xl font-semibold hover:bg-slate-800 cursor-pointer shadow-sm"
                >
                  Update Stock
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* C. IMPORT CATALOG MODAL */}
      {isImportModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-slate-200 text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-base">Import Products</h3>
              <button
                onClick={() => setIsImportModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-slate-500 text-[11.5px]">
              Bulk import SKU listings from your ERP or catalog CSV/JSON format.
            </p>

            <div className="p-4 border-2 border-dashed border-slate-200 rounded-2xl text-center space-y-2 bg-slate-50/50">
              <Upload className="w-6 h-6 text-slate-400 mx-auto" />
              <div className="font-semibold text-slate-700">Drag & drop CSV / Excel file</div>
              <div className="text-[10.5px] text-slate-400">Supports .csv, .xlsx, .json</div>
            </div>

            <div className="pt-2 flex justify-between items-center">
              <button
                onClick={() => {
                  inventoryStore.resetToDefault();
                  setIsImportModalOpen(false);
                  alert("Restored standard catalog with 248 items and exact baseline values.");
                }}
                className="text-blue-600 font-semibold hover:underline cursor-pointer"
              >
                Reset to Baseline Catalog
              </button>
              <div className="flex space-x-2">
                <button
                  onClick={() => setIsImportModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    inventoryStore.bulkImport([
                      {
                        name: "Smart Security IP Camera",
                        subtitle: "1080p Wi-Fi Night Vision",
                        sku: "SC-901",
                        category: "Electronics",
                        stock: 60,
                        price: 39.99,
                        status: "In Stock",
                        lowStockThreshold: 15,
                      },
                      {
                        name: "Ergonomic Footrest Cushion",
                        subtitle: "Memory Foam Non-Slip",
                        sku: "FR-902",
                        category: "Furniture",
                        stock: 12,
                        price: 24.99,
                        status: "Low Stock",
                        lowStockThreshold: 15,
                      },
                    ]);
                    setIsImportModalOpen(false);
                    alert("Imported sample batch products successfully!");
                  }}
                  className="px-4 py-2 bg-[#0F172A] text-white rounded-xl font-semibold hover:bg-slate-800 cursor-pointer shadow-sm"
                >
                  Load Sample Batch
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* D. AI ASSISTANT CHAT POPUP */}
      {aiChatOpen && (
        <div className="fixed bottom-6 right-6 w-96 bg-white rounded-3xl shadow-2xl border border-slate-200 p-4 z-50 animate-in slide-in-from-bottom-5 duration-200 space-y-3 text-xs">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div className="flex items-center space-x-2 font-bold text-slate-900">
              <Sparkles className="w-4 h-4 text-indigo-600" />
              <span>KPM Inventory AI</span>
            </div>
            <button onClick={() => setAiChatOpen(false)} className="text-slate-400 hover:text-slate-600">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
            <div className="p-2.5 rounded-xl bg-slate-100 text-slate-700 text-[11px] leading-relaxed">
              Hello Jude! I'm your inventory AI assistant. Ask me anything about current stock counts, out-of-stock items, valuation, or automated reordering.
            </div>

            {aiMessage && (
              <div className="p-2.5 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-950 text-[11px] leading-relaxed animate-in fade-in">
                {aiMessage}
              </div>
            )}
          </div>

          <form onSubmit={handleAiChatSubmit} className="relative pt-1">
            <input
              type="text"
              placeholder="Ask e.g. Which items are low in stock?..."
              value={aiInput}
              onChange={(e) => setAiInput(e.target.value)}
              className="w-full pl-3 pr-9 py-2 border border-slate-200 rounded-xl focus:border-indigo-500 outline-none text-xs"
            />
            <button
              type="submit"
              className="absolute right-2 top-3 w-6 h-6 rounded-lg bg-[#0F172A] text-white flex items-center justify-center cursor-pointer"
            >
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      )}

    </div>
  );
}
