"use client";

import React, { startTransition, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Heart,
  MoreHorizontal,
  Plus,
  Search,
  ShoppingBag,
  SlidersHorizontal,
  TrendingUp,
  X,
} from "lucide-react";
import { accountingStore, AccountingState } from "@/lib/accountingStore";
import {
  computeCustomerMetrics,
  computeCustomerSegments,
  Customer,
  CustomerStatus,
  CustomerType,
  CustomersState,
  customersStore,
} from "@/lib/customersStore";
import { updateAccountingProfile, fetchRiskScores, type RiskScore } from "@/lib/api";
import { purgeCustomersStorage } from "@/lib/storePersistence";
import { AppShell } from "@/components/AppShell";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { MetricStrip } from "@/components/ui/MetricStrip";
import { Button } from "@/components/ui/Button";
import { Pager } from "@/components/ui/Pager";
import { TableSkeleton } from "@/components/ui/Skeleton";

const formatCurrency = (amount: number) =>
  `$${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function riskBadge(band?: string, explanation?: string) {
  if (!band) return null;
  const styles =
    band === "high"
      ? "bg-[var(--app-critical-bg)] text-[var(--app-critical)]"
      : band === "medium"
        ? "bg-[var(--app-warning-bg)] text-[var(--app-warning)]"
        : "bg-[var(--app-positive-bg)] text-[var(--app-positive)]";
  return (
    <span
      title={explanation || `Risk ${band}`}
      className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wide ${styles}`}
    >
      Risk {band}
    </span>
  );
}

function customerInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return `${parts[0]?.[0] || ""}${parts[1]?.[0] || ""}`.toUpperCase() || "C";
}

const avatarTone: Record<Customer["avatarColor"], string> = {
  blue: "bg-blue-600",
  violet: "bg-slate-600",
  emerald: "bg-emerald-600",
  amber: "bg-amber-500",
  rose: "bg-rose-500",
  slate: "bg-slate-700",
};

type SortMode = "Highest Spend" | "Newest Order" | "Name A–Z" | "VIP First";
type SectionId = "overview" | "profiles" | "segmentation" | "recommendations";

export default function CustomersPage() {
  const [accountingState, setAccountingState] = useState<AccountingState>(accountingStore.getState());
  const [customersState, setCustomersState] = useState<CustomersState>(customersStore.getState());
  const [searchQuery, setSearchQuery] = useState("");
  const [tableSearch, setTableSearch] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("Highest Spend");
  const [statusFilter, setStatusFilter] = useState<"All" | CustomerStatus>("All");
  const [typeFilter, setTypeFilter] = useState<"All" | CustomerType>("All");
  const [riskById, setRiskById] = useState<Record<string, RiskScore>>({});
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [actionMenuId, setActionMenuId] = useState<string | null>(null);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [activeSection, setActiveSection] = useState<SectionId>("overview");
  const [profileForm, setProfileForm] = useState(accountingStore.getState().profile);
  const [newCustomer, setNewCustomer] = useState({
    name: "",
    email: "",
    company: "",
    industry: "Retail",
    type: "Regular" as CustomerType,
    totalSpent: 0,
    status: "Active" as CustomerStatus,
  });
  const [customerSaveError, setCustomerSaveError] = useState<string | null>(null);
  const itemsPerPage = 8;

  useEffect(() => {
    purgeCustomersStorage();
    const unsubAccounting = accountingStore.subscribe((state) => {
      startTransition(() => setAccountingState(state));
    });
    const unsubCustomers = customersStore.subscribe((state) => {
      startTransition(() => setCustomersState(state));
    });
    const disconnectLive = accountingStore.connectLive();
    const disconnectCustomers = customersStore.connectLive();
    void customersStore.syncFromBackend(true);
    return () => {
      unsubAccounting();
      unsubCustomers();
      disconnectLive();
      disconnectCustomers();
    };
  }, []);

  useEffect(() => {
    void fetchRiskScores("customer")
      .then((rows) => {
        const map: Record<string, RiskScore> = {};
        for (const r of rows) map[r.partner_id] = r;
        setRiskById(map);
      })
      .catch(() => setRiskById({}));
  }, [customersState.customers.length]);

  useEffect(() => {
    if (isProfileOpen) setProfileForm(accountingState.profile);
  }, [isProfileOpen, accountingState.profile]);

  useEffect(() => {
    const closeMenu = (event: MouseEvent) => {
      if (actionMenuId && !(event.target as HTMLElement).closest(".customer-action-menu")) setActionMenuId(null);
    };
    window.addEventListener("click", closeMenu);
    return () => window.removeEventListener("click", closeMenu);
  }, [actionMenuId]);

  const { profile, activities } = accountingState;
  const workspaceName = profile.organization || "your workspace";
  const { booting, syncError } = customersState;
  const metrics = useMemo(() => computeCustomerMetrics(customersState.customers), [customersState.customers]);
  const segments = useMemo(() => computeCustomerSegments(customersState.customers), [customersState.customers]);
  const recommendationCount = useMemo(
    () => customersState.customers.filter((customer) => customer.status === "Inactive" || customer.highValue).slice(0, 12).length,
    [customersState.customers]
  );

  const filteredCustomers = useMemo(() => {
    const query = (tableSearch || searchQuery).trim().toLowerCase();
    let list = customersState.customers.filter((customer) => {
      if (statusFilter !== "All" && customer.status !== statusFilter) return false;
      if (typeFilter !== "All" && customer.type !== typeFilter) return false;
      if (activeSection === "recommendations" && !(customer.highValue || customer.status === "Inactive")) return false;
      if (activeSection === "segmentation" && typeFilter === "All" && statusFilter === "All") return true;
      if (!query) return true;
      return [customer.name, customer.email, customer.company, customer.industry].some((value) => value.toLowerCase().includes(query));
    });

    list = [...list].sort((left, right) => {
      if (sortMode === "Newest Order") return right.lastOrderTs - left.lastOrderTs;
      if (sortMode === "Name A–Z") return left.name.localeCompare(right.name);
      if (sortMode === "VIP First") {
        const rank = (type: CustomerType) => (type === "VIP" ? 0 : type === "Wholesale" ? 1 : 2);
        return rank(left.type) - rank(right.type) || right.totalSpent - left.totalSpent;
      }
      return right.totalSpent - left.totalSpent;
    });
    return list;
  }, [customersState.customers, tableSearch, searchQuery, statusFilter, typeFilter, sortMode, activeSection]);

  const totalPages = Math.max(1, Math.ceil(filteredCustomers.length / itemsPerPage));
  const activePage = Math.min(currentPage, totalPages);
  const paginatedCustomers = useMemo(
    () => filteredCustomers.slice((activePage - 1) * itemsPerPage, activePage * itemsPerPage),
    [filteredCustomers, activePage, itemsPerPage]
  );

  const saveProfile = async (event: React.FormEvent) => {
    event.preventDefault();
    accountingStore.updateProfile(profileForm);
    try {
      await updateAccountingProfile({
        full_name: profileForm.fullName,
        role: profileForm.role,
        organization: profileForm.organization,
        auto_reconciliation: profileForm.autoReconciliation,
        notifications_enabled: profileForm.notificationsEnabled,
      });
    } catch {
      void accountingStore.syncFromBackend(true);
    }
    setIsProfileOpen(false);
  };

  const addCustomer = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!newCustomer.name.trim() || !newCustomer.email.trim() || !newCustomer.company.trim()) return;
    setCustomerSaveError(null);
    try {
      await customersStore.addCustomer({
        name: newCustomer.name.trim(),
        email: newCustomer.email.trim(),
        company: newCustomer.company.trim(),
        industry: newCustomer.industry,
        type: newCustomer.type,
        totalSpent: 0,
        status: newCustomer.status,
      });
      setIsAddOpen(false);
      setNewCustomer({ name: "", email: "", company: "", industry: "Retail", type: "Regular", totalSpent: 0, status: "Active" });
      setCurrentPage(1);
      setActiveSection("overview");
    } catch (error) {
      setCustomerSaveError(error instanceof Error ? error.message : "Could not save customer.");
    }
  };

  const typePill = (type: CustomerType) => {
    const styles =
      type === "VIP"
        ? "bg-[var(--app-hover)] font-semibold text-[var(--app-ink)]"
        : type === "Wholesale"
          ? "bg-[var(--app-hover)] text-[var(--app-ink)]"
          : "bg-[var(--app-surface)] text-[var(--app-muted)] border border-[var(--app-border)]";
    return <span className={`inline-flex rounded-md px-2 py-0.5 text-[13px] font-medium ${styles}`}>{type}</span>;
  };

  const statusPill = (status: CustomerStatus) => {
    const styles = status === "Active"
      ? "bg-[var(--app-positive-bg)] text-[var(--app-positive)]"
      : "bg-[var(--app-hover)] text-[var(--app-muted)]";
    return <span className={`inline-flex rounded-md px-2 py-0.5 text-[13px] font-medium ${styles}`}>{status}</span>;
  };

  const sectionTabs = [
    { id: "overview" as const, label: "Overview" },
    { id: "profiles" as const, label: "Profiles" },
    { id: "segmentation" as const, label: "Segmentation" },
    { id: "recommendations" as const, label: "Recommendations" },
  ];

  return (
    <AppShell
      searchPlaceholder="Search customers, companies, emails…"
      searchValue={searchQuery}
      onSearchChange={(value) => {
        setSearchQuery(value);
        setCurrentPage(1);
      }}
      maxWidthClassName="max-w-[1360px]"
    >
      <PageHeader
        title="Customers"
        description={
          booting
            ? `Loading customer directory for ${workspaceName}…`
            : `Directory and spend for ${workspaceName}.`
        }
        actions={
          <Button type="button" onClick={() => setIsAddOpen(true)}>
            <Plus className="w-3.5 h-3.5" />
            Add Customer
          </Button>
        }
      />

      {syncError ? (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-[var(--app-radius)] border border-[var(--app-critical-border)] bg-[var(--app-critical-bg)] px-4 py-3 text-[13px] text-[var(--app-critical)]">
          <span>{syncError}</span>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => void customersStore.syncFromBackend(true)}
          >
            Retry
          </Button>
        </div>
      ) : null}

      <div className="kpm-tabs">
        {sectionTabs.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              setActiveSection(item.id);
              setCurrentPage(1);
              if (item.id === "segmentation") setTypeFilter("All");
              if (item.id === "recommendations") {
                setStatusFilter("All");
                setTypeFilter("All");
              }
            }}
            className={`px-3 py-1.5 rounded-[var(--app-radius-control)] text-[13px] font-medium cursor-pointer ${
              activeSection === item.id
                ? "border border-[var(--app-border-strong)] bg-[var(--app-surface)] text-[var(--app-ink)]"
                : "text-[var(--app-muted)] hover:bg-[var(--app-hover)]"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <MetricStrip
        items={[
          {
            label: "Total Customers",
            value: booting ? "—" : metrics.totalCustomers.toLocaleString(),
          },
          {
            label: "Active",
            value: booting ? "—" : metrics.activeCustomers.toLocaleString(),
          },
          {
            label: "New",
            value: booting ? "—" : metrics.newCustomers.toLocaleString(),
          },
          {
            label: "Customer Revenue",
            value: booting ? "—" : formatCurrency(metrics.totalRevenue),
          },
        ]}
      />

      <section className="grid grid-cols-1 xl:grid-cols-12 gap-3.5">
        <div className="xl:col-span-8 rounded-[var(--app-radius)] bg-[var(--app-surface)] border border-[var(--app-border)] p-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-[var(--app-border)]">
            <div>
              <h2 className="text-sm font-semibold text-[var(--app-ink)]">Customer List</h2>
              <p className="text-[13px] text-[var(--app-muted)] mt-1">
                {activeSection === "recommendations"
                  ? "Inactive and high-value accounts to review"
                  : "Live directory across all customer segments."}
              </p>
            </div>
            <div className="kpm-toolbar">
                <div className="kpm-toolbar-search relative min-w-0">
                <Search className="w-3.5 h-3.5 text-[var(--app-faint)] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  value={tableSearch}
                  onChange={(event) => {
                    setTableSearch(event.target.value);
                    setCurrentPage(1);
                  }}
                  placeholder="Search customers..."
                  aria-label="Search customers"
                  className="h-9 w-full rounded-[var(--app-radius-control)] border border-[var(--app-border)] bg-[var(--app-hover)] py-2 pl-8 pr-3 text-[13px] outline-none focus:bg-[var(--app-surface)]"
                />
              </div>
              <button
                type="button"
                onClick={() => setIsFilterOpen(true)}
                className="px-3 py-2 border border-[var(--app-border)] rounded-[var(--app-radius-control)] text-[13px] font-semibold flex gap-1.5 items-center cursor-pointer"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" /> Filter
              </button>
              <select
                value={sortMode}
                onChange={(event) => {
                  setSortMode(event.target.value as SortMode);
                  setCurrentPage(1);
                }}
                className="px-3 py-2 border border-[var(--app-border)] rounded-[var(--app-radius-control)] text-[13px] font-semibold bg-[var(--app-surface)]"
              >
                <option>Highest Spend</option>
                <option>Newest Order</option>
                <option>Name A–Z</option>
                <option>VIP First</option>
              </select>
            </div>
          </div>

          <div className="kpm-cards overflow-x-auto">
            {booting ? (
              <TableSkeleton rows={6} />
            ) : (
            <table className="w-full text-[13px] md:min-w-[920px]">
              <thead className="text-[var(--app-muted)]">
                <tr className="border-b border-[var(--app-border)]">
                  <th className="py-3 px-1 text-left">
                    <input
                      type="checkbox"
                      onChange={(event) =>
                        setSelectedIds(event.target.checked ? new Set(paginatedCustomers.map((customer) => customer.id)) : new Set())
                      }
                    />
                  </th>
                  {["Customer", "Company", "Customer Type", "Total Spent", "Last Order", "Status", "Actions"].map((heading) => (
                    <th key={heading} className="py-3 px-2 text-left font-medium">{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginatedCustomers.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-4 px-4">
                      <EmptyState
                        title={
                          tableSearch || statusFilter !== "All" || typeFilter !== "All"
                            ? "No matching customers"
                            : "No customers yet"
                        }
                        description={
                          tableSearch || statusFilter !== "All" || typeFilter !== "All"
                            ? "No customers match your filters. Try clearing search or filters."
                            : "Add your first customer — spend and segments update from your database."
                        }
                        action={
                          !tableSearch && statusFilter === "All" && typeFilter === "All" ? (
                            <Button type="button" onClick={() => setIsAddOpen(true)}>
                              <Plus className="w-3.5 h-3.5" /> Add customer
                            </Button>
                          ) : null
                        }
                      />
                    </td>
                  </tr>
                ) : (
                  paginatedCustomers.map((customer) => (
                    <tr key={customer.id} className="border-b border-[var(--app-border)] last:border-0">
                      <td data-label="Select" className="px-1 py-3">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(customer.id)}
                          aria-label={`Select ${customer.name}`}
                          onChange={() =>
                            setSelectedIds((ids) => {
                              const next = new Set(ids);
                              next.has(customer.id) ? next.delete(customer.id) : next.add(customer.id);
                              return next;
                            })
                          }
                        />
                      </td>
                      <td data-label="Customer" className="kpm-card-lead px-2 py-3">
                        <div className="flex items-center gap-2.5">
                          <span className={`flex h-8 w-8 items-center justify-center rounded-full text-[13px] font-bold text-white ${avatarTone[customer.avatarColor]}`}>
                            {customerInitials(customer.name)}
                          </span>
                          <span>
                            <b className="block text-[var(--app-ink)]">{customer.name}</b>
                            <span className="mt-0.5 block text-[var(--app-muted)]">{customer.email}</span>
                          </span>
                        </div>
                      </td>
                      <td data-label="Company" className="px-2 py-3">
                        <b className="block text-[var(--app-ink)]">{customer.company}</b>
                        <span className="mt-0.5 block text-[var(--app-muted)]">{customer.industry}</span>
                      </td>
                      <td data-label="Type" className="px-2 py-3">{typePill(customer.type)}</td>
                      <td data-label="Spent" className="px-2 py-3 text-[var(--app-ink)] font-semibold">{formatCurrency(customer.totalSpent)}</td>
                      <td data-label="Last order" className="px-2 py-3 text-[var(--app-muted)] whitespace-nowrap">{customer.lastOrder}</td>
                      <td data-label="Status" className="px-2 py-3">
                        <div className="flex flex-col gap-1 items-start">
                          {statusPill(customer.status)}
                          {riskBadge(riskById[customer.id]?.band, riskById[customer.id]?.explanation)}
                        </div>
                      </td>
                      <td data-label="Actions" className="customer-action-menu relative px-2 py-3">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            setActionMenuId(actionMenuId === customer.id ? null : customer.id);
                          }}
                          className="p-1 text-[var(--app-muted)] hover:bg-[var(--app-hover)] rounded cursor-pointer"
                        >
                          <MoreHorizontal className="w-4 h-4" />
                        </button>
                        {actionMenuId === customer.id && (
                          <div className="kpm-row-menu absolute right-2 top-8 z-50 w-40 bg-[var(--app-surface)] border border-[var(--app-border)] shadow-[var(--app-shadow-pop)] rounded-[var(--app-radius)] p-1 text-left">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedCustomer(customer);
                                setActionMenuId(null);
                              }}
                              className="w-full px-2.5 py-2 rounded-[var(--app-radius-control)] hover:bg-[var(--app-hover)] text-[13px] font-semibold"
                            >
                              View profile
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                customersStore.updateCustomer(customer.id, {
                                  status: customer.status === "Active" ? "Inactive" : "Active",
                                });
                                setActionMenuId(null);
                              }}
                              className="w-full px-2.5 py-2 rounded-[var(--app-radius-control)] hover:bg-[var(--app-hover)] text-[13px] font-semibold"
                            >
                              Mark as {customer.status === "Active" ? "Inactive" : "Active"}
                            </button>
                            {customer.type !== "VIP" && (
                              <button
                                type="button"
                                onClick={() => {
                                  customersStore.updateCustomer(customer.id, { type: "VIP" });
                                  setActionMenuId(null);
                                }}
                                className="w-full px-2.5 py-2 rounded-[var(--app-radius-control)] hover:bg-[var(--app-hover)] text-[13px] font-semibold"
                              >
                                Promote to VIP
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            )}
          </div>

          <Pager
            page={activePage}
            totalPages={totalPages}
            onPage={setCurrentPage}
            summary={
              booting
                ? "Syncing directory…"
                : `Showing ${filteredCustomers.length ? (activePage - 1) * itemsPerPage + 1 : 0}–${Math.min(activePage * itemsPerPage, filteredCustomers.length)} of ${filteredCustomers.length} customers`
            }
          />
        </div>

        <div className="xl:col-span-4 space-y-3.5">
          <div className="rounded-[var(--app-radius)] bg-[var(--app-surface)] border border-[var(--app-border)] p-4">
            <div className="flex justify-between border-b border-[var(--app-border)] pb-3">
              <h2 className="text-sm font-semibold text-[var(--app-ink)]">Customer Insights</h2>
              <button type="button" onClick={() => setActiveSection("overview")} className="text-[13px] text-[var(--app-ink)] font-semibold cursor-pointer">
                View all <ArrowRight className="w-3 h-3 inline" />
              </button>
            </div>
            <div className="pt-3 space-y-3">
              {booting ? (
                <p className="text-[13px] text-[var(--app-muted)]">Syncing insights…</p>
              ) : customersState.insights.length === 0 ? (
                <p className="text-[13px] text-[var(--app-muted)]">
                  Insights appear once customers are in your directory.
                </p>
              ) : null}
              {!booting &&
                customersState.insights.slice(0, 4).map((insight) => {
                const Icon =
                  insight.tone === "risk" ? AlertTriangle :
                  insight.tone === "crosssell" ? ShoppingBag :
                  insight.tone === "sentiment" ? Heart :
                  TrendingUp;
                const tone =
                  insight.tone === "risk" ? "bg-[var(--app-critical-bg)] text-[var(--app-critical)]" :
                  insight.tone === "crosssell" ? "bg-[var(--app-warning-bg)] text-[var(--app-warning)]" :
                  insight.tone === "sentiment" ? "bg-[var(--app-positive-bg)] text-[var(--app-positive)]" :
                  "bg-[var(--app-hover)] text-[var(--app-ink)]";
                return (
                  <button
                    key={insight.id}
                    type="button"
                    onClick={() => {
                      if (insight.tone === "risk") {
                        setStatusFilter("Inactive");
                        setActiveSection("recommendations");
                      } else if (insight.tone === "value") {
                        setTypeFilter("VIP");
                        setActiveSection("profiles");
                      } else {
                        setActiveSection("recommendations");
                      }
                      setCurrentPage(1);
                    }}
                    className="w-full text-left flex gap-2.5 cursor-pointer hover:bg-[var(--app-hover)] rounded-[var(--app-radius-control)] p-1 -mx-1"
                  >
                    <span className={`w-7 h-7 rounded-[var(--app-radius-control)] flex items-center justify-center flex-shrink-0 ${tone}`}>
                      <Icon className="w-3.5 h-3.5" />
                    </span>
                    <span>
                      <b className="block text-[13px] text-[var(--app-ink)]">{insight.title}</b>
                      <span className="block text-[13px] text-[var(--app-muted)] mt-0.5 leading-snug">{insight.description}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-[var(--app-radius)] bg-[var(--app-surface)] border border-[var(--app-border)] p-4">
            <div className="flex justify-between border-b border-[var(--app-border)] pb-3">
              <h2 className="text-sm font-semibold text-[var(--app-ink)]">Customer Segments</h2>
              <button
                type="button"
                onClick={() => {
                  setActiveSection("segmentation");
                  setTypeFilter("All");
                  setStatusFilter("All");
                }}
                className="text-[13px] text-[var(--app-ink)] font-semibold cursor-pointer"
              >
                View all <ArrowRight className="w-3 h-3 inline" />
              </button>
            </div>
            <div className="pt-3 space-y-3">
              {booting ? (
                <p className="text-[13px] text-[var(--app-muted)]">Syncing segments…</p>
              ) : null}
              {!booting &&
                segments.map((segment) => (
                <button
                  key={segment.name}
                  type="button"
                  onClick={() => {
                    if (segment.name.startsWith("Inactive")) {
                      setStatusFilter("Inactive");
                      setTypeFilter("All");
                    } else {
                      setStatusFilter("All");
                      setTypeFilter(segment.name.startsWith("VIP") ? "VIP" : segment.name.startsWith("Wholesale") ? "Wholesale" : "Regular");
                    }
                    setActiveSection("segmentation");
                    setCurrentPage(1);
                  }}
                  className="w-full text-left cursor-pointer"
                >
                  <div className="flex items-center justify-between text-[13px] mb-1">
                    <span className="font-semibold text-[var(--app-ink)]">{segment.name}</span>
                    <span className="text-[var(--app-muted)] font-medium">
                      {segment.count} ({segment.percentage}%)
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-[var(--app-hover)] overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${segment.percentage}%`, backgroundColor: segment.color }} />
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-[var(--app-radius)] bg-[var(--app-surface)] border border-[var(--app-border)] p-4 space-y-3">
            <div>
              <h3 className="text-sm font-semibold text-[var(--app-ink)]">Recommendations</h3>
              <p className="text-[13px] text-[var(--app-muted)] mt-1 leading-relaxed">
                {booting
                  ? "Syncing recommendations…"
                  : recommendationCount > 0
                    ? `${recommendationCount} inactive or high-value customers may need outreach this week.`
                    : "No outreach recommendations right now."}
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              onClick={() => {
                setActiveSection("recommendations");
                setCurrentPage(1);
              }}
            >
              View Recommendations <ArrowRight className="w-3 h-3" />
            </Button>
          </div>

          <div className="rounded-[var(--app-radius)] bg-[var(--app-surface)] border border-[var(--app-border)] p-4">
            <div className="text-[13px] font-semibold text-[var(--app-ink)] mb-2">Recent Account Activity</div>
            <div className="space-y-2">
              {activities.slice(0, 3).map((activity) => (
                <div key={activity.id} className="text-[13px]">
                  <div className="font-semibold text-[var(--app-ink)]">{activity.title}</div>
                  <div className="text-[var(--app-muted)]">{activity.subtitle || activity.time}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {isFilterOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/45 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-[var(--app-surface)] rounded-[var(--app-radius)] shadow-[var(--app-shadow-pop)] border border-[var(--app-border)] p-5 text-xs space-y-4">
            <div className="flex justify-between border-b border-[var(--app-border)] pb-3">
              <h2 className="font-semibold text-sm">Filter Customers</h2>
              <button type="button" onClick={() => setIsFilterOpen(false)} className="text-[var(--app-muted)] cursor-pointer"><X className="w-4 h-4" /></button>
            </div>
            <label className="block font-semibold">
              Status
              <select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value as "All" | CustomerStatus); setCurrentPage(1); }} className="mt-1 w-full px-3 py-2 border border-[var(--app-border)] rounded-[var(--app-radius-control)] bg-[var(--app-surface)]">
                <option>All</option>
                <option>Active</option>
                <option>Inactive</option>
              </select>
            </label>
            <label className="block font-semibold">
              Customer type
              <select value={typeFilter} onChange={(event) => { setTypeFilter(event.target.value as "All" | CustomerType); setCurrentPage(1); }} className="mt-1 w-full px-3 py-2 border border-[var(--app-border)] rounded-[var(--app-radius-control)] bg-[var(--app-surface)]">
                <option>All</option>
                <option>VIP</option>
                <option>Regular</option>
                <option>Wholesale</option>
              </select>
            </label>
            <div className="flex justify-end">
              <Button type="button" onClick={() => setIsFilterOpen(false)}>Apply Filters</Button>
            </div>
          </div>
        </div>
      )}

      {isAddOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/45 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[var(--app-surface)] rounded-[var(--app-radius)] shadow-[var(--app-shadow-pop)] border border-[var(--app-border)] p-6 text-xs">
            <div className="flex justify-between border-b border-[var(--app-border)] pb-3">
              <div>
                <h2 className="font-semibold text-base">Add Customer</h2>
                <p className="text-[var(--app-muted)] mt-0.5">Create a new account for {profile.organization}</p>
              </div>
              <button type="button" onClick={() => setIsAddOpen(false)} className="text-[var(--app-muted)] cursor-pointer"><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={addCustomer} className="space-y-3 pt-4">
              {customerSaveError ? (
                <p className="rounded-[var(--app-radius-control)] border border-[var(--app-critical-border)] bg-[var(--app-critical-bg)] px-3 py-2 text-[13px] text-[var(--app-critical)]">
                  {customerSaveError}
                </p>
              ) : null}
              <label className="block font-semibold">
                Full name
                <input required value={newCustomer.name} onChange={(event) => setNewCustomer({ ...newCustomer, name: event.target.value })} className="mt-1 w-full px-3 py-2 border border-[var(--app-border)] rounded-[var(--app-radius-control)]" />
              </label>
              <label className="block font-semibold">
                Email
                <input required type="email" value={newCustomer.email} onChange={(event) => setNewCustomer({ ...newCustomer, email: event.target.value })} className="mt-1 w-full px-3 py-2 border border-[var(--app-border)] rounded-[var(--app-radius-control)]" />
              </label>
              <label className="block font-semibold">
                Company
                <input required value={newCustomer.company} onChange={(event) => setNewCustomer({ ...newCustomer, company: event.target.value })} className="mt-1 w-full px-3 py-2 border border-[var(--app-border)] rounded-[var(--app-radius-control)]" />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="font-semibold">
                  Industry
                  <input value={newCustomer.industry} onChange={(event) => setNewCustomer({ ...newCustomer, industry: event.target.value })} className="mt-1 w-full px-3 py-2 border border-[var(--app-border)] rounded-[var(--app-radius-control)]" />
                </label>
                <label className="font-semibold">
                  Type
                  <select value={newCustomer.type} onChange={(event) => setNewCustomer({ ...newCustomer, type: event.target.value as CustomerType })} className="mt-1 w-full px-3 py-2 border border-[var(--app-border)] rounded-[var(--app-radius-control)] bg-[var(--app-surface)]">
                    <option>VIP</option>
                    <option>Regular</option>
                    <option>Wholesale</option>
                  </select>
                </label>
              </div>
              <label className="block font-semibold">
                Status
                <select value={newCustomer.status} onChange={(event) => setNewCustomer({ ...newCustomer, status: event.target.value as CustomerStatus })} className="mt-1 w-full px-3 py-2 border border-[var(--app-border)] rounded-[var(--app-radius-control)] bg-[var(--app-surface)]">
                  <option>Active</option>
                  <option>Inactive</option>
                </select>
              </label>
              <p className="text-[13px] text-[var(--app-muted)]">Lifetime spend updates automatically when you complete sales for this customer.</p>
              <div className="flex justify-end gap-2 pt-1">
                <Button type="button" variant="secondary" onClick={() => setIsAddOpen(false)}>Cancel</Button>
                <Button type="submit">Save Customer</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedCustomer && (
        <div className="fixed inset-0 z-50 bg-slate-900/45 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[var(--app-surface)] rounded-[var(--app-radius)] shadow-[var(--app-shadow-pop)] border border-[var(--app-border)] p-6 text-xs space-y-3">
            <div className="flex justify-between border-b border-[var(--app-border)] pb-3">
              <div>
                <h2 className="font-semibold text-base">{selectedCustomer.name}</h2>
                <p className="text-[var(--app-muted)] mt-0.5">{selectedCustomer.email}</p>
              </div>
              <button type="button" onClick={() => setSelectedCustomer(null)} className="text-[var(--app-muted)] cursor-pointer"><X className="w-4 h-4" /></button>
            </div>
            <p><strong>Company:</strong> {selectedCustomer.company}</p>
            <p><strong>Industry:</strong> {selectedCustomer.industry}</p>
            <p><strong>Type:</strong> {selectedCustomer.type}</p>
            <p><strong>Total spent:</strong> {formatCurrency(selectedCustomer.totalSpent)}</p>
            <p><strong>Last order:</strong> {selectedCustomer.lastOrder}</p>
            <p><strong>Status:</strong> {selectedCustomer.status}</p>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  customersStore.updateCustomer(selectedCustomer.id, {
                    status: selectedCustomer.status === "Active" ? "Inactive" : "Active",
                  });
                  setSelectedCustomer(null);
                }}
              >
                Toggle status
              </Button>
              <Button type="button" onClick={() => setSelectedCustomer(null)}>Close</Button>
            </div>
          </div>
        </div>
      )}

      {isProfileOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/45 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[var(--app-surface)] rounded-[var(--app-radius)] shadow-[var(--app-shadow-pop)] border border-[var(--app-border)] p-6 text-xs">
            <div className="flex justify-between border-b border-[var(--app-border)] pb-3">
              <div>
                <h2 className="font-semibold text-base">Account Settings</h2>
                <p className="text-[var(--app-muted)] mt-0.5">Profile and automation preferences</p>
              </div>
              <button type="button" onClick={() => setIsProfileOpen(false)} className="text-[var(--app-muted)] cursor-pointer"><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={saveProfile} className="space-y-3 pt-4">
              <label className="block font-semibold">
                Full name
                <input value={profileForm.fullName} onChange={(event) => setProfileForm({ ...profileForm, fullName: event.target.value })} className="mt-1 w-full px-3 py-2 border border-[var(--app-border)] rounded-[var(--app-radius-control)]" />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="font-semibold">
                  Role
                  <input value={profileForm.role} onChange={(event) => setProfileForm({ ...profileForm, role: event.target.value })} className="mt-1 w-full px-3 py-2 border border-[var(--app-border)] rounded-[var(--app-radius-control)]" />
                </label>
                <label className="font-semibold">
                  Organization
                  <input value={profileForm.organization} onChange={(event) => setProfileForm({ ...profileForm, organization: event.target.value })} className="mt-1 w-full px-3 py-2 border border-[var(--app-border)] rounded-[var(--app-radius-control)]" />
                </label>
              </div>
              <label className="flex items-center justify-between rounded-[var(--app-radius-control)] border border-[var(--app-border)] px-3 py-3 font-semibold">
                Auto-reconciliation
                <input type="checkbox" checked={profileForm.autoReconciliation} onChange={(event) => setProfileForm({ ...profileForm, autoReconciliation: event.target.checked })} />
              </label>
              <label className="flex items-center justify-between rounded-[var(--app-radius-control)] border border-[var(--app-border)] px-3 py-3 font-semibold">
                Sales and payment notifications
                <input type="checkbox" checked={profileForm.notificationsEnabled} onChange={(event) => setProfileForm({ ...profileForm, notificationsEnabled: event.target.checked })} />
              </label>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="secondary" onClick={() => setIsProfileOpen(false)}>Cancel</Button>
                <Button type="submit">Save Settings</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}
