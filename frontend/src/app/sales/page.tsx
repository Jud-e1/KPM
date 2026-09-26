"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ChevronRight,
  MoreHorizontal,
  Plus,
  SlidersHorizontal,
  Download,
  CheckCircle2,
  Search,
  X,
  User,
  FileText,
  Headphones,
  Watch,
  Folder,
  Cable,
  BookOpen,
} from "lucide-react";
import {
  salesStore,
  SalesOrder,
  SalesState,
} from "@/lib/salesStore";
import { createSalesOrder, updateSalesOrderStatus } from "@/lib/api";
import { EmptyState } from "@/components/EmptyState";
import { inventoryStore, type InventoryProduct } from "@/lib/inventoryStore";
import { customersStore, type Customer } from "@/lib/customersStore";
import { accountingStore } from "@/lib/accountingStore";
import { authStore } from "@/lib/authStore";
import { AppShell } from "@/components/AppShell";
import { PageHeader, SectionHeading } from "@/components/ui/PageHeader";
import { MetricStrip } from "@/components/ui/MetricStrip";
import { Button } from "@/components/ui/Button";
import { Status } from "@/components/ui/Status";

const formatMoney = (amount: number, digits = 2) =>
  `$${amount.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;

export default function SalesPage() {
  const [salesState, setSalesState] = useState<SalesState>(salesStore.getState());
  const [searchQuery, setSearchQuery] = useState("");
  const [tableSearchQuery, setTableSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [channelFilter, setChannelFilter] = useState<string>("All");
  const [actionDropdownOrderId, setActionDropdownOrderId] = useState<string | null>(null);
  const salesOrdersRef = useRef<HTMLDivElement>(null);

  const [newOrderForm, setNewOrderForm] = useState({
    customerId: "",
    customerName: "",
    itemsCount: 1,
    totalAmount: 0,
    channel: "Online Store" as SalesOrder["channel"],
    status: "Completed" as SalesOrder["status"],
  });
  const [orderLines, setOrderLines] = useState<Array<{ productId: string; qty: number }>>([
    { productId: "", qty: 1 },
  ]);
  const [inventoryProducts, setInventoryProducts] = useState<InventoryProduct[]>(
    () => inventoryStore.getState().products
  );
  const [customers, setCustomers] = useState<Customer[]>(() => customersStore.getState().customers);
  const [workspaceName, setWorkspaceName] = useState(
    () =>
      accountingStore.getState().profile.organization ||
      authStore.getState().user?.organization ||
      "your workspace"
  );

  useEffect(() => {
    const unsub = salesStore.subscribe((newState) => {
      setSalesState({ ...newState });
    });
    const disconnectLiveSync = salesStore.connectLive();
    const unsubInv = inventoryStore.subscribe((state) => setInventoryProducts(state.products));
    const disconnectInv = inventoryStore.connectLive();
    const unsubCust = customersStore.subscribe((state) => setCustomers(state.customers));
    const disconnectCust = customersStore.connectLive();
    const unsubAccounting = accountingStore.subscribe((state) => {
      setWorkspaceName(
        state.profile.organization || authStore.getState().user?.organization || "your workspace"
      );
    });
    const unsubAuth = authStore.subscribe((state) => {
      setWorkspaceName(
        accountingStore.getState().profile.organization ||
          state.user?.organization ||
          "your workspace"
      );
    });
    return () => {
      unsub();
      disconnectLiveSync();
      unsubInv();
      disconnectInv();
      unsubCust();
      disconnectCust();
      unsubAccounting();
      unsubAuth();
    };
  }, []);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (actionDropdownOrderId && !(e.target as HTMLElement).closest(".sales-action-container")) {
        setActionDropdownOrderId(null);
      }
    };
    window.addEventListener("click", handleOutside);
    return () => window.removeEventListener("click", handleOutside);
  }, [actionDropdownOrderId]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("new") === "1") {
      setIsCreateModalOpen(true);
      window.history.replaceState({}, "", "/sales");
    }
  }, []);

  const { orders, metrics } = salesState;
  const pendingCount = orders.filter((order) => order.status === "Pending" || order.status === "Processing").length;

  const filteredOrders = useMemo(() => {
    const rank = (status: string) => (status === "Pending" || status === "Processing" ? 0 : 1);
    return orders
      .filter((o) => {
        if (o.status === "Cancelled") return false;
        if (statusFilter !== "All" && o.status !== statusFilter) return false;
        if (channelFilter !== "All" && o.channel !== channelFilter) return false;

        const q = (tableSearchQuery || searchQuery).trim().toLowerCase();
        if (q) {
          const matchNum = o.orderNumber.toLowerCase().includes(q);
          const matchCust = o.customerName.toLowerCase().includes(q);
          const matchId = o.customerId.toLowerCase().includes(q);
          if (!matchNum && !matchCust && !matchId) return false;
        }
        return true;
      })
      .sort((a, b) => rank(a.status) - rank(b.status));
  }, [orders, statusFilter, channelFilter, tableSearchQuery, searchQuery]);

  const totalPages = Math.ceil(filteredOrders.length / itemsPerPage) || 1;
  const activePage = Math.min(currentPage, totalPages);
  const paginatedOrders = useMemo(() => {
    const start = (activePage - 1) * itemsPerPage;
    return filteredOrders.slice(start, start + itemsPerPage);
  }, [filteredOrders, activePage, itemsPerPage]);

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedOrderIds(new Set(paginatedOrders.map((o) => o.id)));
    } else {
      setSelectedOrderIds(new Set());
    }
  };

  const handleSelectRow = (id: string) => {
    setSelectedOrderIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCreateOrderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrderForm.customerName.trim()) return;

    const linesPayload = orderLines
      .map((line) => {
        const product = inventoryProducts.find((p) => p.id === line.productId);
        if (!product) return null;
        return {
          product_id: product.id,
          sku: product.sku,
          product_name: product.name,
          qty: Math.max(1, Number(line.qty) || 1),
          unit_price: product.price,
        };
      })
      .filter(Boolean) as Array<{
      product_id: string;
      sku: string;
      product_name: string;
      qty: number;
      unit_price: number;
    }>;

    const itemsCount = linesPayload.length
      ? linesPayload.reduce((sum, line) => sum + line.qty, 0)
      : Number(newOrderForm.itemsCount) || 1;
    const totalAmount = linesPayload.length
      ? linesPayload.reduce((sum, line) => sum + line.qty * line.unit_price, 0)
      : Number(newOrderForm.totalAmount) || 0;

    const created = salesStore.createOrder({
      customerName: newOrderForm.customerName,
      customerId: newOrderForm.customerId || undefined,
      itemsCount,
      totalAmount,
      channel: newOrderForm.channel,
      status: newOrderForm.status,
      lines: linesPayload.map((line) => ({
        productId: line.product_id,
        sku: line.sku,
        productName: line.product_name,
        qty: line.qty,
        unitPrice: line.unit_price,
        lineTotal: line.qty * line.unit_price,
      })),
    });

    try {
      await createSalesOrder({
        id: created.id,
        order_number: created.orderNumber,
        customer_name: created.customerName,
        customer_id: created.customerId || null,
        items_count: created.itemsCount,
        total_amount: created.totalAmount,
        status: created.status,
        channel: created.channel,
        lines: linesPayload.length ? linesPayload : undefined,
      });
      salesStore.markOrderSynced(created.id);
      void inventoryStore.syncFromBackend(true);
      void accountingStore.syncFromBackend(true);
      void customersStore.syncFromBackend(true);
    } catch {
      void salesStore.syncFromBackend(true);
    }

    setIsCreateModalOpen(false);
    setNewOrderForm({
      customerId: "",
      customerName: "",
      itemsCount: 1,
      totalAmount: 0,
      channel: "Online Store",
      status: "Completed",
    });
    setOrderLines([{ productId: "", qty: 1 }]);
  };

  const handleToggleStatus = async (order: SalesOrder) => {
    const newStatus: SalesOrder["status"] = order.status === "Completed" ? "Pending" : "Completed";
    salesStore.updateOrderStatus(order.id, newStatus);
    setActionDropdownOrderId(null);
    try {
      await updateSalesOrderStatus(order.id, newStatus);
      salesStore.markOrderSynced(order.id);
      void inventoryStore.syncFromBackend(true);
      void accountingStore.syncFromBackend(true);
      void customersStore.syncFromBackend(true);
    } catch {
      try {
        await createSalesOrder({
          id: order.id,
          order_number: order.orderNumber,
          customer_name: order.customerName,
          customer_id: order.customerId,
          items_count: order.itemsCount,
          total_amount: order.totalAmount,
          status: newStatus,
          channel: order.channel,
        });
        salesStore.markOrderSynced(order.id);
      } catch {
        void salesStore.syncFromBackend(true);
      }
    }
  };

  const handleCancelOrder = async (order: SalesOrder) => {
    salesStore.updateOrderStatus(order.id, "Cancelled");
    setActionDropdownOrderId(null);
    try {
      await updateSalesOrderStatus(order.id, "Cancelled");
      salesStore.markOrderSynced(order.id);
    } catch {
      try {
        await createSalesOrder({
          id: order.id,
          order_number: order.orderNumber,
          customer_name: order.customerName,
          customer_id: order.customerId,
          items_count: order.itemsCount,
          total_amount: order.totalAmount,
          status: "Cancelled",
          channel: order.channel,
        });
        salesStore.markOrderSynced(order.id);
      } catch {
        void salesStore.syncFromBackend(true);
      }
    }
  };

  const handleExportCSV = () => {
    const csvContent = salesStore.exportOrdersCSV();
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `kpm_sales_orders_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const focusSalesOrders = (orderNumber?: string) => {
    setStatusFilter("All");
    setChannelFilter("All");
    setTableSearchQuery(orderNumber || "");
    setCurrentPage(1);
    salesOrdersRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const renderProductThumb = (type: string) => {
    let Icon = Headphones;
    if (type === "watch") Icon = Watch;
    else if (type === "backpack") Icon = Folder;
    else if (type === "cable") Icon = Cable;
    else if (type === "notebook") Icon = BookOpen;

    return (
      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[var(--app-radius-control)] border border-[var(--app-border)] bg-[var(--app-hover)] text-[var(--app-ink)]">
        <Icon className="h-4 w-4 stroke-[1.8]" />
      </div>
    );
  };

  const pageStart = filteredOrders.length === 0 ? 0 : (activePage - 1) * itemsPerPage + 1;
  const pageEnd = Math.min(activePage * itemsPerPage, filteredOrders.length);

  return (
    <AppShell
      searchPlaceholder="Search sales, customers, orders…"
      searchValue={searchQuery}
      onSearchChange={(value) => {
        setSearchQuery(value);
        setCurrentPage(1);
      }}
      maxWidthClassName="max-w-[1360px]"
    >
      <PageHeader
        title="Sales"
        description={
          pendingCount > 0
            ? `${pendingCount} ${pendingCount === 1 ? "order needs" : "orders need"} action.`
            : `Orders, revenue, and channels for ${workspaceName}.`
        }
        actions={
          <>
            <Button variant="secondary" size="sm" type="button" onClick={handleExportCSV}>
              <Download className="w-3.5 h-3.5" />
              Export
            </Button>
            <Button size="sm" type="button" onClick={() => setIsCreateModalOpen(true)}>
              <Plus className="w-3.5 h-3.5" />
              Create order
            </Button>
          </>
        }
      />

      <MetricStrip
        items={[
          {
            label: "Revenue",
            value: formatMoney(metrics.totalRevenue),
          },
          {
            label: "Orders",
            value: String(metrics.totalOrders),
            hint: pendingCount > 0 ? `${pendingCount} need action` : "All caught up",
          },
          {
            label: "Avg order value",
            value: formatMoney(metrics.averageOrderValue),
          },
          {
            label: "Outstanding",
            value: formatMoney(metrics.outstandingInvoices),
            hint: "Pending invoices",
          },
        ]}
      />

      {pendingCount > 0 ? (
        <section className="overflow-hidden rounded-[var(--app-radius)] border border-[var(--app-border)] bg-[var(--app-surface)]">
          <div className="flex items-center justify-between gap-3 border-b border-[var(--app-border)] px-4 py-3">
            <h2 className="text-sm font-semibold text-[var(--app-ink)]">Needs action</h2>
            <span className="text-xs text-[var(--app-muted)]">{pendingCount} open</span>
          </div>
          <ul className="divide-y divide-[var(--app-border)]">
            {orders
              .filter((order) => order.status === "Pending" || order.status === "Processing")
              .slice(0, 5)
              .map((order) => (
                <li key={order.id} className="flex items-center gap-3 px-4 py-2.5">
                  <Status tone="warning" filled>
                    {order.status}
                  </Status>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-semibold text-[var(--app-ink)]">
                      {order.orderNumber} · {order.customerName}
                    </div>
                    <div className="truncate text-xs text-[var(--app-muted)]">
                      {order.channel} · {order.date}
                    </div>
                  </div>
                  <div className="text-[13px] font-semibold tabular-nums text-[var(--app-ink)]">
                    {formatMoney(order.totalAmount, 0)}
                  </div>
                  <Button variant="secondary" size="sm" type="button" onClick={() => focusSalesOrders(order.orderNumber)}>
                    Review
                  </Button>
                </li>
              ))}
          </ul>
        </section>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        <div className="lg:col-span-8 xl:col-span-9 flex flex-col gap-4">
          <div className="order-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-[var(--app-radius)] border border-[var(--app-border)] bg-[var(--app-surface)] p-4">
              <SectionHeading title="Sales by channel" />
              <div className="space-y-2 text-xs">
                {metrics.channelBreakdown.map((item) => (
                  <div key={item.name} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="h-2 w-2 flex-shrink-0 rounded-full bg-[var(--app-ink)]" />
                        <span className="truncate text-[var(--app-muted)]">{item.name}</span>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-[var(--app-muted)]">{item.percentage}%</span>
                        <span className="font-semibold tabular-nums text-[var(--app-ink)]">
                          {formatMoney(item.amount, 0)}
                        </span>
                      </div>
                    </div>
                    <div className="h-1 w-full overflow-hidden rounded-full bg-[var(--app-hover)]">
                      <div
                        className="h-full rounded-full bg-[var(--app-ink)]"
                        style={{ width: `${Math.min(100, Math.max(4, item.percentage))}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[var(--app-radius)] border border-[var(--app-border)] bg-[var(--app-surface)] p-4">
              <SectionHeading
                title="Recent sales"
                action={
                  <button
                    type="button"
                    onClick={() => focusSalesOrders()}
                    className="inline-flex items-center gap-0.5 font-medium text-[var(--app-ink)] hover:underline cursor-pointer"
                  >
                    View all
                    <ArrowRight className="w-3 h-3" />
                  </button>
                }
              />
              <div className="space-y-1.5">
                {orders
                  .filter((order) => order.status !== "Cancelled")
                  .slice(0, 5)
                  .map((order) => (
                    <button
                      key={order.id}
                      type="button"
                      onClick={() => focusSalesOrders(order.orderNumber)}
                      className="flex w-full items-center justify-between rounded-[var(--app-radius-control)] p-1.5 text-left hover:bg-[var(--app-hover)] cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[var(--app-radius-control)] border border-[var(--app-border)] bg-[var(--app-hover)] text-[var(--app-muted)]">
                          <FileText className="h-3.5 w-3.5" />
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-xs font-semibold text-[var(--app-ink)]">
                            {order.orderNumber}
                          </div>
                          <div className="text-[13px] text-[var(--app-muted)]">
                            {order.date} · {order.time}
                          </div>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-xs font-semibold tabular-nums text-[var(--app-ink)]">
                          {formatMoney(order.totalAmount)}
                        </div>
                        <div className="flex items-center justify-end gap-1">
                          <Status tone={order.status === "Completed" ? "positive" : "warning"}>
                            {order.status}
                          </Status>
                          <ChevronRight className="h-3 w-3 text-[var(--app-muted)]" />
                        </div>
                      </div>
                    </button>
                  ))}
                {orders.filter((o) => o.status !== "Cancelled").length === 0 ? (
                  <p className="text-xs text-[var(--app-muted)]">No recent sales yet.</p>
                ) : null}
              </div>
            </div>
          </div>

          <div
            ref={salesOrdersRef}
            className="order-1 space-y-3 rounded-[var(--app-radius)] border border-[var(--app-border)] bg-[var(--app-surface)] p-4"
          >
            <div className="flex flex-col gap-3 border-b border-[var(--app-border)] pb-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-sm font-semibold text-[var(--app-ink)]">Sales orders</h3>
                <p className="mt-0.5 text-[13px] text-[var(--app-muted)]">
                  Manage and track orders in real time.
                </p>
              </div>
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--app-muted)]" />
                  <input
                    type="text"
                    placeholder="Search orders or customers…"
                    aria-label="Search orders or customers"
                    value={tableSearchQuery}
                    onChange={(e) => {
                      setTableSearchQuery(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="w-full rounded-[var(--app-radius-control)] border border-[var(--app-border)] bg-[var(--app-hover)] py-1.5 pl-8 pr-3 text-xs outline-none focus:border-[var(--app-border-strong)] focus:bg-[var(--app-surface)]"
                  />
                </div>
                <Button variant="secondary" size="sm" type="button" onClick={() => setIsFilterModalOpen(true)}>
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  Filter
                </Button>
              </div>
            </div>

            <div className="kpm-cards overflow-x-auto">
              <table className="w-full border-collapse text-left md:min-w-[760px]">
                <thead>
                  <tr className="border-b border-[var(--app-border)] bg-[var(--app-hover)] text-[13px] font-semibold uppercase tracking-wider text-[var(--app-muted)]">
                    <th className="w-10 px-3 py-2.5">
                      <input
                        type="checkbox"
                        checked={paginatedOrders.length > 0 && selectedOrderIds.size === paginatedOrders.length}
                        onChange={handleSelectAll}
                        className="h-4 w-4 cursor-pointer rounded border-[var(--app-border-strong)] text-[var(--app-ink)] focus:ring-0"
                      />
                    </th>
                    <th className="px-3 py-2.5">Order #</th>
                    <th className="px-3 py-2.5">Customer</th>
                    <th className="px-3 py-2.5">Date</th>
                    <th className="px-3 py-2.5">Items</th>
                    <th className="px-3 py-2.5">Total</th>
                    <th className="px-3 py-2.5">Status</th>
                    <th className="px-3 py-2.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--app-border)] text-xs">
                  {paginatedOrders.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-6">
                        <EmptyState
                          title={salesState.orders.length === 0 ? "No sales orders yet" : "No matching orders"}
                          description={
                            salesState.orders.length === 0
                              ? "Create an order — revenue and channel metrics update from your database."
                              : "Try clearing search or status filters."
                          }
                          action={
                            salesState.orders.length === 0 ? (
                              <Button size="sm" type="button" onClick={() => setIsCreateModalOpen(true)}>
                                Create order
                              </Button>
                            ) : null
                          }
                        />
                      </td>
                    </tr>
                  ) : (
                    paginatedOrders.map((order) => {
                      const isChecked = selectedOrderIds.has(order.id);
                      return (
                        <tr
                          key={order.id}
                          className={`group transition-colors hover:bg-[var(--app-hover)] ${
                            isChecked ? "bg-[var(--app-hover)]" : ""
                          }`}
                        >
                          <td data-label="Select" className="px-3 py-3">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => handleSelectRow(order.id)}
                              aria-label={`Select ${order.orderNumber}`}
                              className="h-4 w-4 cursor-pointer rounded border-[var(--app-border-strong)] text-[var(--app-ink)] focus:ring-0"
                            />
                          </td>
                          <td data-label="Order" className="kpm-card-lead px-3 py-3 font-mono font-semibold text-[var(--app-ink)]">
                            {order.orderNumber}
                          </td>
                          <td data-label="Customer" className="px-3 py-3">
                            <div className="flex items-center gap-2.5">
                              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--app-hover)] text-[var(--app-muted)]">
                                <User className="h-3.5 w-3.5" />
                              </div>
                              <div>
                                <div className="font-semibold leading-tight text-[var(--app-ink)]">
                                  {order.customerName}
                                </div>
                                <div className="font-mono text-[13px] text-[var(--app-muted)]">
                                  {order.customerId}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td data-label="Date" className="px-3 py-3 text-[var(--app-ink)]">
                            <div>{order.date}</div>
                            <div className="text-[13px] text-[var(--app-muted)]">{order.time}</div>
                          </td>
                          <td data-label="Items" className="px-3 py-3 font-semibold tabular-nums text-[var(--app-ink)]">
                            {order.itemsCount}
                          </td>
                          <td data-label="Total" className="px-3 py-3 font-semibold tabular-nums text-[var(--app-ink)]">
                            {formatMoney(order.totalAmount)}
                          </td>
                          <td data-label="Status" className="px-3 py-3">
                            <Status tone={order.status === "Completed" ? "positive" : "warning"} filled>
                              {order.status}
                            </Status>
                          </td>
                          <td data-label="Actions" className="sales-action-container relative px-3 py-3 text-right">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActionDropdownOrderId(
                                  actionDropdownOrderId === order.id ? null : order.id
                                );
                              }}
                              className="rounded-[var(--app-radius-control)] p-1 text-[var(--app-muted)] hover:bg-[var(--app-hover)] hover:text-[var(--app-ink)] cursor-pointer"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </button>
                            {actionDropdownOrderId === order.id ? (
                              <div className="kpm-row-menu absolute right-3 top-8 z-50 w-44 rounded-[var(--app-radius)] border border-[var(--app-border)] bg-[var(--app-surface)] p-1.5 text-left text-xs shadow-lg">
                                <button
                                  type="button"
                                  onClick={() => handleToggleStatus(order)}
                                  className="flex w-full items-center gap-2 rounded-[var(--app-radius-control)] px-3 py-2 font-medium text-[var(--app-ink)] hover:bg-[var(--app-hover)] cursor-pointer"
                                >
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                  Mark as {order.status === "Completed" ? "Pending" : "Completed"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (confirm(`Cancel ${order.orderNumber}?`)) {
                                      void handleCancelOrder(order);
                                    }
                                  }}
                                  className="flex w-full items-center gap-2 rounded-[var(--app-radius-control)] px-3 py-2 font-medium text-[var(--app-critical)] hover:bg-[var(--app-critical-bg)] cursor-pointer"
                                >
                                  <X className="h-3.5 w-3.5" />
                                  Cancel order
                                </button>
                              </div>
                            ) : null}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col items-center justify-between gap-3 border-t border-[var(--app-border)] pt-3 text-xs text-[var(--app-muted)] sm:flex-row">
              <div>
                Showing {pageStart}–{pageEnd} of {filteredOrders.length} orders
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={activePage === 1}
                  className="flex h-8 w-8 items-center justify-center rounded-[var(--app-radius-control)] border border-[var(--app-border)] hover:bg-[var(--app-hover)] disabled:opacity-40 cursor-pointer"
                >
                  &lt;
                </button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => i + 1).map((pageNum) => (
                  <button
                    key={pageNum}
                    type="button"
                    onClick={() => setCurrentPage(pageNum)}
                    className={`flex h-8 min-w-8 items-center justify-center rounded-[var(--app-radius-control)] text-[13px] font-semibold cursor-pointer ${
                      activePage === pageNum
                        ? "bg-[var(--app-nav-active-bg)] text-[var(--app-nav-active)]"
                        : "text-[var(--app-ink)] hover:bg-[var(--app-hover)]"
                    }`}
                  >
                    {pageNum}
                  </button>
                ))}
                {totalPages > 5 ? (
                  <>
                    <span className="px-1 text-[var(--app-muted)]">…</span>
                    <button
                      type="button"
                      onClick={() => setCurrentPage(totalPages)}
                      className={`flex h-8 min-w-8 items-center justify-center rounded-[var(--app-radius-control)] px-1.5 text-[13px] font-semibold cursor-pointer ${
                        activePage === totalPages
                          ? "bg-[var(--app-nav-active-bg)] text-[var(--app-nav-active)]"
                          : "text-[var(--app-ink)] hover:bg-[var(--app-hover)]"
                      }`}
                    >
                      {totalPages}
                    </button>
                  </>
                ) : null}
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={activePage >= totalPages}
                  className="flex h-8 w-8 items-center justify-center rounded-[var(--app-radius-control)] border border-[var(--app-border)] hover:bg-[var(--app-hover)] disabled:opacity-40 cursor-pointer"
                >
                  &gt;
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-4 xl:col-span-3">
          <div className="space-y-3 rounded-[var(--app-radius)] border border-[var(--app-border)] bg-[var(--app-surface)] p-4">
            <SectionHeading
              title="Top products"
              action={
                <Link
                  href="/inventory"
                  className="inline-flex items-center gap-0.5 font-medium text-[var(--app-ink)] hover:underline"
                >
                  Inventory
                  <ArrowRight className="w-3 h-3" />
                </Link>
              }
            />
            <div className="space-y-3">
              {metrics.topProducts.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-2 text-xs">
                  <div className="flex min-w-0 items-center gap-2.5">
                    {renderProductThumb(p.iconType)}
                    <div className="min-w-0">
                      <div className="truncate font-semibold text-[var(--app-ink)]">{p.name}</div>
                      <div className="text-[13px] text-[var(--app-muted)]">
                        {p.sku} · {p.soldCount} sold
                      </div>
                    </div>
                  </div>
                  <div className="flex-shrink-0 font-semibold tabular-nums text-[var(--app-ink)]">
                    {formatMoney(p.revenue)}
                  </div>
                </div>
              ))}
              {metrics.topProducts.length === 0 ? (
                <p className="text-xs text-[var(--app-muted)]">No product sales yet.</p>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {isCreateModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--app-ink)]/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md space-y-4 rounded-[var(--app-radius)] border border-[var(--app-border)] bg-[var(--app-surface)] p-5 text-xs shadow-xl">
            <div className="flex items-center justify-between border-b border-[var(--app-border)] pb-3">
              <h3 className="text-base font-semibold text-[var(--app-ink)]">Create sales order</h3>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="text-[var(--app-muted)] hover:text-[var(--app-ink)]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleCreateOrderSubmit} className="space-y-3">
              <div>
                <label className="mb-1 block font-semibold text-[var(--app-ink)]">Customer *</label>
                {customers.length > 0 ? (
                  <select
                    required
                    value={newOrderForm.customerId}
                    onChange={(e) => {
                      const selected = customers.find((customer) => customer.id === e.target.value);
                      setNewOrderForm({
                        ...newOrderForm,
                        customerId: e.target.value,
                        customerName: selected?.name || "",
                      });
                    }}
                    className="w-full rounded-[var(--app-radius-control)] border border-[var(--app-border)] px-3 py-2 outline-none focus:border-[var(--app-border-strong)]"
                  >
                    <option value="">Select a customer</option>
                    {customers.map((customer) => (
                      <option key={customer.id} value={customer.id}>
                        {customer.name}
                        {customer.company ? ` · ${customer.company}` : ""}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    required
                    placeholder="Add customers first, or type a name"
                    value={newOrderForm.customerName}
                    onChange={(e) =>
                      setNewOrderForm({ ...newOrderForm, customerId: "", customerName: e.target.value })
                    }
                    className="w-full rounded-[var(--app-radius-control)] border border-[var(--app-border)] px-3 py-2 outline-none focus:border-[var(--app-border-strong)]"
                  />
                )}
                {customers.length > 0 ? (
                  <p className="mt-1 text-[11px] text-[var(--app-muted)]">
                    Or{" "}
                    <Link href="/customers" className="font-semibold text-[var(--app-ink)] underline-offset-2 hover:underline">
                      manage customers
                    </Link>
                  </p>
                ) : (
                  <p className="mt-1 text-[11px] text-[var(--app-muted)]">
                    <Link href="/customers" className="font-semibold text-[var(--app-ink)] underline-offset-2 hover:underline">
                      Add a customer
                    </Link>{" "}
                    so spend rolls up on that page.
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-semibold text-[var(--app-ink)]">Line items</label>
                  <button
                    type="button"
                    onClick={() => setOrderLines((rows) => [...rows, { productId: "", qty: 1 }])}
                    className="text-[13px] font-semibold text-[var(--app-ink)] hover:underline"
                  >
                    + Add line
                  </button>
                </div>
                {orderLines.map((line, index) => (
                  <div key={index} className="grid grid-cols-[1fr_72px_28px] gap-2">
                    <select
                      value={line.productId}
                      onChange={(e) =>
                        setOrderLines((rows) =>
                          rows.map((row, i) => (i === index ? { ...row, productId: e.target.value } : row))
                        )
                      }
                      className="w-full rounded-[var(--app-radius-control)] border border-[var(--app-border)] px-3 py-2 outline-none"
                    >
                      <option value="">Select product…</option>
                      {inventoryProducts.map((product) => (
                        <option key={product.id} value={product.id}>
                          {product.name} (${product.price.toFixed(2)}) · stock {product.stock}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min={1}
                      value={line.qty}
                      onChange={(e) =>
                        setOrderLines((rows) =>
                          rows.map((row, i) =>
                            i === index ? { ...row, qty: Math.max(1, Number(e.target.value) || 1) } : row
                          )
                        )
                      }
                      className="w-full rounded-[var(--app-radius-control)] border border-[var(--app-border)] px-2 py-2 outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setOrderLines((rows) => rows.filter((_, i) => i !== index))}
                      className="text-[var(--app-muted)] hover:text-[var(--app-critical)]"
                      disabled={orderLines.length === 1}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
                {!inventoryProducts.length ? (
                  <p className="text-[13px] text-[var(--app-muted)]">
                    No products yet — totals can still be entered manually below.
                  </p>
                ) : null}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block font-semibold text-[var(--app-ink)]">Items count</label>
                  <input
                    type="number"
                    min="1"
                    value={
                      orderLines.some((l) => l.productId)
                        ? orderLines.reduce((sum, line) => {
                            if (!line.productId) return sum;
                            return sum + Math.max(1, line.qty);
                          }, 0)
                        : newOrderForm.itemsCount
                    }
                    onChange={(e) =>
                      setNewOrderForm({ ...newOrderForm, itemsCount: Number(e.target.value) })
                    }
                    disabled={orderLines.some((l) => l.productId)}
                    className="w-full rounded-[var(--app-radius-control)] border border-[var(--app-border)] px-3 py-2 outline-none disabled:bg-[var(--app-hover)]"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-semibold text-[var(--app-ink)]">Total ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={
                      orderLines.some((l) => l.productId)
                        ? orderLines
                            .reduce((sum, line) => {
                              const product = inventoryProducts.find((p) => p.id === line.productId);
                              if (!product) return sum;
                              return sum + product.price * Math.max(1, line.qty);
                            }, 0)
                            .toFixed(2)
                        : newOrderForm.totalAmount
                    }
                    onChange={(e) =>
                      setNewOrderForm({ ...newOrderForm, totalAmount: Number(e.target.value) })
                    }
                    disabled={orderLines.some((l) => l.productId)}
                    className="w-full rounded-[var(--app-radius-control)] border border-[var(--app-border)] px-3 py-2 font-semibold outline-none disabled:bg-[var(--app-hover)]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block font-semibold text-[var(--app-ink)]">Channel</label>
                  <select
                    value={newOrderForm.channel}
                    onChange={(e) =>
                      setNewOrderForm({
                        ...newOrderForm,
                        channel: e.target.value as SalesOrder["channel"],
                      })
                    }
                    className="w-full cursor-pointer rounded-[var(--app-radius-control)] border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2 outline-none"
                  >
                    <option value="Online Store">Online Store</option>
                    <option value="Direct Sales">Direct Sales</option>
                    <option value="Retail Partners">Retail Partners</option>
                    <option value="Wholesale">Wholesale</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block font-semibold text-[var(--app-ink)]">Status</label>
                  <select
                    value={newOrderForm.status}
                    onChange={(e) =>
                      setNewOrderForm({
                        ...newOrderForm,
                        status: e.target.value as SalesOrder["status"],
                      })
                    }
                    className="w-full cursor-pointer rounded-[var(--app-radius-control)] border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2 outline-none"
                  >
                    <option value="Completed">Completed</option>
                    <option value="Pending">Pending</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="secondary" size="sm" type="button" onClick={() => setIsCreateModalOpen(false)}>
                  Cancel
                </Button>
                <Button size="sm" type="submit">
                  Create order
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {isFilterModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--app-ink)]/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm space-y-4 rounded-[var(--app-radius)] border border-[var(--app-border)] bg-[var(--app-surface)] p-5 text-xs shadow-xl">
            <div className="flex items-center justify-between border-b border-[var(--app-border)] pb-2">
              <h3 className="text-sm font-semibold text-[var(--app-ink)]">Filter orders</h3>
              <button
                type="button"
                onClick={() => setIsFilterModalOpen(false)}
                className="text-[var(--app-muted)] hover:text-[var(--app-ink)]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block font-semibold text-[var(--app-ink)]">Status</label>
                <div className="flex gap-2">
                  {["All", "Completed", "Pending"].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => {
                        setStatusFilter(s);
                        setCurrentPage(1);
                      }}
                      className={`rounded-[var(--app-radius-control)] px-3 py-1 text-xs font-semibold cursor-pointer ${
                        statusFilter === s
                          ? "bg-[var(--app-nav-active-bg)] text-[var(--app-nav-active)]"
                          : "bg-[var(--app-hover)] text-[var(--app-ink)] hover:bg-[var(--app-border)]"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="mb-1 block font-semibold text-[var(--app-ink)]">Channel</label>
                <select
                  value={channelFilter}
                  onChange={(e) => {
                    setChannelFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full cursor-pointer rounded-[var(--app-radius-control)] border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2 outline-none"
                >
                  <option value="All">All channels</option>
                  <option value="Online Store">Online Store</option>
                  <option value="Direct Sales">Direct Sales</option>
                  <option value="Retail Partners">Retail Partners</option>
                  <option value="Wholesale">Wholesale</option>
                </select>
              </div>
              <div className="flex justify-end pt-1">
                <Button size="sm" type="button" onClick={() => setIsFilterModalOpen(false)}>
                  Apply filters
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}
