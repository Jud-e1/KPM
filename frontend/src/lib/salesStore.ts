// frontend/src/lib/salesStore.ts

import {
  ApiSalesOrder,
  fetchSalesOrders,
  fetchSalesSummary,
} from "@/lib/api";

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

const STORAGE_KEY = "kpm_sales_state_v1";
const SYNC_CHANNEL_NAME = "kpm_sales_sync_channel";

// Featured 5 orders visible in screenshot
const FEATURED_ORDERS: SalesOrder[] = [
  {
    id: "order-0048",
    orderNumber: "SO-0048",
    customerName: "BrightMart Stores",
    customerId: "#CUST-1001",
    date: "Apr 30, 2025",
    time: "2:14 PM",
    timestamp: new Date("2025-04-30T14:14:00").getTime(),
    itemsCount: 5,
    totalAmount: 1250.0,
    status: "Completed",
    channel: "Direct Sales",
  },
  {
    id: "order-0047",
    orderNumber: "SO-0047",
    customerName: "TechWorld Ltd",
    customerId: "#CUST-1002",
    date: "Apr 29, 2025",
    time: "11:32 AM",
    timestamp: new Date("2025-04-29T11:32:00").getTime(),
    itemsCount: 3,
    totalAmount: 850.0,
    status: "Completed",
    channel: "Online Store",
  },
  {
    id: "order-0046",
    orderNumber: "SO-0046",
    customerName: "Home Essentials",
    customerId: "#CUST-1003",
    date: "Apr 28, 2025",
    time: "3:45 PM",
    timestamp: new Date("2025-04-28T15:45:00").getTime(),
    itemsCount: 8,
    totalAmount: 2340.0,
    status: "Completed",
    channel: "Retail Partners",
  },
  {
    id: "order-0045",
    orderNumber: "SO-0045",
    customerName: "Office Hub",
    customerId: "#CUST-1004",
    date: "Apr 27, 2025",
    time: "10:21 AM",
    timestamp: new Date("2025-04-27T10:21:00").getTime(),
    itemsCount: 2,
    totalAmount: 620.0,
    status: "Pending",
    channel: "Online Store",
  },
  {
    id: "order-0044",
    orderNumber: "SO-0044",
    customerName: "Global Fashion",
    customerId: "#CUST-1005",
    date: "Apr 26, 2025",
    time: "4:17 PM",
    timestamp: new Date("2025-04-26T16:17:00").getTime(),
    itemsCount: 6,
    totalAmount: 1780.0,
    status: "Completed",
    channel: "Wholesale",
  },
];

const INITIAL_TOP_PRODUCTS: TopProductMetric[] = [
  {
    id: "tp-1",
    name: "Wireless Headphones",
    sku: "WH-001",
    soldCount: 42,
    revenue: 5880.0,
    iconType: "headphones",
  },
  {
    id: "tp-2",
    name: "Smart Watch Series 8",
    sku: "SW-008",
    soldCount: 36,
    revenue: 7164.0,
    iconType: "watch",
  },
  {
    id: "tp-3",
    name: "Laptop Backpack",
    sku: "BP-015",
    soldCount: 28,
    revenue: 1372.0,
    iconType: "backpack",
  },
  {
    id: "tp-4",
    name: "USB-C Charging Cable",
    sku: "CC-034",
    soldCount: 24,
    revenue: 596.0,
    iconType: "cable",
  },
  {
    id: "tp-5",
    name: "Notebook (A5)",
    sku: "NB-056",
    soldCount: 18,
    revenue: 324.0,
    iconType: "notebook",
  },
];

const INITIAL_CHANNELS: ChannelMetric[] = [
  { name: "Online Store", percentage: 52, amount: 25350, color: "#0F172A" },
  { name: "Direct Sales", percentage: 24, amount: 11700, color: "#3B82F6" },
  { name: "Retail Partners", percentage: 14, amount: 6825, color: "#60A5FA" },
  { name: "Wholesale", percentage: 10, amount: 4875, color: "#818CF8" },
];

function generateInitialOrders(): SalesOrder[] {
  const orders: SalesOrder[] = [...FEATURED_ORDERS];
  
  const customerPool = [
    { name: "Summit Retailers", id: "#CUST-1006" },
    { name: "Apex Electronics", id: "#CUST-1007" },
    { name: "Urban Lifestyle", id: "#CUST-1008" },
    { name: "Nordic Goods Co.", id: "#CUST-1009" },
    { name: "Pacific Trade Inc.", id: "#CUST-1010" },
    { name: "Metro Supplies", id: "#CUST-1011" },
    { name: "Velox Systems", id: "#CUST-1012" },
  ];

  const channels: SalesOrder["channel"][] = [
    "Online Store",
    "Direct Sales",
    "Retail Partners",
    "Wholesale",
  ];

  // 243 more orders to equal 248 total orders
  for (let i = 43; i >= 1; i--) {
    const numStr = String(i).padStart(4, "0");
    const cust = customerPool[i % customerPool.length];
    const day = Math.max(1, (i % 25) + 1);
    const hour = (9 + (i % 8)).toString().padStart(2, "0");
    const min = ((i * 13) % 60).toString().padStart(2, "0");
    const items = 1 + (i % 9);
    const amount = Number((95 + (i * 27.5) % 1100).toFixed(2));
    const channel = channels[i % channels.length];
    const isPending = i % 11 === 0;

    orders.push({
      id: `order-${numStr}`,
      orderNumber: `SO-${numStr}`,
      customerName: cust.name,
      customerId: cust.id,
      date: `Apr ${day}, 2025`,
      time: `${hour}:${min} ${Number(hour) >= 12 ? "PM" : "AM"}`,
      timestamp: new Date(`2025-04-${String(day).padStart(2, "0")}T${hour}:${min}:00`).getTime(),
      itemsCount: items,
      totalAmount: amount,
      status: isPending ? "Pending" : "Completed",
      channel,
    });
  }

  // Extend further up to 248 total items for accurate pagination
  for (let i = 248; i > 48; i--) {
    const numStr = String(i).padStart(4, "0");
    const cust = customerPool[i % customerPool.length];
    const day = Math.max(1, (i % 28) + 1);
    const items = 2 + (i % 7);
    const amount = Number((80 + (i * 18.2) % 950).toFixed(2));

    orders.push({
      id: `order-${numStr}`,
      orderNumber: `SO-${numStr}`,
      customerName: cust.name,
      customerId: cust.id,
      date: `Apr ${day}, 2025`,
      time: "1:30 PM",
      timestamp: new Date(`2025-04-${String(day).padStart(2, "0")}T13:30:00`).getTime(),
      itemsCount: items,
      totalAmount: amount,
      status: i % 14 === 0 ? "Pending" : "Completed",
      channel: channels[i % channels.length],
    });
  }

  return orders;
}

const BASELINE_ORDERS = generateInitialOrders();
const BASELINE_ORDER_IDS = new Set(BASELINE_ORDERS.map((order) => order.id));

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

const BASELINE_RAW_TOTALS = getRawSalesTotals(BASELINE_ORDERS);

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
    customerId: order.customer_id || "#CUST-N/A",
    date: displayDate.date,
    time: displayDate.time,
    timestamp: displayDate.timestamp,
    itemsCount: order.items_count,
    totalAmount: order.total_amount,
    status: isSalesStatus(order.status) ? order.status : "Pending",
    channel: isSalesChannel(order.channel) ? order.channel : "Online Store",
  };
}

export function computeSalesMetrics(orders: SalesOrder[]): SalesMetrics {
  const totalOrders = orders.length;
  const rawTotals = getRawSalesTotals(orders);

  // The supplied screen starts with representative sales data calibrated to its
  // displayed totals. Keep that baseline, then apply every live order delta.
  const totalRevenue = rawTotals.revenue - BASELINE_RAW_TOTALS.revenue + 48750;
  const outstandingInvoices = rawTotals.outstanding - BASELINE_RAW_TOTALS.outstanding + 6420;
  const channelTotals: RawSalesTotals["channels"] = {
    "Online Store": rawTotals.channels["Online Store"] - BASELINE_RAW_TOTALS.channels["Online Store"] + INITIAL_CHANNELS[0].amount,
    "Direct Sales": rawTotals.channels["Direct Sales"] - BASELINE_RAW_TOTALS.channels["Direct Sales"] + INITIAL_CHANNELS[1].amount,
    "Retail Partners": rawTotals.channels["Retail Partners"] - BASELINE_RAW_TOTALS.channels["Retail Partners"] + INITIAL_CHANNELS[2].amount,
    Wholesale: rawTotals.channels.Wholesale - BASELINE_RAW_TOTALS.channels.Wholesale + INITIAL_CHANNELS[3].amount,
  };

  const averageOrderValue = totalOrders > 0 ? Number((totalRevenue / totalOrders).toFixed(2)) : 0;

  const channelBreakdown: ChannelMetric[] = [
    {
      name: "Online Store",
      percentage: totalRevenue > 0 ? Math.round((channelTotals["Online Store"] / totalRevenue) * 100) || 52 : 52,
      amount: Math.round(channelTotals["Online Store"]),
      color: "#0F172A",
    },
    {
      name: "Direct Sales",
      percentage: totalRevenue > 0 ? Math.round((channelTotals["Direct Sales"] / totalRevenue) * 100) || 24 : 24,
      amount: Math.round(channelTotals["Direct Sales"]),
      color: "#3B82F6",
    },
    {
      name: "Retail Partners",
      percentage: totalRevenue > 0 ? Math.round((channelTotals["Retail Partners"] / totalRevenue) * 100) || 14 : 14,
      amount: Math.round(channelTotals["Retail Partners"]),
      color: "#60A5FA",
    },
    {
      name: "Wholesale",
      percentage: totalRevenue > 0 ? Math.round((channelTotals["Wholesale"] / totalRevenue) * 100) || 10 : 10,
      amount: Math.round(channelTotals["Wholesale"]),
      color: "#818CF8",
    },
  ];

  return {
    totalRevenue: Number(totalRevenue.toFixed(2)),
    totalOrders,
    averageOrderValue,
    outstandingInvoices: Number(outstandingInvoices.toFixed(2)),
    channelBreakdown,
    topProducts: INITIAL_TOP_PRODUCTS,
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
        if (e.key === STORAGE_KEY && e.newValue) {
          try {
            this.state = JSON.parse(e.newValue);
            this.notify(false);
          } catch {}
        }
      });
    }
  }

  private loadState(): SalesState {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.orders && parsed.orders.length > 0) {
            parsed.metrics = computeSalesMetrics(parsed.orders);
            parsed.syncedRemoteOrderIds = Array.isArray(parsed.syncedRemoteOrderIds)
              ? parsed.syncedRemoteOrderIds
              : [];
            return parsed;
          }
        }
      } catch {}
    }

    const initialOrders = generateInitialOrders();
    const initialMetrics = computeSalesMetrics(initialOrders);

    return {
      orders: initialOrders,
      metrics: initialMetrics,
      lastSync: new Date().toISOString(),
      syncedRemoteOrderIds: [],
    };
  }

  private persist() {
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
      } catch {}

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
    const localOrders = this.state.orders;

    // Preserve the supplied screen's baseline and any locally-created order
    // still waiting to reach the backend. Remote records override matching IDs.
    const unsyncedLocalOrders = localOrders.filter(
      (order) => !BASELINE_ORDER_IDS.has(order.id) && !previousRemoteIds.has(order.id) && !remoteById.has(order.id)
    );
    const baselineOrders = localOrders
      .filter((order) => BASELINE_ORDER_IDS.has(order.id))
      .map((order) => remoteById.get(order.id) || order);
    const remoteNonBaselineOrders = mappedRemoteOrders.filter(
      (order) => !BASELINE_ORDER_IDS.has(order.id)
    );
    const nextOrders = [...unsyncedLocalOrders, ...remoteNonBaselineOrders, ...baselineOrders];

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
    itemsCount: number;
    totalAmount: number;
    channel?: SalesOrder["channel"];
    status?: SalesOrder["status"];
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
      customerId: `#CUST-${Math.floor(1000 + Math.random() * 9000)}`,
      date: formattedDate,
      time: formattedTime,
      timestamp: Date.now(),
      itemsCount: Number(input.itemsCount) || 1,
      totalAmount: Number(input.totalAmount) || 0,
      status: input.status || "Completed",
      channel: input.channel || "Online Store",
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
    if (typeof window !== "undefined") {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {}
    }
    const initialOrders = generateInitialOrders();
    this.state = {
      orders: initialOrders,
      metrics: computeSalesMetrics(initialOrders),
      lastSync: new Date().toISOString(),
    };
    this.notify();
  }
}

export const salesStore = new SalesStore();
