import { SystemHealth, Item, ItemCreateInput, ItemUpdateInput } from "@/types";
import type { AuthUser } from "@/lib/authStore";

const configuredApi = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "");
const localApi = configuredApi || "http://127.0.0.1:8000/api/v1";

function isLoopback(url: string) {
  return url.includes("://127.0.0.1") || url.includes("://localhost");
}

function resolveApiBase() {
  if (typeof window === "undefined") return localApi;
  if (configuredApi && !isLoopback(configuredApi)) return configuredApi;
  return "/api/v1";
}

/** Browser calls stay on this site. Next rewrites /api/v1 to the real backend. */
const API_BASE = resolveApiBase();

function authHeaders(extra?: HeadersInit): HeadersInit {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("kpm_auth_token");
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  return { ...headers, ...(extra || {}) };
}

async function readError(res: Response, fallback: string) {
  if (res.status === 401) {
    const errorData = await res.json().catch(() => ({ detail: "" }));
    const detail = typeof errorData.detail === "string" ? errorData.detail : "";
    const lostSession = !detail || /token|not authenticated|inactive|not found/i.test(detail);
    if (lostSession && typeof window !== "undefined") {
      try {
        localStorage.removeItem("kpm_auth_token");
        localStorage.removeItem("kpm_auth_user");
      } catch {
        /* ignore */
      }
      const next = encodeURIComponent(window.location.pathname || "/dashboard");
      if (!window.location.pathname.startsWith("/signin") && !window.location.pathname.startsWith("/signup")) {
        window.location.href = `/signin?next=${next}`;
      }
    }
    if (detail && !lostSession) return detail;
    return "Session expired. Please sign in again.";
  }
  if (res.status === 409) {
    const errorData = await res.json().catch(() => ({ detail: res.statusText }));
    const detail = errorData.detail;
    if (typeof detail === "string") return detail;
    return "That record already exists. Try a different name or ID.";
  }
  const errorData = await res.json().catch(() => ({ detail: res.statusText }));
  const detail = errorData.detail;
  if (typeof detail === "string") return detail;
  return fallback;
}

export async function fetchHealth(): Promise<SystemHealth> {
  try {
    const res = await fetch(`${API_BASE}/health`, {
      cache: "no-store",
      headers: authHeaders(),
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
    headers: authHeaders(),
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
    headers: authHeaders(),
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
    headers: authHeaders(),
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
    headers: authHeaders(),
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
    headers: authHeaders(),
    signal: AbortSignal.timeout(4000),
  });
  if (!res.ok) throw new Error(`Failed to fetch inventory: ${res.status}`);
  return await res.json();
}

export async function createInventoryProduct(data: unknown) {
  // Never send a client-generated id — the backend assigns one.
  const body =
    data && typeof data === "object"
      ? (() => {
          const { id: _omit, ...rest } = data as Record<string, unknown>;
          return rest;
        })()
      : data;
  const res = await fetch(`${API_BASE}/inventory/`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ detail: res.statusText }));
    const detail = errorData.detail;
    throw new Error(typeof detail === "string" ? detail : `Failed to create product: ${res.status}`);
  }
  return await res.json();
}

export async function bulkCreateInventoryProducts(
  products: Array<Record<string, unknown>>
): Promise<{ created: unknown[]; count: number }> {
  const cleaned = products.map((row) => {
    const { id: _omit, ...rest } = row;
    return rest;
  });
  const res = await fetch(`${API_BASE}/inventory/bulk`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ products: cleaned }),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ detail: res.statusText }));
    const detail = errorData.detail;
    throw new Error(typeof detail === "string" ? detail : `Failed to import products: ${res.status}`);
  }
  return await res.json();
}

export async function updateInventoryProduct(id: string, updates: unknown) {
  const res = await fetch(`${API_BASE}/inventory/${id}`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify(updates),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ detail: res.statusText }));
    const detail = errorData.detail;
    throw new Error(typeof detail === "string" ? detail : `Failed to update product: ${res.status}`);
  }
  return await res.json();
}

export async function adjustInventoryStock(id: string, amount: number, isDelta = true) {
  const res = await fetch(`${API_BASE}/inventory/${id}/adjust-stock`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ amount, is_delta: isDelta }),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ detail: res.statusText }));
    const detail = errorData.detail;
    throw new Error(typeof detail === "string" ? detail : `Failed to adjust stock: ${res.status}`);
  }
  return await res.json();
}

export async function deleteInventoryProduct(id: string) {
  const res = await fetch(`${API_BASE}/inventory/${id}`, {
    method: "DELETE",
    headers: authHeaders(),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ detail: res.statusText }));
    const detail = errorData.detail;
    throw new Error(typeof detail === "string" ? detail : `Failed to delete product: ${res.status}`);
  }
  return await res.json();
}

// Sales Orders Backend API Integration
export interface ApiSalesOrderLine {
  id: string;
  order_id: string;
  product_id: string | null;
  sku: string;
  product_name: string;
  qty: number;
  unit_price: number;
  line_total: number;
}

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
  invoice_number?: string | null;
  posted_at?: string | null;
  lines?: ApiSalesOrderLine[];
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
  lines?: Array<{
    product_id?: string | null;
    sku?: string;
    product_name?: string;
    qty: number;
    unit_price?: number;
  }>;
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
    headers: authHeaders(),
    signal: AbortSignal.timeout(4000),
  });
  if (!res.ok) throw new Error(`Failed to fetch sales: ${res.status}`);
  return await res.json();
}

export async function fetchSalesSummary(): Promise<SalesSummary> {
  const res = await fetch(`${API_BASE}/sales/summary`, {
    cache: "no-store",
    headers: authHeaders(),
    signal: AbortSignal.timeout(4000),
  });
  if (!res.ok) throw new Error(`Failed to fetch sales summary: ${res.status}`);
  return await res.json();
}

export async function createSalesOrder(data: SalesOrderPayload): Promise<ApiSalesOrder> {
  const res = await fetch(`${API_BASE}/sales/`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(data),
    signal: AbortSignal.timeout(4000),
  });
  if (!res.ok) throw new Error(`Failed to create order: ${res.status}`);
  return await res.json();
}

export async function updateSalesOrderStatus(id: string, status: string): Promise<ApiSalesOrder> {
  const res = await fetch(`${API_BASE}/sales/${id}/status`, {
    method: "PUT",
    headers: authHeaders(),
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
    headers: authHeaders(),
    signal: AbortSignal.timeout(4000),
  });
  if (!res.ok) throw new Error(`Failed to fetch transactions: ${res.status}`);
  return await res.json();
}

export async function fetchAccountingSummary(): Promise<AccountingSummary> {
  const res = await fetch(`${API_BASE}/accounting/summary`, {
    cache: "no-store",
    headers: authHeaders(),
    signal: AbortSignal.timeout(4000),
  });
  if (!res.ok) throw new Error(`Failed to fetch accounting summary: ${res.status}`);
  return await res.json();
}

export async function fetchAccountingProfile(): Promise<AccountingProfile> {
  const res = await fetch(`${API_BASE}/accounting/profile`, {
    cache: "no-store",
    headers: authHeaders(),
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
    headers: authHeaders(),
    body: JSON.stringify(updates),
    signal: AbortSignal.timeout(4000),
  });
  if (!res.ok) throw new Error(`Failed to update accounting profile: ${res.status}`);
  return await res.json();
}

export async function createAccountingTransaction(data: AccountingTransactionPayload): Promise<ApiAccountingTransaction> {
  const res = await fetch(`${API_BASE}/accounting/`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(data),
    signal: AbortSignal.timeout(4000),
  });
  if (!res.ok) throw new Error(`Failed to create transaction: ${res.status}`);
  return await res.json();
}

export async function importAccountingCsv(file: File): Promise<{ imported: number; skipped: number; message: string }> {
  const form = new FormData();
  form.append("file", file);
  const headers: Record<string, string> = {};
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("kpm_auth_token");
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  const res = await fetch(`${API_BASE}/accounting/import-csv`, {
    method: "POST",
    headers,
    body: form,
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(await readError(res, "Failed to import CSV"));
  return await res.json();
}

export async function updateAccountingTransaction(
  id: string,
  updates: Partial<AccountingTransactionPayload>
): Promise<ApiAccountingTransaction> {
  const res = await fetch(`${API_BASE}/accounting/${id}`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify(updates),
    signal: AbortSignal.timeout(4000),
  });
  if (!res.ok) throw new Error(`Failed to update transaction: ${res.status}`);
  return await res.json();
}

export async function fetchAccountingActivities(limit = 12): Promise<ApiAccountingActivity[]> {
  const res = await fetch(`${API_BASE}/accounting/activities?limit=${limit}`, {
    cache: "no-store",
    headers: authHeaders(),
    signal: AbortSignal.timeout(4000),
  });
  if (!res.ok) throw new Error(`Failed to fetch accounting activity: ${res.status}`);
  return await res.json();
}

export async function createAccountingActivity(data: ApiAccountingActivity): Promise<ApiAccountingActivity> {
  const res = await fetch(`${API_BASE}/accounting/activities`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(data),
    signal: AbortSignal.timeout(4000),
  });
  if (!res.ok) throw new Error(`Failed to record accounting activity: ${res.status}`);
  return await res.json();
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------
export type AuthTokenResponse = {
  access_token: string;
  token_type: string;
  user: AuthUser;
};

export async function signupAccount(input: {
  email: string;
  password: string;
  full_name: string;
  organization?: string;
  business_type?: string;
  invite_token?: string;
}): Promise<AuthTokenResponse> {
  const res = await fetch(`${API_BASE}/auth/signup`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(input),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(await readError(res, "Signup failed"));
  return await res.json();
}

export async function signinAccount(input: {
  email: string;
  password: string;
}): Promise<AuthTokenResponse> {
  const res = await fetch(`${API_BASE}/auth/signin`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(input),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(await readError(res, "Sign in failed"));
  return await res.json();
}

export async function requestPasswordReset(email: string): Promise<void> {
  const res = await fetch(`${API_BASE}/auth/forgot-password`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ email }),
  });
  if (!res.ok) throw new Error(await readError(res, "Could not send reset email"));
}

export async function confirmPasswordReset(token: string, password: string): Promise<void> {
  const res = await fetch(`${API_BASE}/auth/reset-password`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ token, password }),
  });
  if (!res.ok) throw new Error(await readError(res, "Could not reset password"));
}

export async function verifyEmailToken(token: string): Promise<void> {
  const res = await fetch(`${API_BASE}/auth/verify-email`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ token }),
  });
  if (!res.ok) throw new Error(await readError(res, "Could not verify email"));
}

export async function resendVerificationEmail(): Promise<void> {
  const res = await fetch(`${API_BASE}/auth/verify-email/send`, {
    method: "POST",
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(await readError(res, "Could not send verification email"));
}

export async function startGrowthCheckout(interval: "month" | "year"): Promise<string> {
  const res = await fetch(`${API_BASE}/billing/checkout`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ interval }),
  });
  if (!res.ok) throw new Error(await readError(res, "Checkout is unavailable"));
  const data = (await res.json()) as { url: string };
  return data.url;
}

export async function openBillingPortal(): Promise<string> {
  const res = await fetch(`${API_BASE}/billing/portal`, {
    method: "POST",
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(await readError(res, "Billing portal is unavailable"));
  const data = (await res.json()) as { url: string };
  return data.url;
}

export async function startConnectorOAuth(providerId: string, shop?: string): Promise<string | null> {
  const query = shop ? `?shop=${encodeURIComponent(shop)}` : "";
  const res = await fetch(`${API_BASE}/onboarding/oauth/${providerId}/start${query}`, {
    headers: authHeaders(),
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(await readError(res, "Could not start sign-in"));
  const data = (await res.json()) as { url: string };
  return data.url;
}

export async function inviteTeammate(email: string, role: string): Promise<void> {
  const res = await fetch(`${API_BASE}/team/invites`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ email, role }),
  });
  if (!res.ok) throw new Error(await readError(res, "Could not send invite"));
}

export async function acceptTeamInvite(token: string): Promise<void> {
  const res = await fetch(`${API_BASE}/team/invites/accept`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ token }),
  });
  if (!res.ok) throw new Error(await readError(res, "Could not accept invite"));
}

export async function googleAuth(idToken: string): Promise<AuthTokenResponse> {
  const res = await fetch(`${API_BASE}/auth/google`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ id_token: idToken }),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(await readError(res, "Google sign-in failed"));
  return await res.json();
}

export async function fetchMe(): Promise<AuthUser> {
  const res = await fetch(`${API_BASE}/auth/me`, {
    cache: "no-store",
    headers: authHeaders(),
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error(await readError(res, "Session expired"));
  return await res.json();
}

export async function updateMe(updates: {
  full_name?: string;
  organization?: string;
  business_type?: string;
  role?: string;
}): Promise<AuthUser> {
  const res = await fetch(`${API_BASE}/auth/me`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify(updates),
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error(await readError(res, "Failed to update profile"));
  return await res.json();
}

// ---------------------------------------------------------------------------
// Inventory summary
// ---------------------------------------------------------------------------
export async function fetchInventorySummary(): Promise<{
  revision: string;
  total_products: number;
  total_stock_value: number;
}> {
  const res = await fetch(`${API_BASE}/inventory/summary`, {
    cache: "no-store",
    headers: authHeaders(),
    signal: AbortSignal.timeout(4000),
  });
  if (!res.ok) throw new Error(`Failed to fetch inventory summary: ${res.status}`);
  return await res.json();
}

// ---------------------------------------------------------------------------
// Partners: customers & suppliers
// ---------------------------------------------------------------------------
export type ApiCustomer = {
  id: string;
  name: string;
  email: string;
  company: string;
  industry: string;
  customer_type: string;
  total_spent: number;
  last_order: string | null;
  last_order_ts: number;
  status: string;
  avatar_color: string;
  is_new: boolean;
  high_value: boolean;
};

export type ApiSupplier = {
  id: string;
  name: string;
  initial: string;
  accent: string;
  categories: string[];
  products: number;
  location: string;
  rating: number;
  reviews: number;
  response_time: string;
  min_order: number;
  verified: boolean;
  status: string;
  match_score: number;
  spend_this_month: number;
};

export async function fetchCustomersSummary() {
  const res = await fetch(`${API_BASE}/partners/customers/summary`, {
    cache: "no-store",
    headers: authHeaders(),
    signal: AbortSignal.timeout(4000),
  });
  if (!res.ok) throw new Error(`Failed customers summary: ${res.status}`);
  return await res.json();
}

export async function fetchCustomers(limit = 500): Promise<ApiCustomer[]> {
  const res = await fetch(`${API_BASE}/partners/customers?limit=${limit}`, {
    cache: "no-store",
    headers: authHeaders(),
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error(`Failed to fetch customers: ${res.status}`);
  return await res.json();
}

export async function createCustomerApi(data: Record<string, unknown>): Promise<ApiCustomer> {
  const res = await fetch(`${API_BASE}/partners/customers`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(data),
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error(await readError(res, "Failed to create customer"));
  return await res.json();
}

export async function updateCustomerApi(id: string, data: Record<string, unknown>): Promise<ApiCustomer> {
  const res = await fetch(`${API_BASE}/partners/customers/${id}`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify(data),
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error(await readError(res, "Failed to update customer"));
  return await res.json();
}

export async function fetchSuppliersSummary() {
  const res = await fetch(`${API_BASE}/partners/suppliers/summary`, {
    cache: "no-store",
    headers: authHeaders(),
    signal: AbortSignal.timeout(4000),
  });
  if (!res.ok) throw new Error(`Failed suppliers summary: ${res.status}`);
  return await res.json();
}

export async function fetchSuppliers(limit = 500): Promise<ApiSupplier[]> {
  const res = await fetch(`${API_BASE}/partners/suppliers?limit=${limit}`, {
    cache: "no-store",
    headers: authHeaders(),
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error(`Failed to fetch suppliers: ${res.status}`);
  return await res.json();
}

export async function createSupplierApi(data: Record<string, unknown>): Promise<ApiSupplier> {
  const res = await fetch(`${API_BASE}/partners/suppliers`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(data),
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error(await readError(res, "Failed to create supplier"));
  return await res.json();
}

export async function updateSupplierApi(id: string, data: Record<string, unknown>): Promise<ApiSupplier> {
  const res = await fetch(`${API_BASE}/partners/suppliers/${id}`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify(data),
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error(await readError(res, "Failed to update supplier"));
  return await res.json();
}

export async function createSupplierRequestApi(data: {
  need: string;
  category: string;
  budget: number;
}) {
  const res = await fetch(`${API_BASE}/partners/supplier-requests`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(data),
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error(await readError(res, "Failed to create supplier request"));
  return await res.json();
}

export async function fetchSupplierRequests(): Promise<
  Array<{
    id: string;
    need: string;
    category: string;
    budget: number;
    created_at: string;
    status: string;
  }>
> {
  const res = await fetch(`${API_BASE}/partners/supplier-requests`, {
    cache: "no-store",
    headers: authHeaders(),
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error(`Failed to fetch supplier requests: ${res.status}`);
  return await res.json();
}

export async function askInsight(
  question: string,
  context?: Record<string, unknown>
): Promise<{
  answer: string;
  provider: "openai" | "rules";
  model?: string | null;
  tool_trace?: Array<{ tool: string; args: Record<string, unknown>; result_preview: string }> | null;
}> {
  const res = await fetch(`${API_BASE}/insights/ask`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ question, context }),
    signal: AbortSignal.timeout(45000),
  });
  if (!res.ok) throw new Error(await readError(res, "Insight request failed"));
  return await res.json();
}

export async function fetchInsightProvider(): Promise<{ provider: string; model: string | null }> {
  const res = await fetch(`${API_BASE}/insights/provider`, {
    cache: "no-store",
    headers: authHeaders(),
    signal: AbortSignal.timeout(4000),
  });
  if (!res.ok) return { provider: "rules", model: null };
  return await res.json();
}

// ---------------------------------------------------------------------------
// Onboarding
// ---------------------------------------------------------------------------

export type AutomationMode = "off" | "suggest" | "automatic";
export type BusinessTypeOption = "Retail" | "Wholesale" | "Manufacturing";
export type TeamSizeOption = "Just me" | "2-10" | "11-50" | "51+";
export type TaxModeOption = "included" | "added_at_sale";

export type OnboardingProfile = {
  company_name: string;
  business_type: BusinessTypeOption;
  team_size: TeamSizeOption;
  country: string;
  currency: string;
  tax_mode: TaxModeOption;
  current_step: "company" | "connections" | "ai" | "review" | "done";
  completed: boolean;
  completed_at: string | null;
  tour_dismissed: boolean;
};

export type OnboardingIntegration = {
  provider_id: string;
  category: string;
  status: "skipped" | "saved";
  key_last4: string | null;
  updated_at?: string | null;
};

export type OnboardingAutomation = {
  function_id: string;
  mode: AutomationMode;
};

export type OnboardingState = {
  profile: OnboardingProfile;
  integrations: OnboardingIntegration[];
  automations: OnboardingAutomation[];
};

export async function fetchOnboardingState(): Promise<OnboardingState> {
  const res = await fetch(`${API_BASE}/onboarding/state`, {
    cache: "no-store",
    headers: authHeaders(),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(await readError(res, "Failed to load onboarding"));
  return await res.json();
}

export async function saveOnboardingProfile(payload: {
  company_name: string;
  business_type: BusinessTypeOption;
  team_size: TeamSizeOption;
  country: string;
  currency: string;
  tax_mode: TaxModeOption;
  current_step?: OnboardingProfile["current_step"];
}): Promise<OnboardingState> {
  const res = await fetch(`${API_BASE}/onboarding/profile`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(await readError(res, "Failed to save company profile"));
  return await res.json();
}

export async function connectOnboardingIntegration(payload: {
  provider_id: string;
  category: string;
  api_key: string;
}): Promise<OnboardingIntegration> {
  const res = await fetch(`${API_BASE}/onboarding/integrations/connect`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(await readError(res, "Failed to save connection"));
  return await res.json();
}

export async function skipOnboardingIntegration(payload: {
  provider_id: string;
  category: string;
}): Promise<OnboardingIntegration> {
  const res = await fetch(`${API_BASE}/onboarding/integrations/skip`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(await readError(res, "Failed to skip connection"));
  return await res.json();
}

export async function removeOnboardingIntegration(providerId: string): Promise<OnboardingIntegration> {
  const res = await fetch(`${API_BASE}/onboarding/integrations/${encodeURIComponent(providerId)}`, {
    method: "DELETE",
    headers: authHeaders(),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(await readError(res, "Failed to remove connection"));
  return await res.json();
}

export async function saveOnboardingAutomations(
  items: Array<{ function_id: string; mode: AutomationMode }>
): Promise<OnboardingState> {
  const res = await fetch(`${API_BASE}/onboarding/automations`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify({ items }),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(await readError(res, "Failed to save AI preferences"));
  return await res.json();
}

export async function completeOnboarding(): Promise<OnboardingState> {
  const res = await fetch(`${API_BASE}/onboarding/complete`, {
    method: "POST",
    headers: authHeaders(),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(await readError(res, "Failed to finish onboarding"));
  return await res.json();
}

export async function dismissOnboardingTour(dismissed = true): Promise<OnboardingState> {
  const res = await fetch(`${API_BASE}/onboarding/tour`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ dismissed }),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(await readError(res, "Failed to dismiss tour"));
  return await res.json();
}

export async function setOnboardingStep(step: OnboardingProfile["current_step"]): Promise<OnboardingState> {
  const res = await fetch(`${API_BASE}/onboarding/step/${step}`, {
    method: "PUT",
    headers: authHeaders(),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(await readError(res, "Failed to update step"));
  return await res.json();
}

/* ─── ML suggestions / flags / audit ─── */

export type MlSuggestion = {
  id: string;
  kind: string;
  function_id: string;
  entity_type: string;
  entity_id: string;
  score: number;
  unique_top: string;
  model_version: string;
  explanation: string;
  payload_json: string;
  status: string;
  decision: string | null;
  created_at: string;
};

export type MlFlag = {
  id: string;
  entity_type: string;
  entity_id: string;
  rule_ids: string;
  score: number;
  severity: string;
  explanation: string;
  model_version: string;
  status: string;
  created_at: string;
};

export type MlAudit = {
  id: string;
  proposal_id: string | null;
  kind: string;
  action: string;
  model_version: string;
  score: number;
  explanation: string;
  entity_type: string;
  entity_id: string;
  undone: string;
  created_at: string;
};

export type PurchaseDraft = {
  id: string;
  product_id: string;
  sku: string;
  product_name: string;
  qty: number;
  reason: string;
  status: string;
  proposal_id: string | null;
  supplier_id: string | null;
  created_at: string;
};

export type RiskScore = {
  partner_type: string;
  partner_id: string;
  score: number;
  band: string;
  explanation: string;
  factors: Record<string, number>;
  updated_at: string | null;
};

export type ForecastPoint = {
  date: string;
  sku: string;
  demand: number;
  method: string;
};

export async function fetchMlSuggestions(params?: {
  status?: string;
  kind?: string;
  limit?: number;
}): Promise<MlSuggestion[]> {
  const q = new URLSearchParams();
  if (params?.status) q.set("status", params.status);
  if (params?.kind) q.set("kind", params.kind);
  if (params?.limit) q.set("limit", String(params.limit));
  const res = await fetch(`${API_BASE}/ml/suggestions?${q}`, {
    cache: "no-store",
    headers: authHeaders(),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(await readError(res, "Failed to load suggestions"));
  return await res.json();
}

export async function fetchMlFlags(params?: { status?: string; limit?: number }): Promise<MlFlag[]> {
  const q = new URLSearchParams();
  if (params?.status) q.set("status", params.status);
  if (params?.limit) q.set("limit", String(params.limit));
  const res = await fetch(`${API_BASE}/ml/flags?${q}`, {
    cache: "no-store",
    headers: authHeaders(),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(await readError(res, "Failed to load flags"));
  return await res.json();
}

export async function fetchMlAudit(limit = 20): Promise<MlAudit[]> {
  const res = await fetch(`${API_BASE}/ml/audit?limit=${limit}`, {
    cache: "no-store",
    headers: authHeaders(),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(await readError(res, "Failed to load audit"));
  return await res.json();
}

export async function acceptMlSuggestion(id: string): Promise<{ ok: boolean }> {
  const res = await fetch(`${API_BASE}/ml/suggestions/${encodeURIComponent(id)}/accept`, {
    method: "POST",
    headers: authHeaders(),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(await readError(res, "Failed to approve suggestion"));
  return await res.json();
}

export async function dismissMlSuggestion(id: string): Promise<{ ok: boolean }> {
  const res = await fetch(`${API_BASE}/ml/suggestions/${encodeURIComponent(id)}/dismiss`, {
    method: "POST",
    headers: authHeaders(),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(await readError(res, "Failed to dismiss suggestion"));
  return await res.json();
}

export async function dismissMlFlag(id: string): Promise<{ ok: boolean }> {
  const res = await fetch(`${API_BASE}/ml/flags/${encodeURIComponent(id)}/dismiss`, {
    method: "POST",
    headers: authHeaders(),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(await readError(res, "Failed to dismiss flag"));
  return await res.json();
}

export async function undoMlAudit(auditId: string): Promise<{ ok: boolean }> {
  const res = await fetch(`${API_BASE}/ml/audit/${encodeURIComponent(auditId)}/undo`, {
    method: "POST",
    headers: authHeaders(),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(await readError(res, "Failed to undo"));
  return await res.json();
}

export async function fetchPurchaseDrafts(status = "all"): Promise<PurchaseDraft[]> {
  const q = status !== "all" ? `?status=${encodeURIComponent(status)}` : "";
  const res = await fetch(`${API_BASE}/inventory/purchase-drafts${q}`, {
    cache: "no-store",
    headers: authHeaders(),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(await readError(res, "Failed to load draft POs"));
  return await res.json();
}

export async function acceptPurchaseDraft(id: string): Promise<PurchaseDraft> {
  const res = await fetch(`${API_BASE}/inventory/purchase-drafts/${encodeURIComponent(id)}/accept`, {
    method: "POST",
    headers: authHeaders(),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(await readError(res, "Failed to accept draft PO"));
  return await res.json();
}

export async function fetchRiskScores(partnerType?: string): Promise<RiskScore[]> {
  const q = partnerType ? `?partner_type=${encodeURIComponent(partnerType)}` : "";
  const res = await fetch(`${API_BASE}/partners/risk-scores${q}`, {
    cache: "no-store",
    headers: authHeaders(),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(await readError(res, "Failed to load risk scores"));
  return await res.json();
}

export async function fetchForecastSeries(params?: {
  sku?: string;
  days?: number;
}): Promise<ForecastPoint[]> {
  const q = new URLSearchParams();
  if (params?.sku) q.set("sku", params.sku);
  if (params?.days) q.set("days", String(params.days));
  const res = await fetch(`${API_BASE}/insights/forecast?${q}`, {
    cache: "no-store",
    headers: authHeaders(),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(await readError(res, "Failed to load forecast"));
  return await res.json();
}
