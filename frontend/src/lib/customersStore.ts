import {
  purgeCustomersStorage,
  readScopedJson,
  removeScopedJson,
  writeScopedJson,
} from "@/lib/storePersistence";
import {
  createCustomerApi,
  fetchCustomers,
  fetchCustomersSummary,
  updateCustomerApi,
} from "@/lib/api";

export type CustomerStatus = "Active" | "Inactive";
export type CustomerType = "VIP" | "Regular" | "Wholesale";
export type CustomerInsightTone = "value" | "risk" | "crosssell" | "sentiment" | "info";

export interface Customer {
  id: string;
  name: string;
  email: string;
  company: string;
  industry: string;
  type: CustomerType;
  totalSpent: number;
  lastOrder: string;
  lastOrderTs: number;
  status: CustomerStatus;
  avatarColor: "blue" | "violet" | "emerald" | "amber" | "rose" | "slate";
  isNew: boolean;
  highValue: boolean;
}

export interface CustomerInsight {
  id: string;
  title: string;
  description: string;
  tone: CustomerInsightTone;
  timestamp: number;
}

export interface CustomerSegment {
  name: string;
  count: number;
  percentage: number;
  color: string;
}

export interface CustomerMetrics {
  totalCustomers: number;
  activeCustomers: number;
  newCustomers: number;
  totalRevenue: number;
  highValueCount: number;
  atRiskCount: number;
}

export interface CustomersState {
  customers: Customer[];
  insights: CustomerInsight[];
  lastSync: string;
  booting: boolean;
  syncError: string | null;
}

const STORAGE_KEY = "kpm_customers_state_v3";
const SYNC_CHANNEL_NAME = "kpm_customers_sync_channel_v3";

/** Detect the old generated ~40-customer demo directory (Priya / Alex Morgan 18 / Kenji Sato…). */
function looksLikeLegacyDemoCatalog(customers: Customer[]): boolean {
  if (customers.length < 15) return false;
  const demoNamed = customers.filter(
    (c) =>
      /^(Priya Nair|Alex Morgan|Kenji Sato|Jordan Lee|Sam Patel)/i.test(c.name) ||
      /\s\d{1,2}$/.test(c.name.trim())
  ).length;
  return demoNamed >= 8 || (customers.length >= 35 && demoNamed >= 5);
}

function emptyState(booting = true): CustomersState {
  return {
    customers: [],
    insights: [],
    lastSync: new Date().toISOString(),
    booting,
    syncError: null,
  };
}

export function computeCustomerMetrics(customers: Customer[]): CustomerMetrics {
  const activeCustomers = customers.filter((c) => c.status === "Active").length;
  const newCustomers = customers.filter((c) => c.isNew).length;
  const highValueCount = customers.filter((c) => c.highValue || c.type === "VIP").length;
  const thirtyDaysAgo = Date.now() - 30 * 24 * 3600 * 1000;
  const atRiskCount = customers.filter(
    (c) => c.status === "Inactive" || (c.lastOrderTs > 0 && c.lastOrderTs < thirtyDaysAgo)
  ).length;
  const totalRevenue = customers.reduce((sum, c) => sum + (c.totalSpent || 0), 0);
  return {
    totalCustomers: customers.length,
    activeCustomers,
    newCustomers,
    totalRevenue: Number(totalRevenue.toFixed(2)),
    highValueCount,
    atRiskCount,
  };
}

export function computeCustomerSegments(customers: Customer[]): CustomerSegment[] {
  if (!customers.length) {
    return [
      { name: "VIP", count: 0, percentage: 0, color: "#121417" },
      { name: "Wholesale", count: 0, percentage: 0, color: "#5c6570" },
      { name: "Regular", count: 0, percentage: 0, color: "#8b939e" },
    ];
  }
  const total = customers.length;
  const buckets: Array<{ name: CustomerType; color: string }> = [
    { name: "VIP", color: "#121417" },
    { name: "Wholesale", color: "#5c6570" },
    { name: "Regular", color: "#8b939e" },
  ];
  return buckets.map((bucket) => {
    const count = customers.filter((c) => c.type === bucket.name).length;
    return {
      name: bucket.name,
      count,
      percentage: Math.round((count / total) * 100),
      color: bucket.color,
    };
  });
}

function deriveInsights(items: { name: string; status?: string }[]): CustomerInsight[] {
  if (!items.length) return [];
  const active = items.filter((item) => (item.status || "Active") === "Active").length;
  return [
    {
      id: "insight-summary",
      title: `${items.length} in directory`,
      description: `${active} active · synced from your workspace database.`,
      tone: "info" as const,
      timestamp: Date.now(),
    },
  ];
}

function mapRemoteCustomer(row: Record<string, unknown>): Customer {
  return {
    id: String(row.id),
    name: String(row.name),
    email: String(row.email),
    company: String(row.company),
    industry: String(row.industry || "General"),
    type: (row.customer_type as Customer["type"]) || "Regular",
    totalSpent: Number(row.total_spent || 0),
    lastOrder: String(row.last_order || ""),
    lastOrderTs: Number(row.last_order_ts || 0),
    status: (row.status as Customer["status"]) || "Active",
    avatarColor: (row.avatar_color as Customer["avatarColor"]) || "blue",
    isNew: Boolean(row.is_new),
    highValue: Boolean(row.high_value),
  };
}

class CustomersStore {
  private state: CustomersState;
  private listeners = new Set<(state: CustomersState) => void>();
  private broadcastChannel: BroadcastChannel | null = null;
  private ownerId: string | null = null;
  private remoteRevision: string | null = null;
  private hasSyncedOnce = false;
  private liveConnectionCount = 0;
  private liveSyncTimer: number | null = null;
  private visibilityHandler: (() => void) | null = null;
  private syncPromise: Promise<void> | null = null;

  constructor() {
    this.state = emptyState(true);

    if (typeof window !== "undefined") {
      try {
        this.broadcastChannel = new BroadcastChannel(SYNC_CHANNEL_NAME);
        this.broadcastChannel.onmessage = (event) => {
          if (event.data?.type === "CUSTOMERS_UPDATE" && event.data.state) {
            const incoming = event.data.state as CustomersState;
            if (
              !Array.isArray(incoming.customers) ||
              looksLikeLegacyDemoCatalog(incoming.customers)
            ) {
              return;
            }
            if (!this.hasSyncedOnce) return;
            this.state = {
              ...incoming,
              booting: false,
              syncError: this.state.syncError,
            };
            this.notify(false);
          }
        };
      } catch {
        /* ignore */
      }

      window.addEventListener("storage", (event) => {
        if (!event.key?.startsWith(`${STORAGE_KEY}:`) || !event.newValue) return;
        if (this.ownerId && event.key !== `${STORAGE_KEY}:${this.ownerId}`) return;
        try {
          const parsed = JSON.parse(event.newValue) as CustomersState;
          if (!Array.isArray(parsed.customers)) return;
          if (looksLikeLegacyDemoCatalog(parsed.customers)) {
            purgeCustomersStorage();
            return;
          }
          if (!this.hasSyncedOnce) return;
          this.state = {
            customers: parsed.customers,
            insights: deriveInsights(parsed.customers),
            lastSync: parsed.lastSync || new Date().toISOString(),
            booting: false,
            syncError: this.state.syncError,
          };
          this.notify(false);
        } catch {
          /* ignore */
        }
      });
    }
  }

  /** Bind cache to the signed-in user. Never hydrate unscoped/legacy demo keys. */
  public bindOwner(userId: string) {
    if (this.ownerId === userId) {
      void this.syncFromBackend(true);
      return;
    }
    this.ownerId = userId;
    this.remoteRevision = null;
    this.hasSyncedOnce = false;
    purgeCustomersStorage();
    this.state = emptyState(true);
    this.notify(false);
    void this.syncFromBackend(true);
  }

  private persist() {
    if (typeof window === "undefined" || !this.ownerId || !this.hasSyncedOnce) return;
    const cachePayload: CustomersState = {
      ...this.state,
      booting: false,
      syncError: null,
    };
    writeScopedJson(STORAGE_KEY, this.ownerId, cachePayload);
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage({
          type: "CUSTOMERS_UPDATE",
          state: cachePayload,
        });
      } catch {
        /* ignore */
      }
    }
  }

  private notify(broadcast = true) {
    this.listeners.forEach((listener) => listener(this.state));
    if (broadcast) this.persist();
  }

  private setMeta(partial: Partial<Pick<CustomersState, "booting" | "syncError">>) {
    this.state = { ...this.state, ...partial };
    this.notify(false);
  }

  public getState() {
    return this.state;
  }

  public getBooting() {
    return this.state.booting;
  }

  public getSyncError() {
    return this.state.syncError;
  }

  public subscribe(listener: (state: CustomersState) => void) {
    this.listeners.add(listener);
    listener(this.state);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public async addCustomer(
    input: Omit<Customer, "id" | "lastOrder" | "lastOrderTs" | "avatarColor" | "isNew" | "highValue"> &
      Partial<Pick<Customer, "avatarColor" | "isNew" | "highValue">>
  ) {
    await createCustomerApi({
      name: input.name,
      email: input.email,
      company: input.company,
      industry: input.industry,
      customer_type: input.type,
      total_spent: input.totalSpent ?? 0,
      last_order: null,
      last_order_ts: 0,
      status: input.status,
      avatar_color: input.avatarColor || "blue",
      is_new: true,
      high_value: input.highValue ?? input.type === "VIP",
    });
    await this.syncFromBackend(true);
    const match = this.state.customers.find(
      (c) => c.email.toLowerCase() === input.email.trim().toLowerCase()
    );
    return match || this.state.customers[0];
  }

  public async updateCustomer(
    id: string,
    updates: Partial<Pick<Customer, "status" | "type" | "totalSpent">>
  ) {
    await updateCustomerApi(id, {
      status: updates.status,
      customer_type: updates.type,
      total_spent: updates.totalSpent,
    });
    await this.syncFromBackend(true);
  }

  public connectLive(): () => void {
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
        if (this.liveSyncTimer !== null) {
          window.clearInterval(this.liveSyncTimer);
          this.liveSyncTimer = null;
        }
        if (this.visibilityHandler) {
          document.removeEventListener("visibilitychange", this.visibilityHandler);
          this.visibilityHandler = null;
        }
      }
    };
  }

  public syncFromBackend(force = false): Promise<void> {
    if (this.syncPromise) return this.syncPromise;
    this.syncPromise = (async () => {
      if (!this.hasSyncedOnce) this.setMeta({ booting: true, syncError: null });
      try {
        const summary = await fetchCustomersSummary();
        if (!force && summary.revision === this.remoteRevision && this.hasSyncedOnce) {
          this.setMeta({ booting: false, syncError: null });
          return;
        }
        const remote = await fetchCustomers(500);
        if (!Array.isArray(remote)) {
          throw new Error("Invalid customers response from server.");
        }
        this.applyRemoteCustomers(remote as unknown as Array<Record<string, unknown>>, summary.revision);
        this.setMeta({ booting: false, syncError: null });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Could not load customers from the server.";
        if (!this.hasSyncedOnce) {
          const cached = this.ownerId
            ? readScopedJson<CustomersState>(STORAGE_KEY, this.ownerId)
            : null;
          if (
            cached &&
            Array.isArray(cached.customers) &&
            cached.customers.length === 0 &&
            !looksLikeLegacyDemoCatalog(cached.customers)
          ) {
            this.state = {
              ...emptyState(false),
              lastSync: cached.lastSync || new Date().toISOString(),
              syncError: message,
            };
          } else {
            this.state = {
              ...emptyState(false),
              syncError: message,
            };
          }
          this.notify(false);
        } else {
          this.setMeta({ booting: false, syncError: message });
        }
      } finally {
        this.syncPromise = null;
      }
    })();
    return this.syncPromise;
  }

  private applyRemoteCustomers(remote: Array<Record<string, unknown>>, revision: string) {
    const mapped = remote.map(mapRemoteCustomer);
    const customers = looksLikeLegacyDemoCatalog(mapped) ? [] : mapped;
    this.remoteRevision = revision;
    this.hasSyncedOnce = true;
    this.state = {
      customers,
      insights: deriveInsights(customers),
      lastSync: new Date().toISOString(),
      booting: false,
      syncError: null,
    };
    this.notify(true);
  }

  public resetToDefault() {
    removeScopedJson(STORAGE_KEY, this.ownerId);
    purgeCustomersStorage();
    this.ownerId = null;
    this.remoteRevision = null;
    this.hasSyncedOnce = false;
    this.state = emptyState(true);
    this.notify(false);
  }
}

export const customersStore = new CustomersStore();
