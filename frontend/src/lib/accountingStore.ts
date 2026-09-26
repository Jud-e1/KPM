import {
  AccountingProfile as ApiAccountingProfile,
  ApiAccountingActivity,
  ApiAccountingTransaction,
  createAccountingActivity,
  fetchAccountingActivities,
  fetchAccountingProfile,
  fetchAccountingSummary,
  fetchAccountingTransactions,
} from "@/lib/api";
import {
  readScopedJson,
  removeScopedJson,
  writeScopedJson,
} from "@/lib/storePersistence";

export type TransactionType = "Income" | "Expense" | "Transfer";
export type TransactionStatus = "Cleared" | "Pending";

export interface AccountingTransaction {
  id: string;
  date: string;
  timestamp: number;
  description: string;
  reference: string;
  counterparty: string;
  category: string;
  account: string;
  type: TransactionType;
  amount: number;
  status: TransactionStatus;
}

export interface AccountBalance {
  name: string;
  amount: number;
  icon: "wallet" | "receipt" | "box" | "file" | "landmark";
}

export interface ExpenseMetric {
  name: string;
  amount: number;
  percentage: number;
  color: string;
}

export interface AccountingActivity {
  id: string;
  title: string;
  subtitle: string;
  time: string;
  timestamp: number;
  tone: "income" | "expense" | "info";
}

export interface AccountingProfile {
  id: string;
  fullName: string;
  role: string;
  organization: string;
  autoReconciliation: boolean;
  notificationsEnabled: boolean;
}

export interface AccountingMetrics {
  totalRevenue: number;
  totalExpenses: number;
  netProfit: number;
  cashBalance: number;
  outstandingInvoices: number;
  expenseBreakdown: ExpenseMetric[];
  accountBalances: AccountBalance[];
}

export interface AccountingState {
  transactions: AccountingTransaction[];
  activities: AccountingActivity[];
  profile: AccountingProfile;
  metrics: AccountingMetrics;
  lastSync: string;
  syncedRemoteTransactionIds?: string[];
}

const STORAGE_KEY = "kpm_accounting_state_v2";
const SYNC_CHANNEL_NAME = "kpm_accounting_sync_channel";

const DEFAULT_PROFILE: AccountingProfile = {
  id: "default",
  fullName: "",
  role: "Admin",
  organization: "",
  autoReconciliation: true,
  notificationsEnabled: true,
};

const BASE_ACCOUNT_BALANCES: AccountBalance[] = [
  { name: "Cash & Bank", amount: 0, icon: "wallet" },
  { name: "Accounts Receivable", amount: 0, icon: "receipt" },
  { name: "Inventory", amount: 0, icon: "box" },
  { name: "Accounts Payable", amount: 0, icon: "file" },
  { name: "Equity", amount: 0, icon: "landmark" },
];

const ACCOUNT_ICONS: Record<string, AccountBalance["icon"]> = {
  "Cash & Bank": "wallet",
  Cash: "wallet",
  Bank: "wallet",
  "Accounts Receivable": "receipt",
  Inventory: "box",
  "Accounts Payable": "file",
  Equity: "landmark",
};

function normalizeAccountName(account: string) {
  const trimmed = account.trim();
  if (!trimmed) return "Other";
  const lower = trimmed.toLowerCase();
  if (lower.includes("cash") || lower.includes("bank")) return "Cash & Bank";
  if (lower.includes("receivable") || lower === "ar") return "Accounts Receivable";
  if (lower.includes("payable") || lower === "ap") return "Accounts Payable";
  if (lower.includes("inventory") || lower.includes("stock")) return "Inventory";
  if (lower.includes("equity") || lower.includes("capital")) return "Equity";
  return trimmed;
}

function signedAmount(transaction: AccountingTransaction) {
  if (transaction.type === "Expense") return -Math.abs(transaction.amount);
  if (transaction.type === "Income") return Math.abs(transaction.amount);
  return transaction.amount;
}

const BASE_EXPENSES: Omit<ExpenseMetric, "percentage">[] = [
  { name: "Inventory Purchases", amount: 0, color: "#121417" },
  { name: "Salaries & Wages", amount: 0, color: "#5c6570" },
  { name: "Rent & Utilities", amount: 0, color: "#8b939e" },
  { name: "Marketing", amount: 0, color: "#d5d8de" },
  { name: "Other", amount: 0, color: "#e6e8eb" },
];

function rawTotals(transactions: AccountingTransaction[]) {
  return transactions.reduce(
    (totals, transaction) => {
      if (transaction.type === "Income") totals.income += transaction.amount;
      if (transaction.type === "Expense") totals.expenses += transaction.amount;
      if (transaction.status === "Pending") totals.pending += transaction.amount;
      if (transaction.type === "Expense") {
        const category = expenseCategory(transaction.category);
        totals.expensesByCategory[category] += transaction.amount;
      }
      return totals;
    },
    {
      income: 0,
      expenses: 0,
      pending: 0,
      expensesByCategory: Object.fromEntries(BASE_EXPENSES.map((item) => [item.name, 0])) as Record<string, number>,
    }
  );
}

function expenseCategory(category: string) {
  if (category === "Inventory" || category === "Inventory Purchases") return "Inventory Purchases";
  if (category === "Salaries & Wages") return "Salaries & Wages";
  if (category === "Rent & Utilities") return "Rent & Utilities";
  if (category === "Marketing") return "Marketing";
  return "Other";
}


function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { date: "", timestamp: 0 };
  return {
    date: new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(date),
    timestamp: date.getTime(),
  };
}

function mapApiTransaction(transaction: ApiAccountingTransaction): AccountingTransaction {
  const formatted = formatDate(transaction.transaction_date || transaction.created_at);
  return {
    id: transaction.id,
    date: formatted.date,
    timestamp: formatted.timestamp,
    description: transaction.description,
    reference: transaction.reference || "—",
    counterparty: transaction.counterparty || "—",
    category: transaction.category,
    account: transaction.account,
    type: transaction.transaction_type === "Income" || transaction.transaction_type === "Transfer" ? transaction.transaction_type : "Expense",
    amount: transaction.amount,
    status: transaction.status === "Pending" ? "Pending" : "Cleared",
  };
}

function mapApiProfile(profile: ApiAccountingProfile): AccountingProfile {
  return {
    id: profile.id,
    fullName: profile.full_name,
    role: profile.role,
    organization: profile.organization,
    autoReconciliation: profile.auto_reconciliation,
    notificationsEnabled: profile.notifications_enabled,
  };
}

function mapApiActivity(activity: ApiAccountingActivity): AccountingActivity {
  return {
    id: activity.id,
    title: activity.title,
    subtitle: activity.subtitle || "",
    time: activity.time || "Just now",
    timestamp: activity.timestamp,
    tone: activity.tone === "income" || activity.tone === "expense" ? activity.tone : "info",
  };
}

export function computeAccountingMetrics(transactions: AccountingTransaction[]): AccountingMetrics {
  const raw = rawTotals(transactions);
  const totalRevenue = raw.income;
  const totalExpenses = raw.expenses;
  const netProfit = totalRevenue - totalExpenses;

  const totalsByAccount = new Map<string, number>();
  for (const balance of BASE_ACCOUNT_BALANCES) {
    totalsByAccount.set(balance.name, 0);
  }
  for (const transaction of transactions) {
    const name = normalizeAccountName(transaction.account || "Other");
    totalsByAccount.set(name, (totalsByAccount.get(name) || 0) + signedAmount(transaction));
  }

  const knownNames = new Set(BASE_ACCOUNT_BALANCES.map((item) => item.name));
  const accountBalances: AccountBalance[] = [
    ...BASE_ACCOUNT_BALANCES.map((balance) => ({
      ...balance,
      amount: Number((totalsByAccount.get(balance.name) || 0).toFixed(2)),
    })),
    ...[...totalsByAccount.entries()]
      .filter(([name]) => !knownNames.has(name) && name !== "Other")
      .map(([name, amount]) => ({
        name,
        amount: Number(amount.toFixed(2)),
        icon: ACCOUNT_ICONS[name] || ("landmark" as const),
      })),
  ];

  const cashBalance =
    accountBalances.find((item) => item.name === "Cash & Bank")?.amount ??
    Number((raw.income - raw.expenses).toFixed(2));

  const expenseBreakdown = BASE_EXPENSES.map((item) => {
    const amount = raw.expensesByCategory[item.name] || 0;
    return {
      ...item,
      amount: Math.max(0, amount),
      percentage: totalExpenses > 0 ? Math.round((Math.max(0, amount) / totalExpenses) * 100) : 0,
    };
  });
  return {
    totalRevenue: Number(totalRevenue.toFixed(2)),
    totalExpenses: Number(totalExpenses.toFixed(2)),
    netProfit: Number(netProfit.toFixed(2)),
    cashBalance: Number(cashBalance.toFixed(2)),
    outstandingInvoices: Number(raw.pending.toFixed(2)),
    expenseBreakdown,
    accountBalances,
  };
}

const DEFAULT_ACTIVITIES: AccountingActivity[] = [];

class AccountingStore {
  private state: AccountingState;
  private listeners = new Set<(state: AccountingState) => void>();
  private broadcastChannel: BroadcastChannel | null = null;
  private remoteRevision: string | null = null;
  private transactionsRevision: string | null = null;
  private profileRevision: string | null = null;
  private activitiesRevision: string | null = null;
  private syncPromise: Promise<void> | null = null;
  private liveConnectionCount = 0;
  private liveSyncTimer: number | null = null;
  private persistTimer: number | null = null;
  private visibilityHandler: (() => void) | null = null;

  constructor() {
    this.state = this.loadState();
    if (typeof window !== "undefined") {
      try {
        this.broadcastChannel = new BroadcastChannel(SYNC_CHANNEL_NAME);
        this.broadcastChannel.onmessage = (event) => {
          if (event.data?.type === "ACCOUNTING_UPDATE") {
            this.state = event.data.state;
            this.notify(false);
          }
        };
      } catch {}
      window.addEventListener("storage", (event) => {
        if (!event.key?.startsWith(`${STORAGE_KEY}:`) || !event.newValue) return;
        if (this.ownerId && event.key !== `${STORAGE_KEY}:${this.ownerId}`) return;
        try {
          this.state = JSON.parse(event.newValue);
          this.state.metrics = computeAccountingMetrics(this.state.transactions);
          this.notify(false);
        } catch {}
      });
    }
  }

  private ownerId: string | null = null;

  public bindOwner(userId: string) {
    if (this.ownerId === userId) return;
    this.ownerId = userId;
    this.remoteRevision = null;
    this.state = this.loadStateFor(userId);
    this.notify();
    void this.syncFromBackend(true);
  }

  private loadState(): AccountingState {
    return {
      transactions: [],
      activities: [],
      profile: { ...DEFAULT_PROFILE },
      metrics: computeAccountingMetrics([]),
      lastSync: new Date().toISOString(),
      syncedRemoteTransactionIds: [],
    };
  }

  private loadStateFor(userId: string): AccountingState {
    const parsed = readScopedJson<AccountingState>(STORAGE_KEY, userId);
    if (parsed && Array.isArray(parsed.transactions)) {
      return {
        ...parsed,
        profile: parsed.profile || DEFAULT_PROFILE,
        activities: Array.isArray(parsed.activities) ? parsed.activities : [],
        metrics: computeAccountingMetrics(parsed.transactions),
        syncedRemoteTransactionIds: parsed.syncedRemoteTransactionIds || [],
      };
    }
    return this.loadState();
  }

  private notify(broadcast = true) {
    this.listeners.forEach((listener) => listener(this.state));
    if (broadcast && typeof window !== "undefined") {
      try {
        this.broadcastChannel?.postMessage({ type: "ACCOUNTING_UPDATE", state: this.state });
        if (this.persistTimer !== null) window.clearTimeout(this.persistTimer);
        this.persistTimer = window.setTimeout(() => {
          writeScopedJson(STORAGE_KEY, this.ownerId, this.state);
        }, 120);
      } catch {}
    }
  }

  private commit(next: Omit<AccountingState, "metrics" | "lastSync"> & Partial<Pick<AccountingState, "metrics" | "lastSync">>, options?: { silent?: boolean }) {
    const metrics = next.metrics || computeAccountingMetrics(next.transactions);
    this.state = {
      ...next,
      metrics,
      lastSync: new Date().toISOString(),
    };
    this.notify(!options?.silent);
  }

  public getState() {
    return this.state;
  }

  public subscribe(listener: (state: AccountingState) => void) {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  public createTransaction(input: Omit<AccountingTransaction, "id" | "date" | "timestamp">) {
    const now = new Date();
    const transaction: AccountingTransaction = {
      ...input,
      id: `txn-${Date.now()}`,
      date: new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(now),
      timestamp: now.getTime(),
    };
    const activity = this.activityFor(transaction);
    this.commit({
      ...this.state,
      transactions: [transaction, ...this.state.transactions],
      activities: [activity, ...this.state.activities].slice(0, 12),
    });
    this.persistActivity(activity);
    return transaction;
  }

  public updateTransaction(id: string, updates: Partial<Pick<AccountingTransaction, "status" | "category" | "account" | "amount" | "description">>) {
    const current = this.state.transactions.find((transaction) => transaction.id === id);
    if (!current) return null;
    const transaction = { ...current, ...updates };
    const transactions = this.state.transactions.map((item) => item.id === id ? transaction : item);
    const activity = this.activityFor(transaction, updates.status === "Cleared" ? "Transaction cleared" : "Transaction updated");
    this.commit({
      ...this.state,
      transactions,
      activities: [activity, ...this.state.activities].slice(0, 12),
    });
    this.persistActivity(activity);
    return transaction;
  }

  public updateProfile(updates: Partial<AccountingProfile>) {
    const profile = { ...this.state.profile, ...updates };
    const activity: AccountingActivity = {
      id: `profile-${Date.now()}`,
      title: "Account settings updated",
      subtitle: `${profile.fullName} · ${profile.role} · ${profile.organization}`,
      time: "Just now",
      timestamp: Date.now(),
      tone: "info",
    };
    this.commit({
      ...this.state,
      profile,
      activities: [activity, ...this.state.activities].slice(0, 12),
    });
    this.persistActivity(activity);
    return profile;
  }

  public markTransactionSynced(id: string) {
    const ids = new Set(this.state.syncedRemoteTransactionIds || []);
    if (ids.has(id)) return;
    ids.add(id);
    this.commit({ ...this.state, syncedRemoteTransactionIds: [...ids] });
  }

  public exportTransactionsCsv() {
    const header = ["Date", "Description", "Reference", "Category", "Account", "Type", "Amount", "Status"];
    const rows = this.state.transactions.map((transaction) => [
      transaction.date,
      `"${transaction.description.replaceAll('"', '""')}"`,
      transaction.reference,
      transaction.category,
      transaction.account,
      transaction.type,
      transaction.amount.toFixed(2),
      transaction.status,
    ]);
    return [header.join(","), ...rows.map((row) => row.join(","))].join("\n");
  }

  public connectLive() {
    if (typeof window === "undefined") return () => undefined;
    this.liveConnectionCount += 1;
    if (this.liveConnectionCount === 1) {
      void this.syncFromBackend(true);
      this.liveSyncTimer = window.setInterval(() => {
        if (document.visibilityState === "visible") void this.syncFromBackend();
      }, 5000);
      this.visibilityHandler = () => {
        if (document.visibilityState === "visible") void this.syncFromBackend();
      };
      document.addEventListener("visibilitychange", this.visibilityHandler);
    }
    return () => {
      this.liveConnectionCount = Math.max(0, this.liveConnectionCount - 1);
      if (this.liveConnectionCount === 0) {
        if (this.liveSyncTimer !== null) window.clearInterval(this.liveSyncTimer);
        this.liveSyncTimer = null;
        if (this.visibilityHandler) document.removeEventListener("visibilitychange", this.visibilityHandler);
        this.visibilityHandler = null;
      }
    };
  }

  public syncFromBackend(force = false): Promise<void> {
    if (this.syncPromise) return this.syncPromise;
    this.syncPromise = (async () => {
      try {
        const summary = await fetchAccountingSummary();
        if (!force && summary.revision === this.remoteRevision) return;
        const needTransactions = force || !this.transactionsRevision || summary.transactions_revision !== this.transactionsRevision;
        const needProfile = force || !this.profileRevision || summary.profile_revision !== this.profileRevision;
        const needActivities = force || !this.activitiesRevision || summary.activities_revision !== this.activitiesRevision;
        const [transactions, profile, activities] = await Promise.all([
          needTransactions ? fetchAccountingTransactions({ limit: 500 }) : Promise.resolve(null),
          needProfile ? fetchAccountingProfile() : Promise.resolve(null),
          needActivities ? fetchAccountingActivities(12) : Promise.resolve(null),
        ]);
        this.reconcile({
          remoteTransactions: transactions,
          remoteProfile: profile,
          remoteActivities: activities,
          revision: summary.revision,
          transactionsRevision: summary.transactions_revision || summary.revision,
          profileRevision: summary.profile_revision || summary.revision,
          activitiesRevision: summary.activities_revision || summary.revision,
        });
      } catch {
        // Keep local data available during an offline interval; the next small
        // revision check retries automatically when connectivity returns.
      } finally {
        this.syncPromise = null;
      }
    })();
    return this.syncPromise;
  }

  private reconcile(input: {
    remoteTransactions: ApiAccountingTransaction[] | null;
    remoteProfile: ApiAccountingProfile | null;
    remoteActivities: ApiAccountingActivity[] | null;
    revision: string;
    transactionsRevision: string;
    profileRevision: string;
    activitiesRevision: string;
  }) {
    let transactions = this.state.transactions;
    let syncedRemoteTransactionIds = this.state.syncedRemoteTransactionIds || [];
    if (input.remoteTransactions) {
      const mapped = input.remoteTransactions.map(mapApiTransaction);
      const remoteById = new Map(mapped.map((transaction) => [transaction.id, transaction]));
      const previousRemoteIds = new Set(syncedRemoteTransactionIds);
      const unsynced = this.state.transactions.filter(
        (transaction) => !previousRemoteIds.has(transaction.id) && !remoteById.has(transaction.id)
      );
      transactions = [...unsynced, ...mapped];
      syncedRemoteTransactionIds = mapped.map((transaction) => transaction.id);
    }

    const profile = input.remoteProfile ? mapApiProfile(input.remoteProfile) : this.state.profile;
    const activities = input.remoteActivities ? this.mergeActivities(input.remoteActivities.map(mapApiActivity)) : this.state.activities;

    const unchanged =
      this.remoteRevision === input.revision &&
      this.transactionsRevision === input.transactionsRevision &&
      this.profileRevision === input.profileRevision &&
      this.activitiesRevision === input.activitiesRevision &&
      transactions === this.state.transactions &&
      profile === this.state.profile &&
      activities === this.state.activities;

    this.remoteRevision = input.revision;
    this.transactionsRevision = input.transactionsRevision;
    this.profileRevision = input.profileRevision;
    this.activitiesRevision = input.activitiesRevision;

    if (unchanged) return;

    this.commit({
      ...this.state,
      transactions,
      profile,
      activities,
      syncedRemoteTransactionIds,
    });
  }

  private mergeActivities(remote: AccountingActivity[]) {
    const byId = new Map<string, AccountingActivity>();
    for (const activity of [...remote, ...this.state.activities]) {
      if (!byId.has(activity.id)) byId.set(activity.id, activity);
    }
    return [...byId.values()].sort((left, right) => right.timestamp - left.timestamp).slice(0, 12);
  }

  private persistActivity(activity: AccountingActivity) {
    void createAccountingActivity({
      id: activity.id,
      title: activity.title,
      subtitle: activity.subtitle,
      time: activity.time,
      timestamp: activity.timestamp,
      tone: activity.tone,
    }).catch(() => undefined);
  }

  private activityFor(transaction: AccountingTransaction, action?: string): AccountingActivity {
    const income = transaction.type === "Income";
    return {
      id: `activity-${Date.now()}`,
      title: action || `${income ? "Payment received" : "Transaction recorded"}: ${transaction.description}`,
      subtitle: `${income ? "+" : "-"}$${transaction.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })} · ${transaction.date}`,
      time: "Just now",
      timestamp: Date.now(),
      tone: income ? "income" : transaction.type === "Expense" ? "expense" : "info",
    };
  }

  public resetToDefault() {
    removeScopedJson(STORAGE_KEY, this.ownerId);
    if (typeof window !== "undefined") {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {}
    }
    this.ownerId = null;
    this.remoteRevision = null;
    this.state = {
      transactions: [],
      activities: [],
      profile: { ...DEFAULT_PROFILE },
      metrics: computeAccountingMetrics([]),
      lastSync: new Date().toISOString(),
      syncedRemoteTransactionIds: [],
    };
    this.notify();
  }
}

export const accountingStore = new AccountingStore();
