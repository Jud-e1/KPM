"use client";

import React, { startTransition, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Bell,
  Boxes,
  BriefcaseBusiness,
  Building2,
  Calendar,
  ChevronDown,
  ChevronRight,
  FileBarChart,
  FileText,
  Landmark,
  MoreHorizontal,
  Package,
  Plus,
  ReceiptText,
  Search,
  Settings,
  SlidersHorizontal,
  Sparkles,
  Tags,
  UserRound,
  Users,
  WalletCards,
  X,
} from "lucide-react";
import {
  accountingStore,
  AccountingState,
  AccountingTransaction,
  TransactionStatus,
  TransactionType,
} from "@/lib/accountingStore";
import {
  createAccountingTransaction,
  updateAccountingProfile,
  updateAccountingTransaction,
} from "@/lib/api";

const formatCurrency = (amount: number) =>
  `$${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function StatusPill({ status }: { status: TransactionStatus }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${status === "Cleared" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${status === "Cleared" ? "bg-emerald-500" : "bg-amber-500"}`} />
      {status}
    </span>
  );
}

function TypePill({ type }: { type: TransactionType }) {
  const styles = type === "Income" ? "bg-blue-100 text-blue-700" : type === "Expense" ? "bg-rose-100 text-rose-600" : "bg-violet-100 text-violet-700";
  return <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${styles}`}>{type}</span>;
}

function profileInitials(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  const initials = `${parts[0]?.[0] || ""}${parts[1]?.[0] || ""}`.toUpperCase();
  return initials || "JA";
}

export default function AccountingPage() {
  const [accountingState, setAccountingState] = useState<AccountingState>(accountingStore.getState());
  const [searchQuery, setSearchQuery] = useState("");
  const [tableSearch, setTableSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"All" | TransactionType>("All");
  const [statusFilter, setStatusFilter] = useState<"All" | TransactionStatus>("All");
  const [currentPage, setCurrentPage] = useState(1);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [actionMenuId, setActionMenuId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const transactionTableRef = useRef<HTMLDivElement>(null);
  const itemsPerPage = 6;
  const [newTransaction, setNewTransaction] = useState({
    description: "",
    reference: "",
    counterparty: "",
    category: "Sales Revenue",
    account: "Accounts Receivable",
    type: "Income" as TransactionType,
    amount: 0,
    status: "Cleared" as TransactionStatus,
  });
  const [profileForm, setProfileForm] = useState({
    fullName: accountingState.profile.fullName,
    role: accountingState.profile.role,
    organization: accountingState.profile.organization,
    autoReconciliation: accountingState.profile.autoReconciliation,
    notificationsEnabled: accountingState.profile.notificationsEnabled,
  });

  useEffect(() => {
    const unsubscribe = accountingStore.subscribe((state) => {
      startTransition(() => setAccountingState(state));
    });
    const disconnectLiveSync = accountingStore.connectLive();
    return () => {
      unsubscribe();
      disconnectLiveSync();
    };
  }, []);

  useEffect(() => {
    if (isProfileOpen) {
      setProfileForm({
        fullName: accountingState.profile.fullName,
        role: accountingState.profile.role,
        organization: accountingState.profile.organization,
        autoReconciliation: accountingState.profile.autoReconciliation,
        notificationsEnabled: accountingState.profile.notificationsEnabled,
      });
    }
  }, [isProfileOpen, accountingState.profile]);

  useEffect(() => {
    const closeMenu = (event: MouseEvent) => {
      if (actionMenuId && !(event.target as HTMLElement).closest(".accounting-action-menu")) setActionMenuId(null);
    };
    window.addEventListener("click", closeMenu);
    return () => window.removeEventListener("click", closeMenu);
  }, [actionMenuId]);

  const { transactions, metrics, activities, profile } = accountingState;
  const initials = useMemo(() => profileInitials(profile.fullName), [profile.fullName]);
  const expenseGradient = useMemo(() => {
    let cursor = 0;
    const stops = metrics.expenseBreakdown.map((item) => {
      const next = Math.min(100, cursor + Math.max(0, item.percentage));
      const stop = `${item.color} ${cursor}% ${next}%`;
      cursor = next;
      return stop;
    });
    return `conic-gradient(${stops.join(", ") || "#0F172A 0 100%"})`;
  }, [metrics.expenseBreakdown]);
  const filteredTransactions = useMemo(() => {
    const query = (tableSearch || searchQuery).trim().toLowerCase();
    return transactions.filter((transaction) => {
      if (typeFilter !== "All" && transaction.type !== typeFilter) return false;
      if (statusFilter !== "All" && transaction.status !== statusFilter) return false;
      if (!query) return true;
      return [transaction.description, transaction.reference, transaction.counterparty, transaction.account, transaction.category]
        .some((value) => value.toLowerCase().includes(query));
    });
  }, [transactions, typeFilter, statusFilter, tableSearch, searchQuery]);
  const totalPages = Math.max(1, Math.ceil(filteredTransactions.length / itemsPerPage));
  const activePage = Math.min(currentPage, totalPages);
  const paginatedTransactions = useMemo(
    () => filteredTransactions.slice((activePage - 1) * itemsPerPage, activePage * itemsPerPage),
    [filteredTransactions, activePage, itemsPerPage]
  );

  const focusTransactions = (query = "") => {
    setTableSearch(query);
    setTypeFilter("All");
    setStatusFilter("All");
    setCurrentPage(1);
    transactionTableRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const exportTransactions = () => {
    const blob = new Blob([accountingStore.exportTransactionsCsv()], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `kpm_accounting_transactions_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const saveTransaction = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!newTransaction.description.trim() || Number(newTransaction.amount) <= 0) return;
    const created = accountingStore.createTransaction({
      description: newTransaction.description.trim(),
      reference: newTransaction.reference.trim() || "—",
      counterparty: newTransaction.counterparty.trim() || "—",
      category: newTransaction.category,
      account: newTransaction.account,
      type: newTransaction.type,
      amount: Number(newTransaction.amount),
      status: newTransaction.status,
    });
    try {
      await createAccountingTransaction({
        id: created.id,
        transaction_date: new Date(created.timestamp).toISOString(),
        description: created.description,
        reference: created.reference,
        counterparty: created.counterparty,
        category: created.category,
        account: created.account,
        transaction_type: created.type,
        amount: created.amount,
        status: created.status,
      });
      accountingStore.markTransactionSynced(created.id);
    } catch {
      void accountingStore.syncFromBackend(true);
    }
    setIsCreateOpen(false);
    setNewTransaction({ description: "", reference: "", counterparty: "", category: "Sales Revenue", account: "Accounts Receivable", type: "Income", amount: 0, status: "Cleared" });
  };

  const setTransactionStatus = async (transaction: AccountingTransaction, status: TransactionStatus) => {
    accountingStore.updateTransaction(transaction.id, { status });
    setActionMenuId(null);
    try {
      await updateAccountingTransaction(transaction.id, { status });
      accountingStore.markTransactionSynced(transaction.id);
    } catch {
      try {
        await createAccountingTransaction({
          id: transaction.id,
          transaction_date: new Date(transaction.timestamp).toISOString(),
          description: transaction.description,
          reference: transaction.reference,
          counterparty: transaction.counterparty,
          category: transaction.category,
          account: transaction.account,
          transaction_type: transaction.type,
          amount: transaction.amount,
          status,
        });
        accountingStore.markTransactionSynced(transaction.id);
      } catch {
        void accountingStore.syncFromBackend(true);
      }
    }
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

  const accountIcon = (type: string) => {
    const Icon = type === "wallet" ? WalletCards : type === "receipt" ? ReceiptText : type === "box" ? Package : type === "file" ? FileText : Landmark;
    return <Icon className="w-3.5 h-3.5" />;
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] flex font-sans antialiased selection:bg-[#0F172A] selection:text-white">
      <aside className="w-64 bg-white border-r border-slate-200/80 p-5 flex flex-col justify-between hidden md:flex flex-shrink-0">
        <div className="space-y-6">
          <Link href="/dashboard" className="block px-2">
            <div className="flex items-center space-x-2.5">
              <svg width="26" height="26" viewBox="0 0 32 32" fill="none"><rect x="4" y="4" width="10" height="10" rx="3" fill="#3B82F6" /><rect x="18" y="4" width="10" height="10" rx="3" fill="#60A5FA" /><rect x="4" y="18" width="10" height="10" rx="3" fill="#2563EB" /><rect x="18" y="18" width="10" height="10" rx="3" fill="#1D4ED8" /></svg>
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
            ].map((item) => {
              const Icon = item.icon;
              return <Link key={item.name} href={item.href} className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50"><span className="flex items-center gap-3"><Icon className="w-4 h-4 text-slate-500" />{item.name}</span>{item.arrow && <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}</Link>;
            })}
            <div className="rounded-xl bg-[#0F172A] text-white overflow-hidden shadow-sm">
              <div className="flex items-center justify-between px-3.5 py-2.5 text-xs font-semibold"><span className="flex items-center gap-3"><FileText className="w-4 h-4" />Accounting</span><ChevronDown className="w-3.5 h-3.5" /></div>
              <div className="bg-slate-50 text-slate-600 px-3.5 py-1.5 space-y-1.5 text-[11px] font-medium">
                <button onClick={() => focusTransactions()} className="block text-slate-900 font-semibold cursor-pointer">Overview</button>
                <button onClick={() => focusTransactions()} className="block cursor-pointer">Transactions</button>
                <button onClick={() => setIsProfileOpen(true)} className="block cursor-pointer">General Ledger</button>
                <button onClick={() => setStatusFilter("Pending")} className="block cursor-pointer">Reconciliation</button>
                <button onClick={() => setTypeFilter("Expense")} className="block cursor-pointer">Accounts Payable</button>
                <button onClick={() => setTypeFilter("Income")} className="block cursor-pointer">Accounts Receivable</button>
                <button onClick={exportTransactions} className="block cursor-pointer">Tax & Compliance</button>
              </div>
            </div>
            {[
              { name: "AI Insights", icon: Sparkles, href: "/insights" }, { name: "Suppliers", icon: Users }, { name: "Customers", icon: UserRound }, { name: "Reports", icon: FileBarChart }, { name: "Settings", icon: Settings },
            ].map(({ name, icon: Icon, href }) => href ? <Link key={name} href={href} className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50"><span className="flex items-center gap-3"><Icon className="w-4 h-4 text-slate-500" />{name}</span><ChevronRight className="w-3.5 h-3.5 text-slate-400" /></Link> : <button key={name} onClick={() => name === "Settings" ? setIsProfileOpen(true) : undefined} className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"><span className="flex items-center gap-3"><Icon className="w-4 h-4 text-slate-500" />{name}</span><ChevronRight className="w-3.5 h-3.5 text-slate-400" /></button>)}
          </nav>
        </div>
        <div className="space-y-3 pt-4">
          <button onClick={() => setIsProfileOpen(true)} className="text-left rounded-2xl bg-gradient-to-br from-blue-50 to-slate-50 border border-slate-200/70 p-3.5 space-y-2.5 w-full cursor-pointer">
            <div className="flex items-center gap-2"><Sparkles className="w-4 h-4 text-blue-600" /><span className="text-xs font-bold">Automate Your Accounting</span></div>
            <p className="text-[10.5px] text-slate-500 leading-snug">Let KPM handle reconciliations, catch errors, and keep your books accurate.</p>
            <span className="inline-flex items-center gap-1 bg-[#0F172A] text-white text-[10px] font-semibold px-3 py-1.5 rounded-lg">Enable AI Assistant <ArrowRight className="w-3 h-3" /></span>
          </button>
          <button onClick={() => setIsProfileOpen(true)} className="w-full rounded-xl border border-slate-200 p-2.5 flex items-center justify-between text-left cursor-pointer"><span className="flex gap-2.5 items-center"><span className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center"><Building2 className="w-3.5 h-3.5" /></span><span><span className="block text-xs font-bold leading-tight">{profile.organization}</span><span className="block text-[10px] text-slate-400">Enterprise Plan</span></span></span><ChevronDown className="w-3.5 h-3.5 text-slate-400" /></button>
        </div>
      </aside>

      <div className="flex-1 min-w-0">
        <header className="bg-white border-b border-slate-200/80 px-5 sm:px-8 py-3.5 flex items-center justify-between sticky top-0 z-30">
          <div className="relative w-full max-w-xl"><Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" /><input value={searchQuery} onChange={(event) => { setSearchQuery(event.target.value); setCurrentPage(1); }} placeholder="Search transactions, accounts, invoices, or anything..." className="w-full pl-10 pr-10 py-2 bg-slate-50 border border-slate-200/80 rounded-full text-xs outline-none focus:bg-white focus:border-blue-400" /><span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">⌘ K</span></div>
          <div className="flex items-center gap-4 pl-4"><button onClick={() => setIsProfileOpen(true)} className="relative w-9 h-9 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center cursor-pointer"><Bell className="w-4 h-4" />{profile.notificationsEnabled && activities.length > 0 && <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full ring-2 ring-white" />}</button><button onClick={() => setIsProfileOpen(true)} className="flex items-center gap-2.5 text-left cursor-pointer"><span className="w-9 h-9 rounded-full bg-slate-800 text-white text-xs font-bold flex items-center justify-center">{initials}</span><span className="hidden sm:block"><span className="block text-xs font-bold leading-tight">{profile.fullName}</span><span className="block text-[10px] text-slate-400">{profile.role}</span></span><ChevronDown className="w-3.5 h-3.5 text-slate-400" /></button></div>
        </header>

        <main className="p-4 sm:p-6 lg:p-8 space-y-4 max-w-[1600px] mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div><h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Accounting</h1><p className="text-xs text-slate-500 mt-1">Manage your finances, track transactions, and keep your books in perfect balance — all in one place.</p></div>
            <div className="flex items-center gap-2.5"><button onClick={() => focusTransactions()} className="inline-flex items-center gap-2 bg-white border border-slate-200 text-xs font-semibold px-3.5 py-2 rounded-xl shadow-2xs cursor-pointer"><Calendar className="w-3.5 h-3.5" />Apr 1, 2025 – Apr 30, 2025<ChevronDown className="w-3 h-3 text-slate-400" /></button><button onClick={() => setIsCreateOpen(true)} className="inline-flex items-center gap-2 bg-[#0F172A] text-white text-xs font-semibold px-4 py-2 rounded-xl shadow-2xs cursor-pointer"><Plus className="w-3.5 h-3.5" />New Transaction<ChevronDown className="w-3 h-3 ml-8" /></button></div>
          </div>

          <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3.5">
            {[
              { label: "Total Revenue", value: metrics.totalRevenue, icon: Landmark, change: "12%", tone: "text-emerald-600" },
              { label: "Total Expenses", value: metrics.totalExpenses, icon: ReceiptText, change: "6%", tone: "text-rose-500" },
              { label: "Net Profit", value: metrics.netProfit, icon: Tags, change: "18%", tone: "text-emerald-600" },
              { label: "Cash Balance", value: metrics.cashBalance, icon: WalletCards, change: "9%", tone: "text-emerald-600" },
              { label: "Outstanding Invoices", value: metrics.outstandingInvoices, icon: FileText, change: "4%", tone: "text-rose-500" },
            ].map(({ label, value, icon: Icon, change, tone }) => <div key={label} className="rounded-2xl bg-white border border-slate-200/80 p-4 shadow-card-subtle relative overflow-hidden"><div className="flex justify-between"><span className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700"><Icon className="w-4 h-4" /></span><svg className="w-16 h-8" viewBox="0 0 64 30"><path d="M 0 25 Q 12 16, 22 20 T 39 10 T 64 3" fill="none" stroke="#6385FF" strokeWidth="1.7" /></svg></div><div className="mt-3"><div className="text-[11px] font-medium text-slate-500">{label}</div><div className="text-xl font-extrabold mt-1">{formatCurrency(value)}</div><div className={`text-[10px] font-semibold mt-1 ${tone}`}>↑ {change} <span className="text-slate-400 font-normal ml-1">vs. last month</span></div></div></div>)}
          </section>

          <section className="grid grid-cols-1 xl:grid-cols-12 gap-3.5">
            <div className="xl:col-span-6 rounded-2xl bg-white border border-slate-200/80 p-4 shadow-card-subtle"><div className="flex items-start justify-between border-b border-slate-100 pb-3"><div><h2 className="text-sm font-bold">Financial Overview</h2><p className="text-[10.5px] text-slate-400 mt-1">Income, expenses and profit for the selected period.</p></div><button className="text-[10px] font-semibold border border-slate-200 rounded-lg px-3 py-1.5 cursor-pointer">This Month <ChevronDown className="w-3 h-3 inline ml-3" /></button></div><div className="flex justify-end gap-3 text-[10px] text-slate-500 pt-3"><span>● Revenue</span><span className="text-slate-300">● Expenses</span><span className="text-blue-500">● Profit</span></div><div className="h-42 pt-1"><svg className="w-full h-full" viewBox="0 0 560 165" preserveAspectRatio="none"><defs><linearGradient id="accountRevenue" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#0F172A" stopOpacity=".16" /><stop offset="1" stopColor="#0F172A" stopOpacity="0" /></linearGradient></defs>{[0, 30, 60, 90, 120, 150].map((y) => <line key={y} x1="0" x2="560" y1={y} y2={y} stroke="#E8EEF7" />)}<path d="M0 128 C40 115,56 132,88 112 S142 113,172 93 S230 88,260 79 S318 100,350 70 S402 65,432 51 S480 70,510 34 S540 32,560 18 L560 150 L0 150 Z" fill="url(#accountRevenue)" /><path d="M0 128 C40 115,56 132,88 112 S142 113,172 93 S230 88,260 79 S318 100,350 70 S402 65,432 51 S480 70,510 34 S540 32,560 18" fill="none" stroke="#0F172A" strokeWidth="2" /><path d="M0 148 C50 138,72 142,110 129 S170 130,205 112 S265 115,300 100 S350 105,386 83 S445 88,480 64 S525 72,560 50" fill="none" stroke="#D8E0EC" strokeWidth="2" /><path d="M0 158 C44 148,72 154,110 143 S170 147,205 132 S270 139,305 123 S365 129,400 105 S445 113,480 91 S525 98,560 82" fill="none" stroke="#6684FF" strokeWidth="2" /></svg></div><div className="flex justify-between text-[9px] text-slate-400 px-2"><span>Apr 1</span><span>Apr 5</span><span>Apr 10</span><span>Apr 15</span><span>Apr 20</span><span>Apr 25</span><span>Apr 30</span></div></div>
            <div className="xl:col-span-4 rounded-2xl bg-white border border-slate-200/80 p-4 shadow-card-subtle"><h2 className="text-sm font-bold">Expense Breakdown</h2><div className="flex items-center gap-5 pt-6"><div className="relative w-36 h-36 rounded-full" style={{ background: expenseGradient }}><div className="absolute inset-5 bg-white rounded-full flex flex-col items-center justify-center"><b className="text-sm">{formatCurrency(metrics.totalExpenses)}</b><span className="text-[8px] text-slate-400">Total Expenses</span></div></div><div className="space-y-2.5 flex-1">{metrics.expenseBreakdown.map((item) => <div key={item.name} className="flex items-center justify-between text-[10px]"><span className="flex items-center gap-2 text-slate-600"><i className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />{item.name}</span><span className="font-semibold text-slate-500">{item.percentage}% &nbsp; {formatCurrency(item.amount)}</span></div>)}</div></div></div>
            <div className="xl:col-span-2 rounded-2xl bg-white border border-slate-200/80 p-4 shadow-card-subtle"><h2 className="text-sm font-bold mb-3">Quick Actions</h2><div className="space-y-2">{[{ label: "Record a Transaction", action: () => setIsCreateOpen(true), icon: ReceiptText }, { label: "Reconcile Bank Accounts", action: () => { setStatusFilter("Pending"); focusTransactions(); }, icon: WalletCards }, { label: "Generate Report", action: exportTransactions, icon: FileBarChart }, { label: "Manage Accounts", action: () => setIsProfileOpen(true), icon: Settings }, { label: "View Tax Summary", action: exportTransactions, icon: FileText }].map(({ label, action, icon: Icon }) => <button key={label} onClick={action} className="w-full flex items-center justify-between border border-slate-200/80 rounded-xl px-2.5 py-2.5 text-[10px] font-semibold hover:bg-slate-50 cursor-pointer"><span className="flex items-center gap-2"><span className="w-6 h-6 rounded-lg bg-slate-100 flex items-center justify-center"><Icon className="w-3.5 h-3.5" /></span>{label}</span><ChevronRight className="w-3 h-3" /></button>)}</div></div>
          </section>

          <section className="grid grid-cols-1 xl:grid-cols-12 gap-3.5">
            <div ref={transactionTableRef} className="xl:col-span-9 rounded-2xl bg-white border border-slate-200/80 p-4 shadow-card-subtle"><div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100"><div><h2 className="text-sm font-bold">Recent Transactions</h2><p className="text-[10.5px] text-slate-400 mt-1">Latest accounting transactions across all accounts.</p></div><div className="flex gap-2"><div className="relative w-64"><Search className="w-3.5 h-3.5 text-slate-400 absolute top-1/2 left-3 -translate-y-1/2" /><input value={tableSearch} onChange={(event) => { setTableSearch(event.target.value); setCurrentPage(1); }} placeholder="Search by description, reference, or account..." className="w-full pl-8 pr-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-[10px] outline-none focus:bg-white" /></div><button onClick={() => setIsFilterOpen(true)} className="px-3 py-2 border border-slate-200 rounded-xl text-[10px] font-semibold flex gap-1.5 items-center cursor-pointer"><SlidersHorizontal className="w-3.5 h-3.5" />Filter</button></div></div><div className="overflow-x-auto"><table className="w-full min-w-[870px] text-[10px]"><thead className="text-slate-500"><tr className="border-b border-slate-100"><th className="py-3 px-1 text-left"><input type="checkbox" onChange={(event) => setSelectedIds(event.target.checked ? new Set(paginatedTransactions.map((transaction) => transaction.id)) : new Set())} /></th>{["Date", "Description", "Category", "Account", "Type", "Amount", "Status", "Actions"].map((heading) => <th key={heading} className="py-3 px-2 text-left font-medium">{heading}</th>)}</tr></thead><tbody>{paginatedTransactions.map((transaction) => <tr key={transaction.id} className="border-b border-slate-100 last:border-0"><td className="py-3 px-1"><input type="checkbox" checked={selectedIds.has(transaction.id)} onChange={() => setSelectedIds((ids) => { const next = new Set(ids); next.has(transaction.id) ? next.delete(transaction.id) : next.add(transaction.id); return next; })} /></td><td className="py-3 px-2 text-slate-600 whitespace-nowrap">{transaction.date}</td><td className="py-3 px-2"><div className="flex gap-2 items-center"><span className="w-6 h-6 rounded-lg bg-slate-100 flex items-center justify-center"><ReceiptText className="w-3 h-3" /></span><span><b className="block text-slate-800">{transaction.description}</b><span className="text-slate-400">From: {transaction.counterparty}</span></span></div></td><td className="py-3 px-2 text-slate-500">{transaction.category}</td><td className="py-3 px-2 text-slate-500">{transaction.account}</td><td className="py-3 px-2"><TypePill type={transaction.type} /></td><td className={`py-3 px-2 font-semibold ${transaction.type === "Income" ? "text-slate-800" : "text-slate-600"}`}>{transaction.type === "Income" ? "+" : "-"}{formatCurrency(transaction.amount)}</td><td className="py-3 px-2"><StatusPill status={transaction.status} /></td><td className="py-3 px-2 relative accounting-action-menu"><button onClick={(event) => { event.stopPropagation(); setActionMenuId(actionMenuId === transaction.id ? null : transaction.id); }} className="p-1 text-slate-500 hover:bg-slate-100 rounded cursor-pointer"><MoreHorizontal className="w-4 h-4" /></button>{actionMenuId === transaction.id && <div className="absolute right-2 top-8 z-20 w-36 bg-white border border-slate-200 shadow-xl rounded-xl p-1 text-left"><button onClick={() => setTransactionStatus(transaction, transaction.status === "Cleared" ? "Pending" : "Cleared")} className="w-full px-2.5 py-2 rounded-lg hover:bg-slate-50 text-[10px] font-semibold">Mark as {transaction.status === "Cleared" ? "Pending" : "Cleared"}</button><button onClick={() => focusTransactions(transaction.reference)} className="w-full px-2.5 py-2 rounded-lg hover:bg-slate-50 text-[10px] font-semibold">View transaction</button></div>}</td></tr>)}</tbody></table></div><div className="flex items-center justify-between pt-3 text-[10px] text-slate-500"><span>Showing {filteredTransactions.length ? (activePage - 1) * itemsPerPage + 1 : 0}-{Math.min(activePage * itemsPerPage, filteredTransactions.length)} of {filteredTransactions.length} transactions</span><div className="flex items-center gap-1"><button onClick={() => setCurrentPage((page) => Math.max(1, page - 1))} className="w-6 h-6 border border-slate-200 rounded-lg cursor-pointer">‹</button>{[1, 2, 3, 4, 5].map((page) => <button key={page} disabled={page > totalPages} onClick={() => setCurrentPage(page)} className={`w-6 h-6 rounded-lg cursor-pointer disabled:opacity-30 ${activePage === page ? "bg-[#0F172A] text-white" : "border border-slate-200"}`}>{page}</button>)}<span>…</span><button onClick={() => setCurrentPage(totalPages)} className="w-6 h-6 border border-slate-200 rounded-lg cursor-pointer">{totalPages}</button><button onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))} className="w-6 h-6 border border-slate-200 rounded-lg cursor-pointer">›</button></div></div></div>
            <div className="xl:col-span-3 space-y-3.5"><div className="rounded-2xl bg-white border border-slate-200/80 p-4 shadow-card-subtle"><div className="flex justify-between border-b border-slate-100 pb-3"><h2 className="text-sm font-bold">Account Balances</h2><button onClick={() => setIsProfileOpen(true)} className="text-[10px] text-blue-600 font-semibold cursor-pointer">View all <ArrowRight className="w-3 h-3 inline" /></button></div><div className="pt-2">{metrics.accountBalances.map((balance) => <button key={balance.name} onClick={() => focusTransactions(balance.name)} className="w-full flex items-center justify-between py-2 text-[10px] hover:bg-slate-50 rounded-lg cursor-pointer"><span className="flex items-center gap-2.5 text-slate-700"><span className="w-6 h-6 rounded-lg bg-slate-100 flex items-center justify-center">{accountIcon(balance.icon)}</span>{balance.name}</span><span className="font-bold">{formatCurrency(balance.amount)} <ChevronRight className="w-3 h-3 inline text-slate-400" /></span></button>)}</div></div><div className="rounded-2xl bg-white border border-slate-200/80 p-4 shadow-card-subtle"><div className="flex justify-between border-b border-slate-100 pb-3"><h2 className="text-sm font-bold">Recent Activity</h2><button onClick={() => focusTransactions()} className="text-[10px] text-blue-600 font-semibold cursor-pointer">View all <ArrowRight className="w-3 h-3 inline" /></button></div><div className="pt-3 space-y-3">{activities.slice(0, 4).map((activity) => <button key={activity.id} onClick={() => focusTransactions()} className="w-full text-left flex gap-2.5 cursor-pointer"><span className="relative"><span className={`w-5 h-5 mt-0.5 rounded-full flex items-center justify-center ${activity.tone === "income" ? "bg-blue-100 text-blue-600" : activity.tone === "expense" ? "bg-rose-100 text-rose-600" : "bg-slate-100 text-slate-600"}`}>•</span></span><span><b className="block text-[10px] text-slate-700">{activity.title}</b><span className="block text-[9px] text-slate-400 mt-0.5">{activity.subtitle}</span></span></button>)}</div></div></div>
          </section>
        </main>
      </div>

      {isCreateOpen && <div className="fixed inset-0 z-50 bg-slate-900/45 backdrop-blur-xs flex items-center justify-center p-4"><div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 p-6 text-xs"><div className="flex justify-between items-center border-b border-slate-100 pb-3"><h2 className="font-bold text-base">New Transaction</h2><button onClick={() => setIsCreateOpen(false)} className="text-slate-400 cursor-pointer"><X className="w-4 h-4" /></button></div><form onSubmit={saveTransaction} className="space-y-3 pt-4"><label className="block font-semibold text-slate-700">Description<input required value={newTransaction.description} onChange={(event) => setNewTransaction({ ...newTransaction, description: event.target.value })} className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-xl outline-none focus:border-blue-400" /></label><div className="grid grid-cols-2 gap-3"><label className="font-semibold text-slate-700">Reference<input value={newTransaction.reference} onChange={(event) => setNewTransaction({ ...newTransaction, reference: event.target.value })} className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-xl outline-none" /></label><label className="font-semibold text-slate-700">Amount ($)<input required min="0.01" step="0.01" type="number" value={newTransaction.amount || ""} onChange={(event) => setNewTransaction({ ...newTransaction, amount: Number(event.target.value) })} className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-xl outline-none" /></label></div><label className="block font-semibold text-slate-700">Counterparty<input value={newTransaction.counterparty} onChange={(event) => setNewTransaction({ ...newTransaction, counterparty: event.target.value })} className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-xl outline-none" /></label><div className="grid grid-cols-2 gap-3"><label className="font-semibold text-slate-700">Type<select value={newTransaction.type} onChange={(event) => setNewTransaction({ ...newTransaction, type: event.target.value as TransactionType })} className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-xl bg-white"><option>Income</option><option>Expense</option><option>Transfer</option></select></label><label className="font-semibold text-slate-700">Status<select value={newTransaction.status} onChange={(event) => setNewTransaction({ ...newTransaction, status: event.target.value as TransactionStatus })} className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-xl bg-white"><option>Cleared</option><option>Pending</option></select></label></div><div className="grid grid-cols-2 gap-3"><label className="font-semibold text-slate-700">Category<input value={newTransaction.category} onChange={(event) => setNewTransaction({ ...newTransaction, category: event.target.value })} className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-xl" /></label><label className="font-semibold text-slate-700">Account<input value={newTransaction.account} onChange={(event) => setNewTransaction({ ...newTransaction, account: event.target.value })} className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-xl" /></label></div><div className="flex justify-end gap-2 pt-2"><button type="button" onClick={() => setIsCreateOpen(false)} className="px-4 py-2 border border-slate-200 rounded-xl font-semibold text-slate-600 cursor-pointer">Cancel</button><button className="px-5 py-2 bg-[#0F172A] text-white rounded-xl font-semibold cursor-pointer">Save Transaction</button></div></form></div></div>}

      {isFilterOpen && <div className="fixed inset-0 z-50 bg-slate-900/45 backdrop-blur-xs flex items-center justify-center p-4"><div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl border border-slate-200 p-5 text-xs space-y-4"><div className="flex justify-between border-b border-slate-100 pb-3"><h2 className="font-bold text-sm">Filter Transactions</h2><button onClick={() => setIsFilterOpen(false)} className="text-slate-400 cursor-pointer"><X className="w-4 h-4" /></button></div><label className="block font-semibold">Transaction type<select value={typeFilter} onChange={(event) => { setTypeFilter(event.target.value as "All" | TransactionType); setCurrentPage(1); }} className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-xl bg-white"><option>All</option><option>Income</option><option>Expense</option><option>Transfer</option></select></label><label className="block font-semibold">Status<select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value as "All" | TransactionStatus); setCurrentPage(1); }} className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-xl bg-white"><option>All</option><option>Cleared</option><option>Pending</option></select></label><div className="flex justify-end"><button onClick={() => setIsFilterOpen(false)} className="px-4 py-2 bg-[#0F172A] text-white rounded-xl font-semibold cursor-pointer">Apply Filters</button></div></div></div>}

      {isProfileOpen && <div className="fixed inset-0 z-50 bg-slate-900/45 backdrop-blur-xs flex items-center justify-center p-4"><div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 p-6 text-xs"><div className="flex justify-between border-b border-slate-100 pb-3"><div><h2 className="font-bold text-base">Account Settings</h2><p className="text-slate-400 mt-0.5">Profile and automation preferences</p></div><button onClick={() => setIsProfileOpen(false)} className="text-slate-400 cursor-pointer"><X className="w-4 h-4" /></button></div><form onSubmit={saveProfile} className="space-y-3 pt-4"><label className="block font-semibold">Full name<input value={profileForm.fullName} onChange={(event) => setProfileForm({ ...profileForm, fullName: event.target.value })} className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-xl" /></label><div className="grid grid-cols-2 gap-3"><label className="font-semibold">Role<input value={profileForm.role} onChange={(event) => setProfileForm({ ...profileForm, role: event.target.value })} className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-xl" /></label><label className="font-semibold">Organization<input value={profileForm.organization} onChange={(event) => setProfileForm({ ...profileForm, organization: event.target.value })} className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-xl" /></label></div><label className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-3 font-semibold">Auto-reconciliation<input type="checkbox" checked={profileForm.autoReconciliation} onChange={(event) => setProfileForm({ ...profileForm, autoReconciliation: event.target.checked })} /></label><label className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-3 font-semibold">Sales and payment notifications<input type="checkbox" checked={profileForm.notificationsEnabled} onChange={(event) => setProfileForm({ ...profileForm, notificationsEnabled: event.target.checked })} /></label><div className="flex justify-end gap-2 pt-2"><button type="button" onClick={() => setIsProfileOpen(false)} className="px-4 py-2 border border-slate-200 rounded-xl font-semibold text-slate-600 cursor-pointer">Cancel</button><button className="px-5 py-2 bg-[#0F172A] text-white rounded-xl font-semibold cursor-pointer">Save Settings</button></div></form></div></div>}
    </div>
  );
}
