"use client";

import React, { startTransition, useEffect, useMemo, useState } from "react";
import {
  Armchair,
  ArrowRight,
  BadgeCheck,
  ChevronRight,
  FileText,
  Home,
  Laptop,
  MapPin,
  MoreHorizontal,
  Package,
  Percent,
  Search,
  Shield,
  Shirt,
  SlidersHorizontal,
  Star,
  Wallet,
  X,
} from "lucide-react";
import { accountingStore, AccountingState } from "@/lib/accountingStore";
import { AppShell } from "@/components/AppShell";
import { EmptyState } from "@/components/EmptyState";
import {
  computeCategoryCounts,
  computeSupplierMetrics,
  Supplier,
  SuppliersState,
  suppliersStore,
} from "@/lib/suppliersStore";
import { updateAccountingProfile, fetchRiskScores, type RiskScore } from "@/lib/api";
import { purgeSuppliersStorage } from "@/lib/storePersistence";
import { PageHeader } from "@/components/ui/PageHeader";
import { MetricStrip } from "@/components/ui/MetricStrip";
import { Button } from "@/components/ui/Button";
import { Pager } from "@/components/ui/Pager";
import { TableSkeleton } from "@/components/ui/Skeleton";

const formatCurrency = (amount: number) =>
  `$${amount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

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
      className={`inline-flex rounded-md px-2 py-0.5 text-[13px] font-medium ${styles}`}
    >
      Risk {band}
    </span>
  );
}

function formatReviews(count: number) {
  if (count >= 1000) return `${(count / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  return String(count);
}

type SortMode = "Highest Rating" | "Lowest Min Order" | "Most Products" | "Name A–Z";
type SectionId = "directory" | "orders" | "performance";

export default function SuppliersPage() {
  const [accountingState, setAccountingState] = useState<AccountingState>(accountingStore.getState());
  const [suppliersState, setSuppliersState] = useState<SuppliersState>(suppliersStore.getState());
  const [searchQuery, setSearchQuery] = useState("");
  const [tableSearch, setTableSearch] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("Highest Rating");
  const [statusFilter, setStatusFilter] = useState<"All" | "Active" | "Pending">("All");
  const [categoryFilter, setCategoryFilter] = useState<string>("All");
  const [riskById, setRiskById] = useState<Record<string, RiskScore>>({});
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [actionMenuId, setActionMenuId] = useState<string | null>(null);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isRequestOpen, setIsRequestOpen] = useState(false);
  const [isFindOpen, setIsFindOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [activeSection, setActiveSection] = useState<SectionId>("directory");
  const [findQuery, setFindQuery] = useState("");
  const [requestForm, setRequestForm] = useState({ need: "", category: "Electronics", budget: 1000 });
  const [profileForm, setProfileForm] = useState(accountingStore.getState().profile);
  const itemsPerPage = 8;

  useEffect(() => {
    purgeSuppliersStorage();
    const unsubAccounting = accountingStore.subscribe((state) => {
      startTransition(() => setAccountingState(state));
    });
    const unsubSuppliers = suppliersStore.subscribe((state) => {
      startTransition(() => setSuppliersState(state));
    });
    const disconnectLive = accountingStore.connectLive();
    const disconnectSuppliers = suppliersStore.connectLive();
    void suppliersStore.syncFromBackend(true);
    return () => {
      unsubAccounting();
      unsubSuppliers();
      disconnectLive();
      disconnectSuppliers();
    };
  }, []);

  useEffect(() => {
    void fetchRiskScores("supplier")
      .then((rows) => {
        const map: Record<string, RiskScore> = {};
        for (const r of rows) map[r.partner_id] = r;
        setRiskById(map);
      })
      .catch(() => setRiskById({}));
  }, [suppliersState.suppliers.length]);

  useEffect(() => {
    if (isProfileOpen) setProfileForm(accountingState.profile);
  }, [isProfileOpen, accountingState.profile]);

  useEffect(() => {
    const closeMenu = (event: MouseEvent) => {
      if (actionMenuId && !(event.target as HTMLElement).closest(".supplier-action-menu")) setActionMenuId(null);
    };
    window.addEventListener("click", closeMenu);
    return () => window.removeEventListener("click", closeMenu);
  }, [actionMenuId]);

  const { activities } = accountingState;
  const workspaceName = accountingState.profile.organization || "your workspace";
  const { booting, syncError } = suppliersState;
  const metrics = useMemo(
    () => computeSupplierMetrics(suppliersState.suppliers),
    [suppliersState.suppliers]
  );
  const categories = useMemo(
    () => computeCategoryCounts(suppliersState.suppliers),
    [suppliersState.suppliers]
  );

  const filteredSuppliers = useMemo(() => {
    const query = (tableSearch || searchQuery).trim().toLowerCase();
    let list = suppliersState.suppliers.filter((supplier) => {
      if (statusFilter !== "All" && supplier.status !== statusFilter) return false;
      if (categoryFilter !== "All" && !supplier.categories.some((category) => category.toLowerCase().includes(categoryFilter.toLowerCase()))) {
        return false;
      }
      if (activeSection === "orders" && supplier.status !== "Pending") return false;
      if (!query) return true;
      return [supplier.name, supplier.location, ...supplier.categories].some((value) => value.toLowerCase().includes(query));
    });

    list = [...list].sort((left, right) => {
      if (sortMode === "Lowest Min Order") return left.minOrder - right.minOrder;
      if (sortMode === "Most Products") return right.products - left.products;
      if (sortMode === "Name A–Z") return left.name.localeCompare(right.name);
      return right.rating - left.rating;
    });
    return list;
  }, [suppliersState.suppliers, tableSearch, searchQuery, statusFilter, categoryFilter, sortMode, activeSection]);

  const totalPages = Math.max(1, Math.ceil(filteredSuppliers.length / itemsPerPage));
  const activePage = Math.min(currentPage, totalPages);
  const paginatedSuppliers = useMemo(
    () => filteredSuppliers.slice((activePage - 1) * itemsPerPage, activePage * itemsPerPage),
    [filteredSuppliers, activePage, itemsPerPage]
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

  const submitRequest = (event: React.FormEvent) => {
    event.preventDefault();
    if (!requestForm.need.trim()) return;
    void suppliersStore.requestSupplier(requestForm).finally(() => {
      setIsRequestOpen(false);
      setRequestForm({ need: "", category: "Electronics", budget: 1000 });
      setActiveSection("directory");
    });
  };

  const runFind = (event: React.FormEvent) => {
    event.preventDefault();
    setTableSearch(findQuery);
    setSearchQuery(findQuery);
    setSortMode("Highest Rating");
    setCurrentPage(1);
    setIsFindOpen(false);
    setActiveSection("directory");
  };

  const categoryIcon = (icon: string) => {
    if (icon === "furniture") return Armchair;
    if (icon === "office") return FileText;
    if (icon === "home") return Home;
    if (icon === "fashion") return Shirt;
    return Laptop;
  };

  const sectionTabs = [
    { id: "directory" as const, label: "Directory" },
    { id: "orders" as const, label: "Pending" },
    { id: "performance" as const, label: "Performance" },
  ];

  return (
    <AppShell
      searchPlaceholder="Search suppliers, products, categories…"
      searchValue={searchQuery}
      onSearchChange={(value) => {
        setSearchQuery(value);
        setCurrentPage(1);
      }}
      maxWidthClassName="max-w-[1360px]"
    >
      <PageHeader
        title="Suppliers"
        description={
          booting
            ? `Loading vendor directory for ${workspaceName}…`
            : `Vendor directory and spend for ${workspaceName}.`
        }
        actions={
          <>
            <Button type="button" variant="secondary" onClick={() => setIsFindOpen(true)}>
              Find Suppliers
            </Button>
            <Button type="button" onClick={() => setIsRequestOpen(true)}>
              Request Supplier
            </Button>
          </>
        }
      />

      {syncError ? (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-[var(--app-radius)] border border-[var(--app-critical-border)] bg-[var(--app-critical-bg)] px-4 py-3 text-[13px] text-[var(--app-critical)]">
          <span>{syncError}</span>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => void suppliersStore.syncFromBackend(true)}
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
              if (item.id === "directory") setStatusFilter("All");
              if (item.id === "orders") setStatusFilter("Pending");
              if (item.id === "performance") setSortMode("Highest Rating");
              setCurrentPage(1);
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
            label: "Total Suppliers",
            value: booting ? "—" : String(metrics.totalSuppliers),
          },
          {
            label: "Active",
            value: booting ? "—" : String(metrics.activeSuppliers),
          },
          {
            label: "Pending Approvals",
            value: booting ? "—" : String(metrics.pendingApprovals),
          },
          {
            label: "Spend (This Month)",
            value: booting ? "—" : formatCurrency(metrics.totalSpend),
          },
        ]}
      />

      <section className="grid grid-cols-1 xl:grid-cols-12 gap-3.5">
        <div className="xl:col-span-8 rounded-[var(--app-radius)] bg-[var(--app-surface)] border border-[var(--app-border)] p-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-[var(--app-border)]">
            <div>
              <h2 className="text-sm font-semibold text-[var(--app-ink)]">Supplier Directory</h2>
              <p className="text-[13px] text-[var(--app-muted)] mt-1">
                Partners matched to {workspaceName} inventory needs.
              </p>
            </div>
            <div className="kpm-toolbar">
              <div className="kpm-toolbar-search relative">
                <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--app-faint)]" />
                <input
                  value={tableSearch}
                  onChange={(event) => {
                    setTableSearch(event.target.value);
                    setCurrentPage(1);
                  }}
                  placeholder="Search suppliers..."
                  aria-label="Search suppliers"
                  className="h-9 w-full rounded-[var(--app-radius-control)] border border-[var(--app-border)] bg-[var(--app-hover)] py-2 pl-8 pr-3 text-[13px] outline-none focus:bg-[var(--app-surface)]"
                />
              </div>
              <button
                type="button"
                onClick={() => setIsFilterOpen(true)}
                className="flex cursor-pointer items-center justify-center gap-1.5 rounded-[var(--app-radius-control)] border border-[var(--app-border)] px-3 py-2 text-[13px] font-semibold"
              >
                <SlidersHorizontal className="h-3.5 w-3.5" /> Filters
              </button>
              <select
                value={sortMode}
                onChange={(event) => {
                  setSortMode(event.target.value as SortMode);
                  setCurrentPage(1);
                }}
                aria-label="Sort suppliers"
                className="rounded-[var(--app-radius-control)] border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2 text-[13px] font-semibold"
              >
                <option>Highest Rating</option>
                <option>Lowest Min Order</option>
                <option>Most Products</option>
                <option>Name A–Z</option>
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
                        setSelectedIds(event.target.checked ? new Set(paginatedSuppliers.map((supplier) => supplier.id)) : new Set())
                      }
                    />
                  </th>
                  {["Supplier", "Products", "Location", "Rating", "Response Time", "Min. Order", "Actions"].map((heading) => (
                    <th key={heading} className="py-3 px-2 text-left font-medium">{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginatedSuppliers.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-4 px-4">
                      <EmptyState
                        title={suppliersState.suppliers.length === 0 ? "No suppliers yet" : "No matching suppliers"}
                        description={
                          suppliersState.suppliers.length === 0
                            ? "Add or request a supplier — the directory syncs from your database."
                            : "Adjust filters or clear search to see more results."
                        }
                        action={
                          suppliersState.suppliers.length === 0 ? (
                            <Button type="button" onClick={() => setIsRequestOpen(true)}>
                              Request supplier
                            </Button>
                          ) : null
                        }
                      />
                    </td>
                  </tr>
                ) : (
                  paginatedSuppliers.map((supplier) => (
                    <tr key={supplier.id} className="border-b border-[var(--app-border)] last:border-0">
                      <td data-label="Select" className="px-1 py-3">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(supplier.id)}
                          aria-label={`Select ${supplier.name}`}
                          onChange={() =>
                            setSelectedIds((ids) => {
                              const next = new Set(ids);
                              next.has(supplier.id) ? next.delete(supplier.id) : next.add(supplier.id);
                              return next;
                            })
                          }
                        />
                      </td>
                      <td data-label="Supplier" className="kpm-card-lead px-2 py-3">
                        <div className="flex items-center gap-2.5">
                          <span className="flex h-8 w-8 items-center justify-center rounded-[var(--app-radius-control)] bg-[var(--app-hover)] text-[13px] font-semibold text-[var(--app-ink)]">
                            {supplier.initial}
                          </span>
                          <span>
                            <span className="flex flex-wrap items-center gap-1.5">
                              <b className="text-[var(--app-ink)]">{supplier.name}</b>
                              {supplier.verified && (
                                <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-[var(--app-muted)]">
                                  <BadgeCheck className="w-3 h-3" /> Verified
                                </span>
                              )}
                              {riskBadge(riskById[supplier.id]?.band, riskById[supplier.id]?.explanation)}
                            </span>
                            <span className="mt-0.5 block text-[var(--app-muted)]">{supplier.categories.join(" · ")}</span>
                          </span>
                        </div>
                      </td>
                      <td data-label="Products" className="px-2 py-3 text-[var(--app-muted)] font-semibold">{supplier.products}+</td>
                      <td data-label="Location" className="px-2 py-3 text-[var(--app-muted)]">
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-[var(--app-faint)]" />
                          {supplier.location}
                        </span>
                      </td>
                      <td data-label="Rating" className="px-2 py-3 font-semibold text-[var(--app-ink)]">
                        <span className="inline-flex items-center gap-1">
                          <Star className="h-3 w-3 fill-[var(--app-warning)] text-[var(--app-warning)]" />
                          {supplier.rating.toFixed(1)}{" "}
                          <span className="font-normal text-[var(--app-muted)]">({formatReviews(supplier.reviews)})</span>
                        </span>
                      </td>
                      <td data-label="Response" className="px-2 py-3 text-[var(--app-muted)]">{supplier.responseTime}</td>
                      <td data-label="Min. order" className="px-2 py-3 text-[var(--app-ink)] font-semibold">{formatCurrency(supplier.minOrder)}</td>
                      <td data-label="Actions" className="supplier-action-menu relative px-2 py-3">
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setSelectedSupplier(supplier)}
                            className="px-2.5 py-1.5 rounded-[var(--app-radius-control)] border border-[var(--app-border)] text-[13px] font-semibold hover:bg-[var(--app-hover)] cursor-pointer"
                          >
                            View
                          </button>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              setActionMenuId(actionMenuId === supplier.id ? null : supplier.id);
                            }}
                            className="p-1 text-[var(--app-muted)] hover:bg-[var(--app-hover)] rounded cursor-pointer"
                          >
                            <MoreHorizontal className="w-4 h-4" />
                          </button>
                        </div>
                        {actionMenuId === supplier.id && (
                          <div className="kpm-row-menu absolute right-2 top-10 z-50 w-40 bg-[var(--app-surface)] border border-[var(--app-border)] shadow-[var(--app-shadow-pop)] rounded-[var(--app-radius)] p-1 text-left">
                            {supplier.status === "Pending" && (
                              <button
                                type="button"
                                onClick={() => {
                                  void suppliersStore.approveSupplier(supplier.id);
                                  setActionMenuId(null);
                                }}
                                className="w-full px-2.5 py-2 rounded-[var(--app-radius-control)] hover:bg-[var(--app-hover)] text-[13px] font-semibold"
                              >
                                Approve supplier
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedSupplier(supplier);
                                setActionMenuId(null);
                              }}
                              className="w-full px-2.5 py-2 rounded-[var(--app-radius-control)] hover:bg-[var(--app-hover)] text-[13px] font-semibold"
                            >
                              View details
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setCategoryFilter(supplier.categories[0] || "All");
                                setCurrentPage(1);
                                setActionMenuId(null);
                              }}
                              className="w-full px-2.5 py-2 rounded-[var(--app-radius-control)] hover:bg-[var(--app-hover)] text-[13px] font-semibold"
                            >
                              Filter by category
                            </button>
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
                : `Showing ${filteredSuppliers.length ? (activePage - 1) * itemsPerPage + 1 : 0}–${Math.min(activePage * itemsPerPage, filteredSuppliers.length)} of ${filteredSuppliers.length} suppliers`
            }
          />
        </div>

        <div className="xl:col-span-4 space-y-3.5">
          <div className="rounded-[var(--app-radius)] bg-[var(--app-surface)] border border-[var(--app-border)] p-4">
            <div className="flex justify-between border-b border-[var(--app-border)] pb-3">
              <h2 className="text-sm font-semibold text-[var(--app-ink)]">Supplier Insights</h2>
              <button type="button" onClick={() => setActiveSection("directory")} className="text-[13px] text-[var(--app-ink)] font-semibold cursor-pointer">
                View all <ArrowRight className="w-3 h-3 inline" />
              </button>
            </div>
            <div className="pt-3 space-y-3">
              {booting ? (
                <p className="text-[13px] text-[var(--app-muted)]">Syncing insights…</p>
              ) : suppliersState.insights.length === 0 ? (
                <p className="text-[13px] text-[var(--app-muted)]">
                  Insights appear once suppliers are in your directory.
                </p>
              ) : null}
              {!booting &&
                suppliersState.insights.slice(0, 4).map((insight) => {
                const Icon =
                  insight.tone === "reliability" ? Shield :
                  insight.tone === "savings" ? Wallet :
                  insight.tone === "match" ? Star :
                  Percent;
                const tone =
                  insight.tone === "reliability" ? "bg-[var(--app-hover)] text-[var(--app-ink)]" :
                  insight.tone === "savings" ? "bg-[var(--app-positive-bg)] text-[var(--app-positive)]" :
                  insight.tone === "match" ? "bg-[var(--app-warning-bg)] text-[var(--app-warning)]" :
                  "bg-[var(--app-hover)] text-[var(--app-muted)]";
                return (
                  <button
                    key={insight.id}
                    type="button"
                    onClick={() => {
                      setTableSearch("");
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
              <h2 className="text-sm font-semibold text-[var(--app-ink)]">By Category</h2>
              <button type="button" onClick={() => setCategoryFilter("All")} className="text-[13px] text-[var(--app-ink)] font-semibold cursor-pointer">
                Clear <ArrowRight className="w-3 h-3 inline" />
              </button>
            </div>
            <div className="pt-2">
              {booting ? (
                <p className="py-2 text-[13px] text-[var(--app-muted)]">Syncing categories…</p>
              ) : null}
              {!booting &&
                categories.map((category) => {
                const Icon = categoryIcon(category.icon);
                return (
                  <button
                    key={category.name}
                    type="button"
                    onClick={() => {
                      setCategoryFilter(category.name);
                      setCurrentPage(1);
                    }}
                    className="w-full flex items-center justify-between py-2.5 text-[13px] hover:bg-[var(--app-hover)] rounded-[var(--app-radius-control)] cursor-pointer"
                  >
                    <span className="flex items-center gap-2.5 text-[var(--app-ink)] font-semibold">
                      <span className="w-7 h-7 rounded-[var(--app-radius-control)] bg-[var(--app-hover)] text-[var(--app-muted)] flex items-center justify-center">
                        <Icon className="w-3.5 h-3.5" />
                      </span>
                      {category.name}
                    </span>
                    <span className="text-[var(--app-muted)] font-medium">
                      {category.count} <ChevronRight className="w-3 h-3 inline text-[var(--app-faint)]" />
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-[var(--app-radius)] bg-[var(--app-surface)] border border-[var(--app-border)] p-4 space-y-3">
            <div className="w-10 h-10 rounded-[var(--app-radius-control)] bg-[var(--app-hover)] border border-[var(--app-border)] flex items-center justify-center text-[var(--app-ink)]">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[var(--app-ink)]">Need a custom supplier?</h3>
              <p className="text-[13px] text-[var(--app-muted)] mt-1 leading-relaxed">
                Describe what you need and we&apos;ll add a sourcing request.
              </p>
            </div>
            <Button type="button" size="sm" onClick={() => setIsRequestOpen(true)}>
              Request Supplier <ArrowRight className="w-3 h-3" />
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
              <h2 className="font-semibold text-sm">Filter Suppliers</h2>
              <button type="button" onClick={() => setIsFilterOpen(false)} className="text-[var(--app-muted)] cursor-pointer"><X className="w-4 h-4" /></button>
            </div>
            <label className="block font-semibold">
              Status
              <select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value as "All" | "Active" | "Pending"); setCurrentPage(1); }} className="mt-1 w-full px-3 py-2 border border-[var(--app-border)] rounded-[var(--app-radius-control)] bg-[var(--app-surface)]">
                <option>All</option>
                <option>Active</option>
                <option>Pending</option>
              </select>
            </label>
            <label className="block font-semibold">
              Category
              <select value={categoryFilter} onChange={(event) => { setCategoryFilter(event.target.value); setCurrentPage(1); }} className="mt-1 w-full px-3 py-2 border border-[var(--app-border)] rounded-[var(--app-radius-control)] bg-[var(--app-surface)]">
                <option>All</option>
                <option>Electronics</option>
                <option>Furniture</option>
                <option>Office Supplies</option>
                <option>Home & Kitchen</option>
                <option>Fashion</option>
              </select>
            </label>
            <div className="flex justify-end">
              <Button type="button" onClick={() => setIsFilterOpen(false)}>Apply Filters</Button>
            </div>
          </div>
        </div>
      )}

      {isFindOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/45 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[var(--app-surface)] rounded-[var(--app-radius)] shadow-[var(--app-shadow-pop)] border border-[var(--app-border)] p-6 text-xs">
            <div className="flex justify-between border-b border-[var(--app-border)] pb-3">
              <div>
                <h2 className="font-semibold text-base">Find Suppliers</h2>
                <p className="text-[var(--app-muted)] mt-0.5">Search by product, category, or location</p>
              </div>
              <button type="button" onClick={() => setIsFindOpen(false)} className="text-[var(--app-muted)] cursor-pointer"><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={runFind} className="space-y-3 pt-4">
              <label className="block font-semibold">
                Search query
                <input
                  value={findQuery}
                  onChange={(event) => setFindQuery(event.target.value)}
                  placeholder="e.g. laptops, office chairs, Shenzhen"
                  className="mt-1 w-full px-3 py-2 border border-[var(--app-border)] rounded-[var(--app-radius-control)] outline-none focus:border-[var(--app-border-strong)]"
                />
              </label>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="secondary" onClick={() => setIsFindOpen(false)}>Cancel</Button>
                <Button type="submit">Search</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isRequestOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/45 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[var(--app-surface)] rounded-[var(--app-radius)] shadow-[var(--app-shadow-pop)] border border-[var(--app-border)] p-6 text-xs">
            <div className="flex justify-between border-b border-[var(--app-border)] pb-3">
              <div>
                <h2 className="font-semibold text-base">Request Supplier</h2>
                <p className="text-[var(--app-muted)] mt-0.5">Submit a sourcing request for {workspaceName}</p>
              </div>
              <button type="button" onClick={() => setIsRequestOpen(false)} className="text-[var(--app-muted)] cursor-pointer"><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={submitRequest} className="space-y-3 pt-4">
              <label className="block font-semibold">
                What do you need?
                <input required value={requestForm.need} onChange={(event) => setRequestForm({ ...requestForm, need: event.target.value })} className="mt-1 w-full px-3 py-2 border border-[var(--app-border)] rounded-[var(--app-radius-control)]" />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="font-semibold">
                  Category
                  <select value={requestForm.category} onChange={(event) => setRequestForm({ ...requestForm, category: event.target.value })} className="mt-1 w-full px-3 py-2 border border-[var(--app-border)] rounded-[var(--app-radius-control)] bg-[var(--app-surface)]">
                    <option>Electronics</option>
                    <option>Furniture</option>
                    <option>Office Supplies</option>
                    <option>Home & Kitchen</option>
                    <option>Fashion</option>
                  </select>
                </label>
                <label className="font-semibold">
                  Budget ($)
                  <input type="number" min="0" value={requestForm.budget} onChange={(event) => setRequestForm({ ...requestForm, budget: Number(event.target.value) })} className="mt-1 w-full px-3 py-2 border border-[var(--app-border)] rounded-[var(--app-radius-control)]" />
                </label>
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="secondary" onClick={() => setIsRequestOpen(false)}>Cancel</Button>
                <Button type="submit">Submit Request</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedSupplier && (
        <div className="fixed inset-0 z-50 bg-slate-900/45 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[var(--app-surface)] rounded-[var(--app-radius)] shadow-[var(--app-shadow-pop)] border border-[var(--app-border)] p-6 text-xs space-y-3">
            <div className="flex justify-between border-b border-[var(--app-border)] pb-3">
              <div>
                <h2 className="font-semibold text-base">{selectedSupplier.name}</h2>
                <p className="text-[var(--app-muted)] mt-0.5">{selectedSupplier.location}</p>
              </div>
              <button type="button" onClick={() => setSelectedSupplier(null)} className="text-[var(--app-muted)] cursor-pointer"><X className="w-4 h-4" /></button>
            </div>
            <p><strong>Categories:</strong> {selectedSupplier.categories.join(", ")}</p>
            <p><strong>Products:</strong> {selectedSupplier.products}+</p>
            <p><strong>Rating:</strong> {selectedSupplier.rating.toFixed(1)} ({formatReviews(selectedSupplier.reviews)} reviews)</p>
            <p><strong>Response:</strong> {selectedSupplier.responseTime}</p>
            <p><strong>Min. Order:</strong> {formatCurrency(selectedSupplier.minOrder)}</p>
            <p><strong>Status:</strong> {selectedSupplier.status}</p>
            <p><strong>Spend this month:</strong> {formatCurrency(selectedSupplier.spendThisMonth)}</p>
            <div className="flex justify-end gap-2 pt-2">
              {selectedSupplier.status === "Pending" && (
                <Button
                  type="button"
                  onClick={() => {
                    void suppliersStore.approveSupplier(selectedSupplier.id);
                    setSelectedSupplier(null);
                  }}
                >
                  Approve
                </Button>
              )}
              <Button type="button" variant="secondary" onClick={() => setSelectedSupplier(null)}>
                Close
              </Button>
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
