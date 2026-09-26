"use client";

import React, { startTransition, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  ChevronRight,
  FileBarChart,
  FileText,
  Landmark,
  MoreHorizontal,
  Package,
  Plus,
  Upload,
  ReceiptText,
  Search,
  Settings,
  SlidersHorizontal,
  WalletCards,
  X,
} from "lucide-react";
import { MlSuggestionsPanel } from "@/components/MlSuggestionsPanel";
import {
  accountingStore,
  AccountingState,
  AccountingTransaction,
  TransactionStatus,
  TransactionType,
} from "@/lib/accountingStore";
import {
  createAccountingTransaction,
  importAccountingCsv,
  updateAccountingProfile,
  updateAccountingTransaction,
} from "@/lib/api";
import { AppShell } from "@/components/AppShell";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/Button";
import { MetricStrip } from "@/components/ui/MetricStrip";
import { PageHeader } from "@/components/ui/PageHeader";
import { Pager } from "@/components/ui/Pager";

const formatCurrency = (amount: number) =>
  `$${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function StatusPill({ status }: { status: TransactionStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[13px] font-medium ${
        status === "Cleared"
          ? "bg-[var(--app-positive-bg)] text-[var(--app-positive)]"
          : "bg-[var(--app-warning-bg)] text-[var(--app-warning)]"
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          status === "Cleared" ? "bg-[var(--app-positive)]" : "bg-[var(--app-warning)]"
        }`}
      />
      {status}
    </span>
  );
}

function TypePill({ type }: { type: TransactionType }) {
  const styles =
    type === "Income"
      ? "bg-[var(--app-hover)] text-[var(--app-ink)]"
      : type === "Expense"
        ? "bg-[var(--app-critical-bg)] text-[var(--app-critical)]"
        : "bg-[var(--app-hover)] text-[var(--app-muted)]";
  return <span className={`inline-flex rounded-md px-2 py-0.5 text-[13px] font-medium ${styles}`}>{type}</span>;
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
  const csvInputRef = useRef<HTMLInputElement>(null);
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
    const params = new URLSearchParams(window.location.search);
    if (params.get("record") === "1") {
      setIsCreateOpen(true);
      window.history.replaceState({}, "", "/accounting");
    }
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

  const expenseGradient = useMemo(() => {
    let cursor = 0;
    const stops = metrics.expenseBreakdown.map((item) => {
      const next = Math.min(100, cursor + Math.max(0, item.percentage));
      const stop = `${item.color} ${cursor}% ${next}%`;
      cursor = next;
      return stop;
    });
    return `conic-gradient(${stops.join(", ") || "var(--app-ink) 0 100%"})`;
  }, [metrics.expenseBreakdown]);

  const filteredTransactions = useMemo(() => {
    const query = (tableSearch || searchQuery).trim().toLowerCase();
    return transactions.filter((transaction) => {
      if (typeFilter !== "All" && transaction.type !== typeFilter) return false;
      if (statusFilter !== "All" && transaction.status !== statusFilter) return false;
      if (!query) return true;
      return [transaction.description, transaction.reference, transaction.counterparty, transaction.account, transaction.category].some(
        (value) => value.toLowerCase().includes(query)
      );
    });
  }, [transactions, typeFilter, statusFilter, tableSearch, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredTransactions.length / itemsPerPage));
  const activePage = Math.min(currentPage, totalPages);
  const paginatedTransactions = useMemo(
    () => filteredTransactions.slice((activePage - 1) * itemsPerPage, activePage * itemsPerPage),
    [filteredTransactions, activePage, itemsPerPage]
  );

  const pendingCount = useMemo(
    () => transactions.filter((t) => t.status === "Pending").length,
    [transactions]
  );

  const focusTransactions = (query = "") => {
    setTableSearch(query);
    setTypeFilter("All");
    setStatusFilter("All");
    setCurrentPage(1);
    transactionTableRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const importBankCsv = async (file: File | null) => {
    if (!file) return;
    try {
      await importAccountingCsv(file);
      await accountingStore.syncFromBackend(true);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "CSV import failed");
    }
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
    setNewTransaction({
      description: "",
      reference: "",
      counterparty: "",
      category: "Sales Revenue",
      account: "Accounts Receivable",
      type: "Income",
      amount: 0,
      status: "Cleared",
    });
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
    const Icon =
      type === "wallet"
        ? WalletCards
        : type === "receipt"
          ? ReceiptText
          : type === "box"
            ? Package
            : type === "file"
              ? FileText
              : Landmark;
    return <Icon className="h-3.5 w-3.5" />;
  };

  const shellNotifications = useMemo(
    () =>
      profile.notificationsEnabled
        ? activities.slice(0, 5).map((item) => ({
            id: item.id,
            title: item.title,
            subtitle: item.subtitle,
            time: item.time,
          }))
        : [],
    [profile.notificationsEnabled, activities]
  );

  const metricCards = [
    { label: "Total revenue", value: metrics.totalRevenue, hint: `${transactions.length} transactions` },
    { label: "Total expenses", value: metrics.totalExpenses, hint: metrics.expenseBreakdown[0]?.name || "All categories" },
    { label: "Net profit", value: metrics.netProfit, hint: metrics.totalRevenue > 0 ? `${((metrics.netProfit / metrics.totalRevenue) * 100).toFixed(1)}% margin` : "No revenue yet" },
    { label: "Cash balance", value: metrics.cashBalance, hint: profile.autoReconciliation ? "Auto-reconcile on" : "Manual review" },
    { label: "Outstanding", value: metrics.outstandingInvoices, hint: pendingCount > 0 ? `${pendingCount} pending` : "All cleared" },
  ];

  const quickActions = [
    { label: "Record a transaction", action: () => setIsCreateOpen(true), icon: ReceiptText },
    {
      label: "Reconcile pending",
      action: () => {
        setStatusFilter("Pending");
        focusTransactions();
      },
      icon: WalletCards,
    },
    { label: "Import bank CSV", action: () => csvInputRef.current?.click(), icon: Upload },
    { label: "Export CSV", action: exportTransactions, icon: FileBarChart },
    { label: "Account settings", action: () => setIsProfileOpen(true), icon: Settings },
  ];

  return (
    <AppShell
      searchPlaceholder="Search transactions, accounts, invoices…"
      searchValue={searchQuery}
      onSearchChange={(value) => {
        setSearchQuery(value);
        setCurrentPage(1);
      }}
      notifications={shellNotifications}
      onNotificationClick={() => focusTransactions()}
      maxWidthClassName="max-w-[1360px]"
    >
      <div className="space-y-4">
        <PageHeader
          title="Accounting"
          description={
            pendingCount > 0
              ? `${pendingCount} ${pendingCount === 1 ? "transaction needs" : "transactions need"} review.`
              : `Balances and reconciliation for ${profile.organization || "your workspace"}.`
          }
          actions={
            <>
              <Button variant="secondary" size="sm" onClick={() => csvInputRef.current?.click()}>
                <Upload className="h-3.5 w-3.5" /> Import CSV
              </Button>
              <Button size="sm" onClick={() => setIsCreateOpen(true)}>
                <Plus className="h-3.5 w-3.5" /> New transaction
              </Button>
            </>
          }
        />

        <MetricStrip
          columns={5}
          items={metricCards.map(({ label, value, hint }) => ({
            label,
            value: formatCurrency(value),
            hint,
          }))}
        />

        <MlSuggestionsPanel title="Match suggestions" kindFilter="reconcile" />

        <section className="grid grid-cols-1 gap-3.5 xl:grid-cols-12">
          <div className="rounded-[var(--app-radius)] border border-[var(--app-border)] bg-[var(--app-surface)] p-4 xl:col-span-5">
            <h2 className="text-sm font-semibold text-[var(--app-ink)]">Expense breakdown</h2>
            <div className="flex items-center gap-5 pt-6">
              <div className="relative h-36 w-36 rounded-full" style={{ background: expenseGradient }}>
                <div className="absolute inset-5 flex flex-col items-center justify-center rounded-full bg-[var(--app-surface)]">
                  <b className="text-sm tabular-nums">{formatCurrency(metrics.totalExpenses)}</b>
                  <span className="text-[8px] text-[var(--app-faint)]">Total expenses</span>
                </div>
              </div>
              <div className="flex-1 space-y-2.5">
                {metrics.expenseBreakdown.length === 0 ? (
                  <p className="text-xs text-[var(--app-faint)]">No expense categories yet.</p>
                ) : (
                  metrics.expenseBreakdown.map((item) => (
                    <div key={item.name} className="flex items-center justify-between text-[13px]">
                      <span className="flex items-center gap-2 text-[var(--app-muted)]">
                        <i className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                        {item.name}
                      </span>
                      <span className="font-medium text-[var(--app-muted)]">
                        {item.percentage}% · {formatCurrency(item.amount)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="rounded-[var(--app-radius)] border border-[var(--app-border)] bg-[var(--app-surface)] p-4 xl:col-span-4">
            <h2 className="mb-3 text-sm font-semibold text-[var(--app-ink)]">Summary</h2>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-[var(--app-muted)]">Revenue</dt>
                <dd className="font-semibold tabular-nums text-[var(--app-ink)]">{formatCurrency(metrics.totalRevenue)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-[var(--app-muted)]">Expenses</dt>
                <dd className="font-semibold tabular-nums text-[var(--app-ink)]">{formatCurrency(metrics.totalExpenses)}</dd>
              </div>
              <div className="flex justify-between gap-3 border-t border-[var(--app-border)] pt-3">
                <dt className="text-[var(--app-muted)]">Net profit</dt>
                <dd className="font-semibold tabular-nums text-[var(--app-ink)]">{formatCurrency(metrics.netProfit)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-[var(--app-muted)]">Cash</dt>
                <dd className="font-semibold tabular-nums text-[var(--app-ink)]">{formatCurrency(metrics.cashBalance)}</dd>
              </div>
            </dl>
          </div>

          <div className="rounded-[var(--app-radius)] border border-[var(--app-border)] bg-[var(--app-surface)] p-4 xl:col-span-3">
            <h2 className="mb-3 text-sm font-semibold text-[var(--app-ink)]">Quick actions</h2>
            <div className="space-y-2">
              {quickActions.map(({ label, action, icon: Icon }) => (
                <button
                  key={label}
                  type="button"
                  onClick={action}
                  className="flex w-full cursor-pointer items-center justify-between rounded-[var(--app-radius-control)] border border-[var(--app-border)] px-2.5 py-2.5 text-[13px] font-medium hover:bg-[var(--app-hover)]"
                >
                  <span className="flex items-center gap-2 text-[var(--app-ink)]">
                    <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[var(--app-hover)]">
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    {label}
                  </span>
                  <ChevronRight className="h-3 w-3 text-[var(--app-faint)]" />
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-3.5 xl:grid-cols-12">
          <div
            ref={transactionTableRef}
            className="rounded-[var(--app-radius)] border border-[var(--app-border)] bg-[var(--app-surface)] p-4 xl:col-span-9"
          >
            <div className="flex flex-col justify-between gap-3 border-b border-[var(--app-border)] pb-3 sm:flex-row sm:items-center">
              <div>
                <h2 className="text-sm font-semibold text-[var(--app-ink)]">Recent transactions</h2>
                <p className="mt-1 text-[13px] text-[var(--app-faint)]">Latest entries across all accounts.</p>
              </div>
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                <div className="relative w-full sm:w-64">
                  <Search className="absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-[var(--app-faint)]" />
                  <input
                    value={tableSearch}
                    onChange={(event) => {
                      setTableSearch(event.target.value);
                      setCurrentPage(1);
                    }}
                    placeholder="Search description, reference, account…"
                    aria-label="Search transactions"
                    className="w-full rounded-[var(--app-radius-control)] border border-[var(--app-border)] bg-[var(--app-hover)] py-2 pr-3 pl-8 text-[13px] outline-none focus:border-[var(--app-ink)] focus:bg-[var(--app-surface)]"
                  />
                </div>
                <Button variant="secondary" size="sm" onClick={() => setIsFilterOpen(true)}>
                  <SlidersHorizontal className="h-3.5 w-3.5" /> Filter
                </Button>
              </div>
            </div>

            <div className="kpm-cards overflow-x-auto">
              <table className="w-full text-[13px] md:min-w-[870px]">
                <thead className="text-[var(--app-muted)]">
                  <tr className="border-b border-[var(--app-border)]">
                    <th className="px-1 py-3 text-left">
                      <input
                        type="checkbox"
                        onChange={(event) =>
                          setSelectedIds(
                            event.target.checked ? new Set(paginatedTransactions.map((transaction) => transaction.id)) : new Set()
                          )
                        }
                      />
                    </th>
                    {["Date", "Description", "Category", "Account", "Type", "Amount", "Status", "Actions"].map((heading) => (
                      <th key={heading} className="px-2 py-3 text-left font-medium">
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paginatedTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-2 py-6">
                        <EmptyState
                          title={transactions.length === 0 ? "No transactions yet" : "No matching transactions"}
                          description={
                            transactions.length === 0
                              ? "Record income or expenses — balances update from your database."
                              : "Try clearing search or filters."
                          }
                          action={
                            transactions.length === 0 ? (
                              <Button size="sm" onClick={() => setIsCreateOpen(true)}>
                                New transaction
                              </Button>
                            ) : null
                          }
                        />
                      </td>
                    </tr>
                  ) : (
                    paginatedTransactions.map((transaction) => (
                      <tr key={transaction.id} className="border-b border-[var(--app-border)] last:border-0">
                        <td data-label="Select" className="px-1 py-3">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(transaction.id)}
                            aria-label={`Select ${transaction.description}`}
                            onChange={() =>
                              setSelectedIds((ids) => {
                                const next = new Set(ids);
                                next.has(transaction.id) ? next.delete(transaction.id) : next.add(transaction.id);
                                return next;
                              })
                            }
                          />
                        </td>
                        <td data-label="Date" className="px-2 py-3 whitespace-nowrap text-[var(--app-muted)]">{transaction.date}</td>
                        <td data-label="Description" className="kpm-card-lead px-2 py-3">
                          <div className="flex items-center gap-2">
                            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[var(--app-hover)]">
                              <ReceiptText className="h-3 w-3" />
                            </span>
                            <span>
                              <b className="block text-[var(--app-ink)]">{transaction.description}</b>
                              <span className="text-[var(--app-faint)]">From: {transaction.counterparty}</span>
                            </span>
                          </div>
                        </td>
                        <td data-label="Category" className="px-2 py-3 text-[var(--app-muted)]">{transaction.category}</td>
                        <td data-label="Account" className="px-2 py-3 text-[var(--app-muted)]">{transaction.account}</td>
                        <td data-label="Type" className="px-2 py-3">
                          <TypePill type={transaction.type} />
                        </td>
                        <td data-label="Amount" className="px-2 py-3 font-semibold tabular-nums text-[var(--app-ink)]">
                          {transaction.type === "Income" ? "+" : "-"}
                          {formatCurrency(transaction.amount)}
                        </td>
                        <td data-label="Status" className="px-2 py-3">
                          <StatusPill status={transaction.status} />
                        </td>
                        <td data-label="Actions" className="accounting-action-menu relative px-2 py-3">
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              setActionMenuId(actionMenuId === transaction.id ? null : transaction.id);
                            }}
                            className="cursor-pointer rounded p-1 text-[var(--app-muted)] hover:bg-[var(--app-hover)]"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                          {actionMenuId === transaction.id && (
                            <div className="kpm-row-menu absolute top-8 right-2 z-50 w-36 rounded-[var(--app-radius)] border border-[var(--app-border)] bg-[var(--app-surface)] p-1 text-left shadow-[var(--app-shadow-pop)]">
                              <button
                                type="button"
                                onClick={() =>
                                  setTransactionStatus(transaction, transaction.status === "Cleared" ? "Pending" : "Cleared")
                                }
                                className="w-full rounded-md px-2.5 py-2 text-[13px] font-semibold hover:bg-[var(--app-hover)]"
                              >
                                Mark as {transaction.status === "Cleared" ? "Pending" : "Cleared"}
                              </button>
                              <button
                                type="button"
                                onClick={() => focusTransactions(transaction.reference)}
                                className="w-full rounded-md px-2.5 py-2 text-[13px] font-semibold hover:bg-[var(--app-hover)]"
                              >
                                View transaction
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <Pager
              page={activePage}
              totalPages={totalPages}
              onPage={setCurrentPage}
              summary={`Showing ${filteredTransactions.length ? (activePage - 1) * itemsPerPage + 1 : 0}–${Math.min(activePage * itemsPerPage, filteredTransactions.length)} of ${filteredTransactions.length} transactions`}
            />
          </div>

          <div className="space-y-3.5 xl:col-span-3">
            <div className="rounded-[var(--app-radius)] border border-[var(--app-border)] bg-[var(--app-surface)] p-4">
              <div className="flex justify-between border-b border-[var(--app-border)] pb-3">
                <h2 className="text-sm font-semibold text-[var(--app-ink)]">Account balances</h2>
                <button
                  type="button"
                  onClick={() => setIsProfileOpen(true)}
                  className="cursor-pointer text-[13px] font-medium text-[var(--app-muted)] hover:text-[var(--app-ink)]"
                >
                  Settings <ArrowRight className="inline h-3 w-3" />
                </button>
              </div>
              <div className="pt-2">
                {metrics.accountBalances.map((balance) => (
                  <button
                    key={balance.name}
                    type="button"
                    onClick={() => focusTransactions(balance.name)}
                    className="flex w-full cursor-pointer items-center justify-between rounded-md py-2 text-[13px] hover:bg-[var(--app-hover)]"
                  >
                    <span className="flex items-center gap-2.5 text-[var(--app-ink)]">
                      <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[var(--app-hover)]">
                        {accountIcon(balance.icon)}
                      </span>
                      {balance.name}
                    </span>
                    <span className="font-semibold tabular-nums">
                      {formatCurrency(balance.amount)}{" "}
                      <ChevronRight className="inline h-3 w-3 text-[var(--app-faint)]" />
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-[var(--app-radius)] border border-[var(--app-border)] bg-[var(--app-surface)] p-4">
              <div className="flex justify-between border-b border-[var(--app-border)] pb-3">
                <h2 className="text-sm font-semibold text-[var(--app-ink)]">Recent activity</h2>
                <button
                  type="button"
                  onClick={() => focusTransactions()}
                  className="cursor-pointer text-[13px] font-medium text-[var(--app-muted)] hover:text-[var(--app-ink)]"
                >
                  View all <ArrowRight className="inline h-3 w-3" />
                </button>
              </div>
              <div className="space-y-3 pt-3">
                {activities.length === 0 ? (
                  <p className="text-xs text-[var(--app-faint)]">No recent activity.</p>
                ) : (
                  activities.slice(0, 4).map((activity) => (
                    <button
                      key={activity.id}
                      type="button"
                      onClick={() => focusTransactions()}
                      className="flex w-full cursor-pointer gap-2.5 text-left"
                    >
                      <span
                        className={`mt-0.5 flex h-5 w-5 items-center justify-center rounded-full text-[13px] ${
                          activity.tone === "income"
                            ? "bg-[var(--app-positive-bg)] text-[var(--app-positive)]"
                            : activity.tone === "expense"
                              ? "bg-[var(--app-critical-bg)] text-[var(--app-critical)]"
                              : "bg-[var(--app-hover)] text-[var(--app-muted)]"
                        }`}
                      >
                        •
                      </span>
                      <span>
                        <b className="block text-[13px] text-[var(--app-ink)]">{activity.title}</b>
                        <span className="mt-0.5 block text-xs text-[var(--app-faint)]">{activity.subtitle}</span>
                      </span>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        </section>
      </div>

      <input
        ref={csvInputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={(event) => {
          void importBankCsv(event.target.files?.[0] || null);
          event.target.value = "";
        }}
      />

      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(18,20,23,0.45)] p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-[var(--app-radius)] border border-[var(--app-border)] bg-[var(--app-surface)] p-6 text-xs shadow-[var(--app-shadow-pop)]">
            <div className="flex items-center justify-between border-b border-[var(--app-border)] pb-3">
              <h2 className="text-base font-semibold text-[var(--app-ink)]">New transaction</h2>
              <button type="button" onClick={() => setIsCreateOpen(false)} className="cursor-pointer text-[var(--app-faint)]">
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={saveTransaction} className="space-y-3 pt-4">
              <label className="block font-semibold text-[var(--app-ink)]">
                Description
                <input
                  required
                  value={newTransaction.description}
                  onChange={(event) => setNewTransaction({ ...newTransaction, description: event.target.value })}
                  className="mt-1 w-full rounded-[var(--app-radius-control)] border border-[var(--app-border)] px-3 py-2 outline-none focus:border-[var(--app-ink)]"
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="font-semibold text-[var(--app-ink)]">
                  Reference
                  <input
                    value={newTransaction.reference}
                    onChange={(event) => setNewTransaction({ ...newTransaction, reference: event.target.value })}
                    className="mt-1 w-full rounded-[var(--app-radius-control)] border border-[var(--app-border)] px-3 py-2 outline-none"
                  />
                </label>
                <label className="font-semibold text-[var(--app-ink)]">
                  Amount ($)
                  <input
                    required
                    min="0.01"
                    step="0.01"
                    type="number"
                    value={newTransaction.amount || ""}
                    onChange={(event) => setNewTransaction({ ...newTransaction, amount: Number(event.target.value) })}
                    className="mt-1 w-full rounded-[var(--app-radius-control)] border border-[var(--app-border)] px-3 py-2 outline-none"
                  />
                </label>
              </div>
              <label className="block font-semibold text-[var(--app-ink)]">
                Counterparty
                <input
                  value={newTransaction.counterparty}
                  onChange={(event) => setNewTransaction({ ...newTransaction, counterparty: event.target.value })}
                  className="mt-1 w-full rounded-[var(--app-radius-control)] border border-[var(--app-border)] px-3 py-2 outline-none"
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="font-semibold text-[var(--app-ink)]">
                  Type
                  <select
                    value={newTransaction.type}
                    onChange={(event) => setNewTransaction({ ...newTransaction, type: event.target.value as TransactionType })}
                    className="mt-1 w-full rounded-[var(--app-radius-control)] border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2"
                  >
                    <option>Income</option>
                    <option>Expense</option>
                    <option>Transfer</option>
                  </select>
                </label>
                <label className="font-semibold text-[var(--app-ink)]">
                  Status
                  <select
                    value={newTransaction.status}
                    onChange={(event) =>
                      setNewTransaction({ ...newTransaction, status: event.target.value as TransactionStatus })
                    }
                    className="mt-1 w-full rounded-[var(--app-radius-control)] border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2"
                  >
                    <option>Cleared</option>
                    <option>Pending</option>
                  </select>
                </label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="font-semibold text-[var(--app-ink)]">
                  Category
                  <input
                    value={newTransaction.category}
                    onChange={(event) => setNewTransaction({ ...newTransaction, category: event.target.value })}
                    className="mt-1 w-full rounded-[var(--app-radius-control)] border border-[var(--app-border)] px-3 py-2"
                  />
                </label>
                <label className="font-semibold text-[var(--app-ink)]">
                  Account
                  <input
                    value={newTransaction.account}
                    onChange={(event) => setNewTransaction({ ...newTransaction, account: event.target.value })}
                    className="mt-1 w-full rounded-[var(--app-radius-control)] border border-[var(--app-border)] px-3 py-2"
                  />
                </label>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="secondary" size="sm" onClick={() => setIsCreateOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm">
                  Save transaction
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isFilterOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(18,20,23,0.45)] p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm space-y-4 rounded-[var(--app-radius)] border border-[var(--app-border)] bg-[var(--app-surface)] p-5 text-xs shadow-[var(--app-shadow-pop)]">
            <div className="flex justify-between border-b border-[var(--app-border)] pb-3">
              <h2 className="text-sm font-semibold text-[var(--app-ink)]">Filter transactions</h2>
              <button type="button" onClick={() => setIsFilterOpen(false)} className="cursor-pointer text-[var(--app-faint)]">
                <X className="h-4 w-4" />
              </button>
            </div>
            <label className="block font-semibold">
              Transaction type
              <select
                value={typeFilter}
                onChange={(event) => {
                  setTypeFilter(event.target.value as "All" | TransactionType);
                  setCurrentPage(1);
                }}
                className="mt-1 w-full rounded-[var(--app-radius-control)] border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2"
              >
                <option>All</option>
                <option>Income</option>
                <option>Expense</option>
                <option>Transfer</option>
              </select>
            </label>
            <label className="block font-semibold">
              Status
              <select
                value={statusFilter}
                onChange={(event) => {
                  setStatusFilter(event.target.value as "All" | TransactionStatus);
                  setCurrentPage(1);
                }}
                className="mt-1 w-full rounded-[var(--app-radius-control)] border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2"
              >
                <option>All</option>
                <option>Cleared</option>
                <option>Pending</option>
              </select>
            </label>
            <div className="flex justify-end">
              <Button size="sm" onClick={() => setIsFilterOpen(false)}>
                Apply filters
              </Button>
            </div>
          </div>
        </div>
      )}

      {isProfileOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(18,20,23,0.45)] p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-[var(--app-radius)] border border-[var(--app-border)] bg-[var(--app-surface)] p-6 text-xs shadow-[var(--app-shadow-pop)]">
            <div className="flex justify-between border-b border-[var(--app-border)] pb-3">
              <div>
                <h2 className="text-base font-semibold text-[var(--app-ink)]">Account settings</h2>
                <p className="mt-0.5 text-[var(--app-faint)]">Profile and automation preferences</p>
              </div>
              <button type="button" onClick={() => setIsProfileOpen(false)} className="cursor-pointer text-[var(--app-faint)]">
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={saveProfile} className="space-y-3 pt-4">
              <label className="block font-semibold">
                Full name
                <input
                  value={profileForm.fullName}
                  onChange={(event) => setProfileForm({ ...profileForm, fullName: event.target.value })}
                  className="mt-1 w-full rounded-[var(--app-radius-control)] border border-[var(--app-border)] px-3 py-2"
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="font-semibold">
                  Role
                  <input
                    value={profileForm.role}
                    onChange={(event) => setProfileForm({ ...profileForm, role: event.target.value })}
                    className="mt-1 w-full rounded-[var(--app-radius-control)] border border-[var(--app-border)] px-3 py-2"
                  />
                </label>
                <label className="font-semibold">
                  Organization
                  <input
                    value={profileForm.organization}
                    onChange={(event) => setProfileForm({ ...profileForm, organization: event.target.value })}
                    className="mt-1 w-full rounded-[var(--app-radius-control)] border border-[var(--app-border)] px-3 py-2"
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
                <Button type="button" variant="secondary" size="sm" onClick={() => setIsProfileOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm">
                  Save settings
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}
