import { SystemHealth, Item, ItemCreateInput, ItemUpdateInput } from "@/types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api/v1";

export async function fetchHealth(): Promise<SystemHealth> {
  try {
    const res = await fetch(`${API_BASE}/health`, {
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }
    return await res.json();
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to connect to backend";
    return {
      status: "offline",
      app_name: "KPM Backend",
      environment: "unknown",
      database: {
        status: "unreachable",
        connected: false,
        message: message,
      },
    };
  }
}

export async function fetchItems(params?: {
  status?: string;
  search?: string;
  skip?: number;
  limit?: number;
}): Promise<Item[]> {
  const query = new URLSearchParams();
  if (params?.status && params.status !== "all") query.append("status", params.status);
  if (params?.search) query.append("search", params.search);
  if (params?.skip !== undefined) query.append("skip", String(params.skip));
  if (params?.limit !== undefined) query.append("limit", String(params.limit));

  const url = `${API_BASE}/items/?${query.toString()}`;
  const res = await fetch(url, {
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(5000),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(errorData.detail || `Failed to fetch items: ${res.status}`);
  }

  return await res.json();
}

export async function createItem(data: ItemCreateInput): Promise<Item> {
  const res = await fetch(`${API_BASE}/items/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(errorData.detail || `Failed to create item: ${res.status}`);
  }

  return await res.json();
}

export async function updateItem(id: number, data: ItemUpdateInput): Promise<Item> {
  const res = await fetch(`${API_BASE}/items/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(errorData.detail || `Failed to update item: ${res.status}`);
  }

  return await res.json();
}

export async function deleteItem(id: number): Promise<{ message: string; id: number }> {
  const res = await fetch(`${API_BASE}/items/${id}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(errorData.detail || `Failed to delete item: ${res.status}`);
  }

  return await res.json();
}

// Inventory Product Backend API Integration
export async function fetchInventoryProducts(params?: {
  status?: string;
  category?: string;
  search?: string;
  skip?: number;
  limit?: number;
}) {
  const query = new URLSearchParams();
  if (params?.status && params.status !== "all") query.append("status", params.status);
  if (params?.category && params.category !== "all") query.append("category", params.category);
  if (params?.search) query.append("search", params.search);
  if (params?.skip !== undefined) query.append("skip", String(params.skip));
  if (params?.limit !== undefined) query.append("limit", String(params.limit));

  const res = await fetch(`${API_BASE}/inventory/?${query.toString()}`, {
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(4000),
  });
  if (!res.ok) throw new Error(`Failed to fetch inventory: ${res.status}`);
  return await res.json();
}

export async function createInventoryProduct(data: unknown) {
  const res = await fetch(`${API_BASE}/inventory/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
    signal: AbortSignal.timeout(4000),
  });
  if (!res.ok) throw new Error(`Failed to create product: ${res.status}`);
  return await res.json();
}

export async function updateInventoryProduct(id: string, updates: unknown) {
  const res = await fetch(`${API_BASE}/inventory/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
    signal: AbortSignal.timeout(4000),
  });
  if (!res.ok) throw new Error(`Failed to update product: ${res.status}`);
  return await res.json();
}

export async function adjustInventoryStock(id: string, amount: number, isDelta = true) {
  const res = await fetch(`${API_BASE}/inventory/${id}/adjust-stock`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ amount, is_delta: isDelta }),
    signal: AbortSignal.timeout(4000),
  });
  if (!res.ok) throw new Error(`Failed to adjust stock: ${res.status}`);
  return await res.json();
}

export async function deleteInventoryProduct(id: string) {
  const res = await fetch(`${API_BASE}/inventory/${id}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(4000),
  });
  if (!res.ok) throw new Error(`Failed to delete product: ${res.status}`);
  return await res.json();
}

// Sales Orders Backend API Integration
export interface ApiSalesOrder {
  id: string;
  order_number: string;
  customer_name: string;
  customer_id: string | null;
  items_count: number;
  total_amount: number;
  status: string;
  channel: string;
  order_date: string;
  created_at: string;
  updated_at: string;
}

export interface SalesSummary {
  revision: string;
  total_orders: number;
  total_revenue: number;
  outstanding_invoices: number;
}

export interface SalesOrderPayload {
  id?: string;
  order_number: string;
  customer_name: string;
  customer_id?: string | null;
  items_count: number;
  total_amount: number;
  status: string;
  channel: string;
}

export async function fetchSalesOrders(params?: {
  status?: string;
  channel?: string;
  search?: string;
  skip?: number;
  limit?: number;
}): Promise<ApiSalesOrder[]> {
  const query = new URLSearchParams();
  if (params?.status && params.status !== "all") query.append("status", params.status);
  if (params?.channel && params.channel !== "all") query.append("channel", params.channel);
  if (params?.search) query.append("search", params.search);
  if (params?.skip !== undefined) query.append("skip", String(params.skip));
  if (params?.limit !== undefined) query.append("limit", String(params.limit));

  const res = await fetch(`${API_BASE}/sales/?${query.toString()}`, {
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(4000),
  });
  if (!res.ok) throw new Error(`Failed to fetch sales: ${res.status}`);
  return await res.json();
}

export async function fetchSalesSummary(): Promise<SalesSummary> {
  const res = await fetch(`${API_BASE}/sales/summary`, {
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(4000),
  });
  if (!res.ok) throw new Error(`Failed to fetch sales summary: ${res.status}`);
  return await res.json();
}

export async function createSalesOrder(data: SalesOrderPayload): Promise<ApiSalesOrder> {
  const res = await fetch(`${API_BASE}/sales/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
    signal: AbortSignal.timeout(4000),
  });
  if (!res.ok) throw new Error(`Failed to create order: ${res.status}`);
  return await res.json();
}

export async function updateSalesOrderStatus(id: string, status: string): Promise<ApiSalesOrder> {
  const res = await fetch(`${API_BASE}/sales/${id}/status`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
    signal: AbortSignal.timeout(4000),
  });
  if (!res.ok) throw new Error(`Failed to update order status: ${res.status}`);
  return await res.json();
}

// Accounting Backend API Integration
export interface ApiAccountingTransaction {
  id: string;
  transaction_date: string;
  description: string;
  reference: string | null;
  counterparty: string | null;
  category: string;
  account: string;
  transaction_type: string;
  amount: number;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface AccountingSummary {
  revision: string;
  transactions_revision?: string;
  profile_revision?: string;
  activities_revision?: string;
  total_transactions: number;
  income: number;
  expenses: number;
  pending_amount: number;
}

export interface ApiAccountingActivity {
  id: string;
  title: string;
  subtitle: string | null;
  time: string;
  timestamp: number;
  tone: string;
}

export interface AccountingProfile {
  id: string;
  full_name: string;
  role: string;
  organization: string;
  auto_reconciliation: boolean;
  notifications_enabled: boolean;
  updated_at: string;
}

export interface AccountingTransactionPayload {
  id?: string;
  transaction_date?: string;
  description: string;
  reference?: string | null;
  counterparty?: string | null;
  category: string;
  account: string;
  transaction_type: string;
  amount: number;
  status: string;
}

export async function fetchAccountingTransactions(params?: {
  transactionType?: string;
  category?: string;
  search?: string;
  skip?: number;
  limit?: number;
}): Promise<ApiAccountingTransaction[]> {
  const query = new URLSearchParams();
  if (params?.transactionType && params.transactionType !== "all") query.append("transaction_type", params.transactionType);
  if (params?.category && params.category !== "all") query.append("category", params.category);
  if (params?.search) query.append("search", params.search);
  if (params?.skip !== undefined) query.append("skip", String(params.skip));
  if (params?.limit !== undefined) query.append("limit", String(params.limit));

  const res = await fetch(`${API_BASE}/accounting/?${query.toString()}`, {
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(4000),
  });
  if (!res.ok) throw new Error(`Failed to fetch transactions: ${res.status}`);
  return await res.json();
}

export async function fetchAccountingSummary(): Promise<AccountingSummary> {
  const res = await fetch(`${API_BASE}/accounting/summary`, {
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(4000),
  });
  if (!res.ok) throw new Error(`Failed to fetch accounting summary: ${res.status}`);
  return await res.json();
}

export async function fetchAccountingProfile(): Promise<AccountingProfile> {
  const res = await fetch(`${API_BASE}/accounting/profile`, {
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(4000),
  });
  if (!res.ok) throw new Error(`Failed to fetch accounting profile: ${res.status}`);
  return await res.json();
}

export async function updateAccountingProfile(
  updates: Partial<Omit<AccountingProfile, "id" | "updated_at">>
): Promise<AccountingProfile> {
  const res = await fetch(`${API_BASE}/accounting/profile`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
    signal: AbortSignal.timeout(4000),
  });
  if (!res.ok) throw new Error(`Failed to update accounting profile: ${res.status}`);
  return await res.json();
}

export async function createAccountingTransaction(data: AccountingTransactionPayload): Promise<ApiAccountingTransaction> {
  const res = await fetch(`${API_BASE}/accounting/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
    signal: AbortSignal.timeout(4000),
  });
  if (!res.ok) throw new Error(`Failed to create transaction: ${res.status}`);
  return await res.json();
}

export async function updateAccountingTransaction(
  id: string,
  updates: Partial<AccountingTransactionPayload>
): Promise<ApiAccountingTransaction> {
  const res = await fetch(`${API_BASE}/accounting/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
    signal: AbortSignal.timeout(4000),
  });
  if (!res.ok) throw new Error(`Failed to update transaction: ${res.status}`);
  return await res.json();
}

export async function fetchAccountingActivities(limit = 12): Promise<ApiAccountingActivity[]> {
  const res = await fetch(`${API_BASE}/accounting/activities?limit=${limit}`, {
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(4000),
  });
  if (!res.ok) throw new Error(`Failed to fetch accounting activity: ${res.status}`);
  return await res.json();
}

export async function createAccountingActivity(data: ApiAccountingActivity): Promise<ApiAccountingActivity> {
  const res = await fetch(`${API_BASE}/accounting/activities`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
    signal: AbortSignal.timeout(4000),
  });
  if (!res.ok) throw new Error(`Failed to record accounting activity: ${res.status}`);
  return await res.json();
}
