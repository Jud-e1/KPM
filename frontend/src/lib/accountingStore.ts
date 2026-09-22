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

const STORAGE_KEY = "kpm_accounting_state_v1";
const SYNC_CHANNEL_NAME = "kpm_accounting_sync_channel";

const DEFAULT_PROFILE: AccountingProfile = {
  id: "default",
  fullName: "Jude Azane",
  role: "Admin",
  organization: "Acme Trading Co.",
  autoReconciliation: true,
  notificationsEnabled: true,
};

const BASE_ACCOUNT_BALANCES: AccountBalance[] = [
  { name: "Cash & Bank", amount: 62480, icon: "wallet" },
  { name: "Accounts Receivable", amount: 12750, icon: "receipt" },
  { name: "Inventory", amount: 28420, icon: "box" },
  { name: "Accounts Payable", amount: 8960, icon: "file" },
  { name: "Equity", amount: 22340, icon: "landmark" },
];

const BASE_EXPENSES: Omit<ExpenseMetric, "percentage">[] = [
  { name: "Inventory Purchases", amount: 7730, color: "#0F172A" },
  { name: "Salaries & Wages", amount: 4050, color: "#A5B4D9" },
  { name: "Rent & Utilities", amount: 2210, color: "#4F7DF3" },
  { name: "Marketing", amount: 1470, color: "#8B8EF2" },
  { name: "Other", amount: 2960, color: "#6976F5" },
];

const FEATURED_TRANSACTIONS: AccountingTransaction[] = [
  {
    id: "txn-0048",
    date: "Apr 30, 2025",
    timestamp: new Date("2025-04-30T10:24:00").getTime(),
    description: "Customer Payment - INV-0048",
    reference: "INV-0048",
    counterparty: "BrightMart Stores",
    category: "Sales Revenue",
    account: "Accounts Receivable",
    type: "Income",
    amount: 5280,
    status: "Cleared",
  },
  {
    id: "txn-0047",
    date: "Apr 29, 2025",
    timestamp: new Date("2025-04-29T14:17:00").getTime(),
    description: "Inventory Purchase - PO-0047",
    reference: "PO-0047",
    counterparty: "Global Supplies Ltd",
    category: "Inventory Purchases",
    account: "Inventory Asset",
    type: "Expense",
    amount: 3450,
    status: "Cleared",
  },
  {
    id: "txn-0046",
    date: "Apr 28, 2025",
    timestamp: new Date("2025-04-28T09:32:00").getTime(),
    description: "Office Rent",
    reference: "RENT-APR",
    counterparty: "Monthly rent payment",
    category: "Rent & Utilities",
    account: "Operating Expenses",
    type: "Expense",
    amount: 1800,
    status: "Cleared",
  },
  {
    id: "txn-0045",
    date: "Apr 27, 2025",
    timestamp: new Date("2025-04-27T11:05:00").getTime(),
    description: "Supplier Refund",
    reference: "RF-0021",
    counterparty: "TechWorld Ltd",
    category: "Other",
    account: "Accounts Payable",
    type: "Expense",
    amount: 620,
    status: "Cleared",
  },
  {
    id: "txn-0044",
    date: "Apr 26, 2025",
    timestamp: new Date("2025-04-26T16:12:00").getTime(),
    description: "Bank Transfer",
    reference: "TRF-2025",
    counterparty: "To: Business Savings",
    category: "Transfer",
    account: "Cash & Bank",
    type: "Transfer",
    amount: 5000,
    status: "Cleared",
  },
  {
    id: "txn-0043",
    date: "Apr 25, 2025",
    timestamp: new Date("2025-04-25T13:40:00").getTime(),
    description: "Product Sale - POS-0032",
    reference: "POS-0032",
    counterparty: "Walk-in customer",
    category: "Sales Revenue",
    account: "Sales Revenue",
    type: "Income",
    amount: 1240,
    status: "Cleared",
  },
];

function generateInitialTransactions(): AccountingTransaction[] {
  const transactions = [...FEATURED_TRANSACTIONS];
  const templates: Array<Pick<AccountingTransaction, "description" | "category" | "account" | "type">> = [
    { description: "Customer Payment", category: "Sales Revenue", account: "Accounts Receivable", type: "Income" },
    { description: "Inventory Purchase", category: "Inventory Purchases", account: "Inventory Asset", type: "Expense" },
    { description: "Payroll Processing", category: "Salaries & Wages", account: "Operating Expenses", type: "Expense" },
    { description: "Marketing Campaign", category: "Marketing", account: "Operating Expenses", type: "Expense" },
    { description: "Bank Transfer", category: "Transfer", account: "Cash & Bank", type: "Transfer" },
  ];

  for (let index = 42; index >= 1; index -= 1) {
    const template = templates[index % templates.length];
    const day = Math.max(1, (index % 24) + 1);
    transactions.push({
      id: `txn-${String(index).padStart(4, "0")}`,
      date: `Apr ${day}, 2025`,
      timestamp: new Date(`2025-04-${String(day).padStart(2, "0")}T${String(9 + (index % 8)).padStart(2, "0")}:30:00`).getTime(),
      description: `${template.description} - ${String(index).padStart(4, "0")}`,
      reference: `REF-${String(index).padStart(4, "0")}`,
      counterparty: index % 2 ? "Acme Trading Co." : "Business partner",
      category: template.category,
      account: template.account,
      type: template.type,
      amount: 180 + ((index * 135) % 1250),
      status: index % 9 === 0 ? "Pending" : "Cleared",
    });
  }
  return transactions;
}

const BASELINE_TRANSACTIONS = generateInitialTransactions();
const BASELINE_TRANSACTION_IDS = new Set(BASELINE_TRANSACTIONS.map((transaction) => transaction.id));

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

const BASELINE_RAW_TOTALS = rawTotals(BASELINE_TRANSACTIONS);

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
  const totalRevenue = raw.income - BASELINE_RAW_TOTALS.income + 48250;
  const totalExpenses = raw.expenses - BASELINE_RAW_TOTALS.expenses + 18420;
  const netProfit = totalRevenue - totalExpenses;
  const cashDelta = (raw.income - raw.expenses) - (BASELINE_RAW_TOTALS.income - BASELINE_RAW_TOTALS.expenses);
  const accountBalances = BASE_ACCOUNT_BALANCES.map((balance) => {
    if (balance.name === "Cash & Bank") return { ...balance, amount: balance.amount + cashDelta };
    if (balance.name === "Accounts Receivable") return { ...balance, amount: balance.amount + raw.pending - BASELINE_RAW_TOTALS.pending };
    return balance;
  });
  const expenseBreakdown = BASE_EXPENSES.map((item) => {
    const amount = item.amount + raw.expensesByCategory[item.name] - BASELINE_RAW_TOTALS.expensesByCategory[item.name];
    return { ...item, amount: Math.max(0, amount), percentage: totalExpenses > 0 ? Math.round((Math.max(0, amount) / totalExpenses) * 100) : 0 };
  });
  return {
    totalRevenue: Number(totalRevenue.toFixed(2)),
    totalExpenses: Number(totalExpenses.toFixed(2)),
    netProfit: Number(netProfit.toFixed(2)),
    cashBalance: Number(accountBalances[0].amount.toFixed(2)),
    outstandingInvoices: Number((12750 + raw.pending - BASELINE_RAW_TOTALS.pending).toFixed(2)),
    expenseBreakdown,
    accountBalances,
  };
}

const DEFAULT_ACTIVITIES: AccountingActivity[] = [
  { id: "act-1", title: "Payment received from BrightMart Stores", subtitle: "$5,280.00 · Apr 30, 2025 · 10:24 AM", time: "Just now", timestamp: Date.now(), tone: "income" },
  { id: "act-2", title: "Invoice INV-0047 marked as paid", subtitle: "$3,450.00 · Apr 29, 2025 · 2:17 PM", time: "1 day ago", timestamp: Date.now() - 86400000, tone: "income" },
  { id: "act-3", title: "Reconciliation completed", subtitle: "Bank Account · Apr 28, 2025 · 9:32 AM", time: "2 days ago", timestamp: Date.now() - 172800000, tone: "info" },
  { id: "act-4", title: "New supplier added", subtitle: "Global Supplies Ltd · Apr 26, 2025 · 4:21 PM", time: "4 days ago", timestamp: Date.now() - 345600000, tone: "info" },
];

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
        if (event.key === STORAGE_KEY && event.newValue) {
          try {
            this.state = JSON.parse(event.newValue);
            this.state.metrics = computeAccountingMetrics(this.state.transactions);
            this.notify(false);
          } catch {}
        }
      });
    }
  }

  private loadState(): AccountingState {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved) as AccountingState;
          if (parsed.transactions?.length) {
            return {
              ...parsed,
              profile: parsed.profile || DEFAULT_PROFILE,
              activities: parsed.activities || DEFAULT_ACTIVITIES,
              metrics: computeAccountingMetrics(parsed.transactions),
              syncedRemoteTransactionIds: parsed.syncedRemoteTransactionIds || [],
            };
          }
        }
      } catch {}
    }
    const transactions = generateInitialTransactions();
    return {
      transactions,
      activities: DEFAULT_ACTIVITIES,
      profile: DEFAULT_PROFILE,
      metrics: computeAccountingMetrics(transactions),
      lastSync: new Date().toISOString(),
      syncedRemoteTransactionIds: [],
    };
  }

  private notify(broadcast = true) {
    this.listeners.forEach((listener) => listener(this.state));
    if (broadcast && typeof window !== "undefined") {
      try {
        this.broadcastChannel?.postMessage({ type: "ACCOUNTING_UPDATE", state: this.state });
        if (this.persistTimer !== null) window.clearTimeout(this.persistTimer);
        this.persistTimer = window.setTimeout(() => {
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
          } catch {}
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
        (transaction) => !BASELINE_TRANSACTION_IDS.has(transaction.id) && !previousRemoteIds.has(transaction.id) && !remoteById.has(transaction.id)
      );
      const baseline = this.state.transactions
        .filter((transaction) => BASELINE_TRANSACTION_IDS.has(transaction.id))
        .map((transaction) => remoteById.get(transaction.id) || transaction);
      const remoteNonBaseline = mapped.filter((transaction) => !BASELINE_TRANSACTION_IDS.has(transaction.id));
      transactions = [...unsynced, ...remoteNonBaseline, ...baseline];
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
}

export const accountingStore = new AccountingStore();
