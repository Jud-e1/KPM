// frontend/src/lib/salesStore.ts

import {
  ApiSalesOrder,
  fetchSalesOrders,
  fetchSalesSummary,
} from "@/lib/api";
import {
  readScopedJson,
  removeScopedJson,
  writeScopedJson,
} from "@/lib/storePersistence";

export interface SalesOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  customerId: string;
  date: string;
  time: string;
  timestamp: number;
  itemsCount: number;
  totalAmount: number;
  status: "Completed" | "Pending" | "Processing" | "Cancelled";
  channel: "Online Store" | "Direct Sales" | "Retail Partners" | "Wholesale";
  lines?: Array<{
    productId: string | null;
    sku: string;
    productName: string;
    qty: number;
    unitPrice: number;
    lineTotal: number;
  }>;
}

export interface ChannelMetric {
  name: "Online Store" | "Direct Sales" | "Retail Partners" | "Wholesale";
  percentage: number;
  amount: number;
  color: string;
}

export interface TopProductMetric {
  id: string;
  name: string;
  sku: string;
  soldCount: number;
  revenue: number;
  iconType: "headphones" | "watch" | "backpack" | "cable" | "notebook";
}

export interface SalesMetrics {
  totalRevenue: number;
  totalOrders: number;
  averageOrderValue: number;
  outstandingInvoices: number;
  channelBreakdown: ChannelMetric[];
  topProducts: TopProductMetric[];
}

export interface SalesState {
  orders: SalesOrder[];
  metrics: SalesMetrics;
  lastSync: string;
  syncedRemoteOrderIds?: string[];
}

const STORAGE_KEY = "kpm_sales_state_v2";
const SYNC_CHANNEL_NAME = "kpm_sales_sync_channel";

function emptySalesMetrics(): SalesMetrics {
  return {
    totalRevenue: 0,
    totalOrders: 0,
    averageOrderValue: 0,
    outstandingInvoices: 0,
    channelBreakdown: [
      { name: "Online Store", percentage: 0, amount: 0, color: "#121417" },
      { name: "Direct Sales", percentage: 0, amount: 0, color: "#5c6570" },
      { name: "Retail Partners", percentage: 0, amount: 0, color: "#8b939e" },
      { name: "Wholesale", percentage: 0, amount: 0, color: "#d5d8de" },
    ],
    topProducts: [],
  };
}

type RawSalesTotals = {
  revenue: number;
  outstanding: number;
  channels: Record<SalesOrder["channel"], number>;
};

function getRawSalesTotals(orders: SalesOrder[]): RawSalesTotals {
  const channels: RawSalesTotals["channels"] = {
    "Online Store": 0,
    "Direct Sales": 0,
    "Retail Partners": 0,
    Wholesale: 0,
  };
  let revenue = 0;
  let outstanding = 0;

  for (const order of orders) {
    if (order.status !== "Cancelled") {
      revenue += order.totalAmount;
      channels[order.channel] += order.totalAmount;
    }
    if (order.status === "Pending") {
      outstanding += order.totalAmount;
    }
  }

  return { revenue, outstanding, channels };
}

function isSalesStatus(value: string): value is SalesOrder["status"] {
  return ["Completed", "Pending", "Processing", "Cancelled"].includes(value);
}

function isSalesChannel(value: string): value is SalesOrder["channel"] {
  return ["Online Store", "Direct Sales", "Retail Partners", "Wholesale"].includes(value);
}

function formatBackendDate(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return { date: "", time: "", timestamp: 0 };
  }

  return {
    date: new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(parsed),
    time: new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
    }).format(parsed),
    timestamp: parsed.getTime(),
  };
}

function mapBackendOrder(order: ApiSalesOrder): SalesOrder {
  const displayDate = formatBackendDate(order.order_date || order.created_at);
  return {
    id: order.id,
    orderNumber: order.order_number,
    customerName: order.customer_name,
    customerId: order.customer_id || "",
    date: displayDate.date,
    time: displayDate.time,
    timestamp: displayDate.timestamp,
    itemsCount: order.items_count,
    totalAmount: order.total_amount,
    status: isSalesStatus(order.status) ? order.status : "Pending",
    channel: isSalesChannel(order.channel) ? order.channel : "Online Store",
    lines: (order.lines || []).map((line) => ({
      productId: line.product_id,
      sku: line.sku,
      productName: line.product_name,
      qty: line.qty,
      unitPrice: line.unit_price,
      lineTotal: line.line_total,
    })),
  };
}

export function computeSalesMetrics(orders: SalesOrder[]): SalesMetrics {
  if (!orders.length) return emptySalesMetrics();

  const totalOrders = orders.length;
  const rawTotals = getRawSalesTotals(orders);
  const totalRevenue = rawTotals.revenue;
  const outstandingInvoices = rawTotals.outstanding;
  const averageOrderValue = totalOrders > 0 ? Number((totalRevenue / totalOrders).toFixed(2)) : 0;

  const channelBreakdown: ChannelMetric[] = (
    [
      ["Online Store", "#121417"],
      ["Direct Sales", "#5c6570"],
      ["Retail Partners", "#8b939e"],
      ["Wholesale", "#d5d8de"],
    ] as const
  ).map(([name, color]) => {
    const amount = rawTotals.channels[name];
    return {
      name,
      percentage: totalRevenue > 0 ? Math.round((amount / totalRevenue) * 100) : 0,
      amount: Math.round(amount),
      color,
    };
  });

  const productMap = new Map<string, TopProductMetric>();
  for (const order of orders) {
    if (order.status === "Cancelled") continue;
    const lines = order.lines || [];
    if (lines.length) {
      for (const line of lines) {
        const key = line.sku || line.productName;
        const existing = productMap.get(key);
        const revenue = line.lineTotal || line.qty * line.unitPrice;
        if (existing) {
          existing.soldCount += line.qty;
          existing.revenue = Number((existing.revenue + revenue).toFixed(2));
        } else {
          productMap.set(key, {
            id: line.productId || key,
            name: line.productName || line.sku,
            sku: line.sku,
            soldCount: line.qty,
            revenue: Number(revenue.toFixed(2)),
            iconType: "notebook",
          });
        }
      }
    }
  }

  const topProducts: TopProductMetric[] = [...productMap.values()]
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5)
    .map((item, index) => ({
      ...item,
      iconType: (["headphones", "watch", "backpack", "cable", "notebook"] as const)[index % 5],
    }));

  return {
    totalRevenue: Number(totalRevenue.toFixed(2)),
    totalOrders,
    averageOrderValue,
    outstandingInvoices: Number(outstandingInvoices.toFixed(2)),
    channelBreakdown,
    topProducts,
  };
}

class SalesStore {
  private state: SalesState;
  private listeners: Set<(state: SalesState) => void> = new Set();
  private broadcastChannel: BroadcastChannel | null = null;
  private remoteRevision: string | null = null;
  private syncPromise: Promise<void> | null = null;
  private liveConnectionCount = 0;
  private liveSyncTimer: number | null = null;
  private visibilityHandler: (() => void) | null = null;

  constructor() {
    this.state = this.loadState();

    if (typeof window !== "undefined") {
      try {
        this.broadcastChannel = new BroadcastChannel(SYNC_CHANNEL_NAME);
        this.broadcastChannel.onmessage = (e) => {
          if (e.data && e.data.type === "SALES_UPDATE") {
            this.state = e.data.state;
            this.notify(false);
          }
        };
      } catch {}

      window.addEventListener("storage", (e) => {
        if (!e.key?.startsWith(`${STORAGE_KEY}:`) || !e.newValue) return;
        if (this.ownerId && e.key !== `${STORAGE_KEY}:${this.ownerId}`) return;
        try {
          this.state = JSON.parse(e.newValue);
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

  private loadState(): SalesState {
    return {
      orders: [],
      metrics: emptySalesMetrics(),
      lastSync: new Date().toISOString(),
      syncedRemoteOrderIds: [],
    };
  }

  private loadStateFor(userId: string): SalesState {
    const parsed = readScopedJson<SalesState>(STORAGE_KEY, userId);
    if (parsed && Array.isArray(parsed.orders)) {
      return {
        ...parsed,
        metrics: computeSalesMetrics(parsed.orders),
        syncedRemoteOrderIds: Array.isArray(parsed.syncedRemoteOrderIds)
          ? parsed.syncedRemoteOrderIds
          : [],
      };
    }
    return this.loadState();
  }

  private persist() {
    if (typeof window !== "undefined") {
      writeScopedJson(STORAGE_KEY, this.ownerId, this.state);
      if (this.broadcastChannel) {
        try {
          this.broadcastChannel.postMessage({
            type: "SALES_UPDATE",
            state: this.state,
          });
        } catch {}
      }
    }
  }

  private notify(broadcast = true) {
    this.listeners.forEach((l) => l(this.state));
    if (broadcast) {
      this.persist();
    }
  }

  public getState(): SalesState {
    return this.state;
  }

  public subscribe(listener: (state: SalesState) => void): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Keeps a mounted sales surface fresh. The summary request is intentionally
   * tiny; full order data is fetched only when the backend revision changes.
   */
  public connectLive(): () => void {
    if (typeof window === "undefined") return () => undefined;

    this.liveConnectionCount += 1;
    if (this.liveConnectionCount === 1) {
      void this.syncFromBackend(true);
      this.liveSyncTimer = window.setInterval(() => {
        if (document.visibilityState === "visible") {
          void this.syncFromBackend();
        }
      }, 4000);
      this.visibilityHandler = () => {
        if (document.visibilityState === "visible") {
          void this.syncFromBackend();
        }
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
      try {
        const summary = await fetchSalesSummary();
        if (!force && summary.revision === this.remoteRevision) return;

        const remoteOrders = await fetchSalesOrders({ limit: 500 });
        this.reconcileBackendOrders(remoteOrders, summary.revision);
      } catch {
        // Offline use remains responsive via the local store. The next live
        // check retries automatically without surfacing a disruptive UI change.
      } finally {
        this.syncPromise = null;
      }
    })();

    return this.syncPromise;
  }

  public markOrderSynced(orderId: string) {
    const syncedRemoteOrderIds = new Set(this.state.syncedRemoteOrderIds || []);
    if (syncedRemoteOrderIds.has(orderId)) return;
    syncedRemoteOrderIds.add(orderId);
    this.state = { ...this.state, syncedRemoteOrderIds: [...syncedRemoteOrderIds] };
    this.notify();
  }

  private reconcileBackendOrders(remoteOrders: ApiSalesOrder[], revision: string) {
    const mappedRemoteOrders = remoteOrders.map(mapBackendOrder);
    const remoteById = new Map(mappedRemoteOrders.map((order) => [order.id, order]));
    const previousRemoteIds = new Set(this.state.syncedRemoteOrderIds || []);
    const unsyncedLocalOrders = this.state.orders.filter(
      (order) => !previousRemoteIds.has(order.id) && !remoteById.has(order.id)
    );
    const nextOrders = [...unsyncedLocalOrders, ...mappedRemoteOrders];

    this.remoteRevision = revision;
    this.state = {
      orders: nextOrders,
      metrics: computeSalesMetrics(nextOrders),
      lastSync: new Date().toISOString(),
      syncedRemoteOrderIds: mappedRemoteOrders.map((order) => order.id),
    };
    this.notify();
  }

  public createOrder(input: {
    customerName: string;
    customerId?: string;
    itemsCount: number;
    totalAmount: number;
    channel?: SalesOrder["channel"];
    status?: SalesOrder["status"];
    lines?: SalesOrder["lines"];
  }): SalesOrder {
    const nextNum = (this.state.orders.length + 1).toString().padStart(4, "0");
    const now = new Date();
    const formattedDate = new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(now);
    const formattedTime = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    const newOrder: SalesOrder = {
      id: `order-${Date.now()}`,
      orderNumber: `SO-${nextNum}`,
      customerName: input.customerName.trim(),
      customerId: input.customerId?.trim() || "",
      date: formattedDate,
      time: formattedTime,
      timestamp: Date.now(),
      itemsCount: Number(input.itemsCount) || 1,
      totalAmount: Number(input.totalAmount) || 0,
      status: input.status || "Completed",
      channel: input.channel || "Online Store",
      lines: input.lines,
    };

    const newOrders = [newOrder, ...this.state.orders];
    const newMetrics = computeSalesMetrics(newOrders);

    this.state = {
      ...this.state,
      orders: newOrders,
      metrics: newMetrics,
      lastSync: new Date().toISOString(),
    };

    this.notify();
    return newOrder;
  }

  public updateOrderStatus(orderId: string, status: SalesOrder["status"]): SalesOrder | null {
    const idx = this.state.orders.findIndex((o) => o.id === orderId);
    if (idx === -1) return null;

    const updated = {
      ...this.state.orders[idx],
      status,
    };

    const newOrders = [...this.state.orders];
    newOrders[idx] = updated;
    const newMetrics = computeSalesMetrics(newOrders);

    this.state = {
      ...this.state,
      orders: newOrders,
      metrics: newMetrics,
      lastSync: new Date().toISOString(),
    };

    this.notify();
    return updated;
  }

  public deleteOrder(orderId: string): boolean {
    const newOrders = this.state.orders.filter((o) => o.id !== orderId);
    if (newOrders.length === this.state.orders.length) return false;

    this.state = {
      ...this.state,
      orders: newOrders,
      metrics: computeSalesMetrics(newOrders),
      lastSync: new Date().toISOString(),
    };

    this.notify();
    return true;
  }

  public exportOrdersCSV(): string {
    const headers = ["Order #", "Customer", "Customer ID", "Date", "Time", "Items", "Amount", "Status", "Channel"];
    const rows = this.state.orders.map((o) => [
      o.orderNumber,
      `"${o.customerName}"`,
      o.customerId,
      o.date,
      o.time,
      o.itemsCount,
      o.totalAmount.toFixed(2),
      o.status,
      o.channel,
    ]);

    return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
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
      orders: [],
      metrics: emptySalesMetrics(),
      lastSync: new Date().toISOString(),
      syncedRemoteOrderIds: [],
    };
    this.notify();
  }
}

export const salesStore = new SalesStore();
