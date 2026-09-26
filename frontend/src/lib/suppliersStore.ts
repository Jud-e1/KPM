import {
  purgeSuppliersStorage,
  readScopedJson,
  removeScopedJson,
  writeScopedJson,
} from "@/lib/storePersistence";
import {
  createSupplierRequestApi,
  fetchSupplierRequests,
  fetchSuppliers,
  fetchSuppliersSummary,
  updateSupplierApi,
} from "@/lib/api";

export type SupplierStatus = "Active" | "Pending" | "Inactive";
export type SupplierTone = "price" | "reliability" | "savings" | "match" | "info";

export interface Supplier {
  id: string;
  name: string;
  initial: string;
  accent: "slate" | "orange";
  categories: string[];
  products: number;
  location: string;
  rating: number;
  reviews: number;
  responseTime: string;
  minOrder: number;
  verified: boolean;
  status: SupplierStatus;
  matchScore: number;
  spendThisMonth: number;
}

export interface SupplierInsight {
  id: string;
  title: string;
  description: string;
  tone: SupplierTone;
  timestamp: number;
}

export interface CategoryCount {
  name: string;
  count: number;
  icon: "electronics" | "furniture" | "office" | "home" | "fashion";
}

export interface SupplierMetrics {
  totalSuppliers: number;
  activeSuppliers: number;
  pendingApprovals: number;
  totalSpend: number;
}

export interface SupplierRequest {
  id: string;
  need: string;
  category: string;
  budget: number;
  createdAt: string;
  status: "Open" | "Matched";
}

export interface SuppliersState {
  suppliers: Supplier[];
  insights: SupplierInsight[];
  requests: SupplierRequest[];
  lastSync: string;
  booting: boolean;
  syncError: string | null;
}

const STORAGE_KEY = "kpm_suppliers_state_v3";
const SYNC_CHANNEL_NAME = "kpm_suppliers_sync_channel_v3";

/** Detect the old generated ~40-vendor demo directory (Alpha / BlueOcean / NorthPeak / Summit…). */
function looksLikeLegacyDemoCatalog(suppliers: Supplier[]): boolean {
  if (suppliers.length < 15) return false;
  const demoNamed = suppliers.filter(
    (s) =>
      /^(Alpha Global|BlueOcean|NorthPeak|Summit Parts)/i.test(s.name) ||
      /\s\d{1,2}$/.test(s.name.trim())
  ).length;
  return demoNamed >= 8 || (suppliers.length >= 35 && demoNamed >= 5);
}

function emptyState(booting = true): SuppliersState {
  return {
    suppliers: [],
    insights: [],
    requests: [],
    lastSync: new Date().toISOString(),
    booting,
    syncError: null,
  };
}

function deriveInsights(items: { name: string; status?: string }[]): SupplierInsight[] {
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

export function computeSupplierMetrics(suppliers: Supplier[]): SupplierMetrics {
  return {
    totalSuppliers: suppliers.length,
    activeSuppliers: suppliers.filter((supplier) => supplier.status === "Active").length,
    pendingApprovals: suppliers.filter((supplier) => supplier.status === "Pending").length,
    totalSpend: Number(
      suppliers.reduce((sum, supplier) => sum + supplier.spendThisMonth, 0).toFixed(2)
    ),
  };
}

export function computeCategoryCounts(suppliers: Supplier[]): CategoryCount[] {
  const buckets: Record<string, CategoryCount> = {
    Electronics: { name: "Electronics", count: 0, icon: "electronics" },
    Furniture: { name: "Furniture", count: 0, icon: "furniture" },
    "Office Supplies": { name: "Office Supplies", count: 0, icon: "office" },
    "Home & Kitchen": { name: "Home & Kitchen", count: 0, icon: "home" },
    Fashion: { name: "Fashion", count: 0, icon: "fashion" },
  };

  for (const supplier of suppliers) {
    for (const category of supplier.categories) {
      if (
        category === "Electronics" ||
        category === "Laptops" ||
        category === "Monitors" ||
        category === "Components" ||
        category === "Gadgets" ||
        category === "Accessories" ||
        category === "Electrical"
      ) {
        buckets.Electronics.count += 1;
      } else if (category === "Furniture") {
        buckets.Furniture.count += 1;
      } else if (category === "Office Supplies" || category === "Stationery") {
        buckets["Office Supplies"].count += 1;
      } else if (
        category === "Home & Kitchen" ||
        category === "Appliances" ||
        category === "Decor"
      ) {
        buckets["Home & Kitchen"].count += 1;
      } else if (category === "Fashion" || category === "Shoes" || category === "Bags") {
        buckets.Fashion.count += 1;
      }
    }
  }

  return Object.values(buckets);
}

function mapRemoteSupplier(row: Record<string, unknown>): Supplier {
  return {
    id: String(row.id),
    name: String(row.name),
    initial: String(row.initial || "S"),
    accent: (row.accent as Supplier["accent"]) || "slate",
    categories: Array.isArray(row.categories) ? (row.categories as string[]) : [],
    products: Number(row.products || 0),
    location: String(row.location || ""),
    rating: Number(row.rating || 0),
    reviews: Number(row.reviews || 0),
    responseTime: String(row.response_time || ""),
    minOrder: Number(row.min_order || 0),
    verified: Boolean(row.verified),
    status: (row.status as Supplier["status"]) || "Pending",
    matchScore: Number(row.match_score || 0),
    spendThisMonth: Number(row.spend_this_month || 0),
  };
}

function mapRemoteRequest(row: Record<string, unknown>): SupplierRequest {
  return {
    id: String(row.id),
    need: String(row.need || ""),
    category: String(row.category || "General"),
    budget: Number(row.budget || 0),
    createdAt: String(row.created_at || new Date().toISOString()),
    status: (row.status as SupplierRequest["status"]) || "Open",
  };
}

class SuppliersStore {
  private state: SuppliersState;
  private listeners = new Set<(state: SuppliersState) => void>();
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
          if (event.data?.type === "SUPPLIERS_UPDATE" && event.data.state) {
            const incoming = event.data.state as SuppliersState;
            if (
              !Array.isArray(incoming.suppliers) ||
              looksLikeLegacyDemoCatalog(incoming.suppliers)
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
          const parsed = JSON.parse(event.newValue) as SuppliersState;
          if (!Array.isArray(parsed.suppliers)) return;
          if (looksLikeLegacyDemoCatalog(parsed.suppliers)) {
            purgeSuppliersStorage();
            return;
          }
          if (!this.hasSyncedOnce) return;
          this.state = {
            suppliers: parsed.suppliers,
            insights: deriveInsights(parsed.suppliers),
            requests: parsed.requests || [],
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
    purgeSuppliersStorage();
    this.state = emptyState(true);
    this.notify(false);
    void this.syncFromBackend(true);
  }

  private persist() {
    if (typeof window === "undefined" || !this.ownerId || !this.hasSyncedOnce) return;
    const cachePayload: SuppliersState = {
      ...this.state,
      booting: false,
      syncError: null,
    };
    writeScopedJson(STORAGE_KEY, this.ownerId, cachePayload);
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage({
          type: "SUPPLIERS_UPDATE",
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

  private setMeta(partial: Partial<Pick<SuppliersState, "booting" | "syncError">>) {
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

  public subscribe(listener: (state: SuppliersState) => void) {
    this.listeners.add(listener);
    listener(this.state);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public async approveSupplier(id: string) {
    const target = this.state.suppliers.find((supplier) => supplier.id === id);
    await updateSupplierApi(id, {
      status: "Active",
      spend_this_month: target?.spendThisMonth || 0,
    });
    await this.syncFromBackend(true);
  }

  public async requestSupplier(input: { need: string; category: string; budget: number }) {
    const created = await createSupplierRequestApi({
      need: input.need.trim(),
      category: input.category.trim() || "General",
      budget: Number(input.budget) || 0,
    });
    await this.syncFromBackend(true);
    return mapRemoteRequest(created as Record<string, unknown>);
  }

  public findMatches(query: string) {
    const needle = query.trim().toLowerCase();
    if (!needle) {
      return this.state.suppliers.slice().sort((a, b) => b.matchScore - a.matchScore);
    }
    return this.state.suppliers
      .filter((supplier) =>
        [supplier.name, supplier.location, ...supplier.categories].some((value) =>
          value.toLowerCase().includes(needle)
        )
      )
      .sort((a, b) => b.matchScore - a.matchScore);
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
        const summary = await fetchSuppliersSummary();
        if (!force && summary.revision === this.remoteRevision && this.hasSyncedOnce) {
          this.setMeta({ booting: false, syncError: null });
          return;
        }
        const [remote, requestRows] = await Promise.all([
          fetchSuppliers(500),
          fetchSupplierRequests().catch(() => [] as Array<Record<string, unknown>>),
        ]);
        if (!Array.isArray(remote)) {
          throw new Error("Invalid suppliers response from server.");
        }
        this.applyRemoteSuppliers(
          remote as unknown as Array<Record<string, unknown>>,
          summary.revision,
          Array.isArray(requestRows) ? (requestRows as Array<Record<string, unknown>>) : []
        );
        this.setMeta({ booting: false, syncError: null });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Could not load suppliers from the server.";
        if (!this.hasSyncedOnce) {
          const cached = this.ownerId
            ? readScopedJson<SuppliersState>(STORAGE_KEY, this.ownerId)
            : null;
          if (
            cached &&
            Array.isArray(cached.suppliers) &&
            cached.suppliers.length === 0 &&
            !looksLikeLegacyDemoCatalog(cached.suppliers)
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

  private applyRemoteSuppliers(
    remote: Array<Record<string, unknown>>,
    revision: string,
    requestRows: Array<Record<string, unknown>>
  ) {
    const mapped = remote.map(mapRemoteSupplier);
    const suppliers = looksLikeLegacyDemoCatalog(mapped) ? [] : mapped;
    const requests = requestRows.map(mapRemoteRequest);
    this.remoteRevision = revision;
    this.hasSyncedOnce = true;
    this.state = {
      suppliers,
      insights: deriveInsights(suppliers),
      requests,
      lastSync: new Date().toISOString(),
      booting: false,
      syncError: null,
    };
    this.notify(true);
  }

  public resetToDefault() {
    removeScopedJson(STORAGE_KEY, this.ownerId);
    purgeSuppliersStorage();
    this.ownerId = null;
    this.remoteRevision = null;
    this.hasSyncedOnce = false;
    this.state = emptyState(true);
    this.notify(false);
  }
}

export const suppliersStore = new SuppliersStore();
