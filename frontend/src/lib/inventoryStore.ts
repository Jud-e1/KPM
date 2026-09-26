// frontend/src/lib/inventoryStore.ts
import {
  purgeInventoryStorage,
  readScopedJson,
  removeScopedJson,
  writeScopedJson,
} from "@/lib/storePersistence";
import {
  adjustInventoryStock,
  bulkCreateInventoryProducts,
  createInventoryProduct,
  deleteInventoryProduct,
  fetchInventoryProducts,
  fetchInventorySummary,
  updateInventoryProduct,
} from "@/lib/api";

export interface InventoryProduct {
  id: string;
  name: string;
  subtitle: string;
  sku: string;
  category:
    | "Electronics"
    | "Furniture"
    | "Accessories"
    | "Home & Kitchen"
    | "Stationery"
    | "Bags & Luggage"
    | "Others"
    | string;
  stock: number;
  status: "In Stock" | "Low Stock" | "Out of Stock";
  price: number;
  cost?: number;
  image?: string;
  lowStockThreshold?: number;
  lastUpdated?: string;
}

export interface InventoryAlert {
  id: string;
  title: string;
  subtitle: string;
  time: string;
  type: "critical" | "warning" | "info" | "success";
  timestamp: number;
}

export interface CategoryMetric {
  name: string;
  percentage: number;
  value: number;
  count: number;
  iconName?: string;
}

export interface InventoryMetrics {
  totalProducts: number;
  totalStockValue: number;
  inStockCount: number;
  inStockPercentage: number;
  lowStockCount: number;
  lowStockPercentage: number;
  outOfStockCount: number;
  outOfStockPercentage: number;
  topCategories: CategoryMetric[];
}

export interface InventoryState {
  products: InventoryProduct[];
  alerts: InventoryAlert[];
  metrics: InventoryMetrics;
  lastSync: string;
  booting: boolean;
  syncError: string | null;
}

export type InventoryProductPayload = {
  name: string;
  subtitle?: string;
  sku: string;
  category?: string;
  stock?: number;
  price?: number;
  low_stock_threshold?: number;
  image?: string | null;
};

const STORAGE_KEY = "kpm_inventory_state_v3";
const SYNC_CHANNEL_NAME = "kpm_inventory_sync_channel_v3";

/** Detect the old generated “Unit Model / Commercial Grade” catalog (≈60 SKUs). */
function looksLikeLegacyDemoCatalog(products: InventoryProduct[]): boolean {
  if (products.length < 20) return false;
  const unitModel = products.filter((p) => /Unit Model [A-Z]-\d+/i.test(p.name)).length;
  const commercial = products.filter((p) =>
    /Commercial Grade SKU/i.test(p.subtitle || "")
  ).length;
  return unitModel >= 8 || commercial >= 8;
}

function emptyMetrics(): InventoryMetrics {
  return {
    totalProducts: 0,
    totalStockValue: 0,
    inStockCount: 0,
    inStockPercentage: 0,
    lowStockCount: 0,
    lowStockPercentage: 0,
    outOfStockCount: 0,
    outOfStockPercentage: 0,
    topCategories: [],
  };
}

function emptyState(booting = true): InventoryState {
  return {
    products: [],
    alerts: [],
    metrics: emptyMetrics(),
    lastSync: new Date().toISOString(),
    booting,
    syncError: null,
  };
}

function deriveAlerts(products: InventoryProduct[]): InventoryAlert[] {
  const out = products.filter((p) => p.status === "Out of Stock" || p.stock === 0);
  const low = products.filter(
    (p) =>
      p.status === "Low Stock" ||
      (p.lowStockThreshold != null && p.stock > 0 && p.stock <= p.lowStockThreshold)
  );
  const alerts: InventoryAlert[] = [];
  const now = Date.now();
  if (out.length) {
    alerts.push({
      id: "alert-out",
      title: `${out.length} product${out.length === 1 ? "" : "s"} out of stock`,
      subtitle: "Immediate attention required",
      time: "Just now",
      type: "critical",
      timestamp: now,
    });
  }
  if (low.length) {
    alerts.push({
      id: "alert-low",
      title: `${low.length} product${low.length === 1 ? "" : "s"} running low`,
      subtitle: "Consider reordering soon",
      time: "Just now",
      type: "warning",
      timestamp: now - 1,
    });
  }
  return alerts;
}

export function computeMetrics(products: InventoryProduct[]): InventoryMetrics {
  if (!products.length) return emptyMetrics();

  const totalProducts = products.length;
  let inStockCount = 0;
  let lowStockCount = 0;
  let outOfStockCount = 0;
  let totalStockValue = 0;
  const categoryMap: Record<string, { value: number; count: number }> = {};

  for (const p of products) {
    if (p.status === "Out of Stock" || p.stock === 0) {
      outOfStockCount++;
    } else if (
      p.status === "Low Stock" ||
      (p.lowStockThreshold != null && p.stock <= p.lowStockThreshold)
    ) {
      lowStockCount++;
    } else {
      inStockCount++;
    }
    const itemValue = p.stock * p.price;
    totalStockValue += itemValue;
    const catKey = p.category || "Others";
    if (!categoryMap[catKey]) categoryMap[catKey] = { value: 0, count: 0 };
    categoryMap[catKey].value += itemValue;
    categoryMap[catKey].count += 1;
  }

  const topCategories: CategoryMetric[] = Object.entries(categoryMap)
    .map(([name, data]) => ({
      name,
      percentage: totalStockValue > 0 ? Math.round((data.value / totalStockValue) * 100) : 0,
      value: Math.round(data.value),
      count: data.count,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  return {
    totalProducts,
    totalStockValue: Math.round(totalStockValue * 100) / 100,
    inStockCount,
    inStockPercentage: totalProducts > 0 ? Math.round((inStockCount / totalProducts) * 100) : 0,
    lowStockCount,
    lowStockPercentage: totalProducts > 0 ? Math.round((lowStockCount / totalProducts) * 100) : 0,
    outOfStockCount,
    outOfStockPercentage: totalProducts > 0 ? Math.round((outOfStockCount / totalProducts) * 100) : 0,
    topCategories,
  };
}

function mapRemoteProduct(row: Record<string, unknown>): InventoryProduct {
  return {
    id: String(row.id),
    name: String(row.name),
    subtitle: String(row.subtitle || ""),
    sku: String(row.sku),
    category: String(row.category || "General"),
    stock: Number(row.stock || 0),
    status: (row.status as InventoryProduct["status"]) || "In Stock",
    price: Number(row.price || 0),
    lowStockThreshold: Number(row.low_stock_threshold ?? 15),
    image: row.image ? String(row.image) : undefined,
    lastUpdated: row.updated_at ? String(row.updated_at) : new Date().toISOString(),
  };
}

class InventoryStore {
  private state: InventoryState;
  private listeners: Set<(state: InventoryState) => void> = new Set();
  private broadcastChannel: BroadcastChannel | null = null;
  private ownerId: string | null = null;
  private liveConnectionCount = 0;
  private liveSyncTimer: number | null = null;
  private visibilityHandler: (() => void) | null = null;
  private syncPromise: Promise<void> | null = null;
  private remoteRevision: string | null = null;
  private hasSyncedOnce = false;

  constructor() {
    this.state = emptyState(true);

    if (typeof window !== "undefined") {
      try {
        this.broadcastChannel = new BroadcastChannel(SYNC_CHANNEL_NAME);
        this.broadcastChannel.onmessage = (event) => {
          if (event.data && event.data.type === "INVENTORY_UPDATE" && event.data.state) {
            const incoming = event.data.state as InventoryState;
            if (
              !Array.isArray(incoming.products) ||
              looksLikeLegacyDemoCatalog(incoming.products)
            ) {
              return;
            }
            // Only accept peer updates after we have synced from the DB ourselves.
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

      window.addEventListener("storage", (e) => {
        if (!e.key?.startsWith(`${STORAGE_KEY}:`) || !e.newValue) return;
        if (this.ownerId && e.key !== `${STORAGE_KEY}:${this.ownerId}`) return;
        try {
          const parsed = JSON.parse(e.newValue) as InventoryState;
          if (!Array.isArray(parsed.products)) return;
          if (looksLikeLegacyDemoCatalog(parsed.products)) {
            purgeInventoryStorage();
            return;
          }
          if (!this.hasSyncedOnce) return;
          this.state = {
            products: parsed.products,
            alerts: deriveAlerts(parsed.products),
            metrics: computeMetrics(parsed.products),
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

  /** Bind cache to the signed-in user. Never hydrate unscoped/legacy keys. */
  public bindOwner(userId: string) {
    if (this.ownerId === userId) {
      // Same user — still force a live DB pull so demo caches cannot linger.
      void this.syncFromBackend(true);
      return;
    }
    this.ownerId = userId;
    this.remoteRevision = null;
    this.hasSyncedOnce = false;
    purgeInventoryStorage();
    // Do not show stale local products as truth — start empty until DB sync.
    this.state = emptyState(true);
    this.notify(false);
    void this.syncFromBackend(true);
  }

  private persist() {
    if (typeof window === "undefined" || !this.ownerId || !this.hasSyncedOnce) return;
    const cachePayload: InventoryState = {
      ...this.state,
      booting: false,
      syncError: null,
    };
    writeScopedJson(STORAGE_KEY, this.ownerId, cachePayload);

    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage({
          type: "INVENTORY_UPDATE",
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

  private setMeta(partial: Partial<Pick<InventoryState, "booting" | "syncError">>) {
    this.state = { ...this.state, ...partial };
    this.notify(false);
  }

  public getState(): InventoryState {
    return this.state;
  }

  public getBooting(): boolean {
    return this.state.booting;
  }

  public getSyncError(): string | null {
    return this.state.syncError;
  }

  public subscribe(listener: (state: InventoryState) => void): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public async createProductAsync(payload: InventoryProductPayload) {
    const created = await createInventoryProduct({
      name: payload.name.trim(),
      subtitle: payload.subtitle?.trim() || "",
      sku: payload.sku.trim(),
      category: payload.category || "General",
      stock: Number(payload.stock) || 0,
      price: Number(payload.price) || 0,
      low_stock_threshold: Number(payload.low_stock_threshold) || 15,
      image: payload.image ?? null,
    });
    await this.syncFromBackend(true);
    return mapRemoteProduct(created as Record<string, unknown>);
  }

  public async updateProductAsync(id: string, payload: Partial<InventoryProductPayload>) {
    const body: Record<string, unknown> = {};
    if (payload.name !== undefined) body.name = payload.name.trim();
    if (payload.subtitle !== undefined) body.subtitle = payload.subtitle.trim();
    if (payload.sku !== undefined) body.sku = payload.sku.trim();
    if (payload.category !== undefined) body.category = payload.category;
    if (payload.stock !== undefined) body.stock = Number(payload.stock) || 0;
    if (payload.price !== undefined) body.price = Number(payload.price) || 0;
    if (payload.low_stock_threshold !== undefined) {
      body.low_stock_threshold = Number(payload.low_stock_threshold) || 15;
    }
    if (payload.image !== undefined) body.image = payload.image;
    const updated = await updateInventoryProduct(id, body);
    await this.syncFromBackend(true);
    return mapRemoteProduct(updated as Record<string, unknown>);
  }

  public async deleteProductAsync(id: string) {
    await deleteInventoryProduct(id);
    await this.syncFromBackend(true);
  }

  public async adjustStockAsync(id: string, amount: number, isDelta = true) {
    const updated = await adjustInventoryStock(id, amount, isDelta);
    await this.syncFromBackend(true);
    return mapRemoteProduct(updated as Record<string, unknown>);
  }

  public async importProductsAsync(rows: InventoryProductPayload[]) {
    const products = rows.map((row) => ({
      name: row.name.trim(),
      subtitle: row.subtitle?.trim() || "Imported",
      sku: row.sku.trim(),
      category: row.category || "Others",
      stock: Number(row.stock) || 0,
      price: Number(row.price) || 0,
      low_stock_threshold: Number(row.low_stock_threshold) || 15,
    }));
    const result = await bulkCreateInventoryProducts(products);
    await this.syncFromBackend(true);
    return result.count;
  }

  public async deleteProductsAsync(ids: string[]) {
    const errors: string[] = [];
    for (const id of ids) {
      try {
        await deleteInventoryProduct(id);
      } catch (error) {
        errors.push(error instanceof Error ? error.message : `Failed to delete ${id}`);
      }
    }
    await this.syncFromBackend(true);
    if (errors.length === ids.length) {
      throw new Error(errors[0] || "Failed to delete products.");
    }
  }

  public resetToDefault() {
    removeScopedJson(STORAGE_KEY, this.ownerId);
    if (typeof window !== "undefined") {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {
        /* ignore */
      }
    }
    this.ownerId = null;
    this.remoteRevision = null;
    this.hasSyncedOnce = false;
    this.state = emptyState(true);
    this.notify(false);
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
        const summary = await fetchInventorySummary();
        if (!force && summary.revision === this.remoteRevision && this.hasSyncedOnce) {
          this.setMeta({ booting: false, syncError: null });
          return;
        }
        const remote = await fetchInventoryProducts({ limit: 500 });
        if (!Array.isArray(remote)) {
          throw new Error("Invalid inventory response from server.");
        }
        this.applyRemoteProducts(remote, summary.revision);
        this.setMeta({ booting: false, syncError: null });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Could not load inventory from the server.";
        // Never keep inventing products offline — clear local rows if we have never synced.
        if (!this.hasSyncedOnce) {
          const cached = this.ownerId
            ? readScopedJson<InventoryState>(STORAGE_KEY, this.ownerId)
            : null;
          // Prefer empty over stale local-only invents; only restore if cache looks synced.
          if (cached && Array.isArray(cached.products) && cached.products.length === 0) {
            this.state = {
              products: [],
              alerts: [],
              metrics: emptyMetrics(),
              lastSync: cached.lastSync || new Date().toISOString(),
              booting: false,
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

  private applyRemoteProducts(remote: Array<Record<string, unknown>>, revision: string) {
    const products = remote.map(mapRemoteProduct);
    // Never trust a remote payload that matches the old generated demo catalog.
    const safeProducts = looksLikeLegacyDemoCatalog(products) ? [] : products;
    this.remoteRevision = revision;
    this.state = {
      products: safeProducts,
      alerts: deriveAlerts(safeProducts),
      metrics: computeMetrics(safeProducts),
      lastSync: new Date().toISOString(),
      booting: false,
      syncError: null,
    };
    this.hasSyncedOnce = true;
    this.notify(true);
  }
}

export const inventoryStore = new InventoryStore();
