"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Tag,
  SlidersHorizontal,
  LayoutGrid,
  List,
  MoreHorizontal,
  Plus,
  Upload,
  AlertTriangle,
  CheckCircle2,
  Package,
  Armchair,
  Cpu,
  Watch,
  Folder,
  Layers,
  X,
  Edit2,
  Trash2,
  RefreshCw,
  RotateCcw,
  Headphones,
  Mouse,
  Cable,
  HardDrive,
  Coffee,
  Lamp,
  BookOpen,
  Home,
} from "lucide-react";
import {
  inventoryStore,
  InventoryProduct,
  InventoryState,
} from "@/lib/inventoryStore";
import {
  fetchPurchaseDrafts,
  acceptPurchaseDraft,
  type PurchaseDraft,
} from "@/lib/api";
import { purgeInventoryStorage } from "@/lib/storePersistence";
import { authStore } from "@/lib/authStore";
import { EmptyState } from "@/components/EmptyState";
import { AppShell } from "@/components/AppShell";
import { PageHeader, SectionHeading } from "@/components/ui/PageHeader";
import { MetricStrip } from "@/components/ui/MetricStrip";
import { Button } from "@/components/ui/Button";
import { Status } from "@/components/ui/Status";
import { TableSkeleton } from "@/components/ui/Skeleton";

const DEFAULT_CATEGORY_OPTIONS = [
  "Electronics",
  "Furniture",
  "Accessories",
  "Home & Kitchen",
  "Stationery",
  "Bags & Luggage",
  "Others",
];

export default function InventoryPage() {
  const [storeState, setStoreState] = useState<InventoryState>(inventoryStore.getState());
  const [workspaceName, setWorkspaceName] = useState(
    () => authStore.getState().user?.organization || "your workspace"
  );
  const [activeTab, setActiveTab] = useState<"all" | "in_stock" | "low_stock" | "out_of_stock">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [drafts, setDrafts] = useState<PurchaseDraft[]>([]);
  const [draftBusy, setDraftBusy] = useState<string | null>(null);
  const [importBusy, setImportBusy] = useState(false);
  const [mutationBusy, setMutationBusy] = useState(false);
  const importFileRef = useRef<HTMLInputElement>(null);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<InventoryProduct | null>(null);
  const [adjustingProduct, setAdjustingProduct] = useState<InventoryProduct | null>(null);
  const [actionMenuOpenId, setActionMenuOpenId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    subtitle: "",
    sku: "",
    category: "Electronics",
    stock: 0,
    price: 0,
    lowStockThreshold: 15,
  });

  const [customStockAmount, setCustomStockAmount] = useState<number>(0);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>("All");
  const [productSaveError, setProductSaveError] = useState<string | null>(null);

  useEffect(() => {
    purgeInventoryStorage();
    const unsubscribe = inventoryStore.subscribe((newState) => {
      setStoreState({ ...newState });
    });
    const unsubAuth = authStore.subscribe((state) => {
      setWorkspaceName(state.user?.organization || "your workspace");
    });
    const disconnectLive = inventoryStore.connectLive();
    void inventoryStore.syncFromBackend(true);
    return () => {
      unsubscribe();
      unsubAuth();
      disconnectLive();
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (actionMenuOpenId && !(e.target as HTMLElement).closest(".action-menu-container")) {
        setActionMenuOpenId(null);
      }
    };
    window.addEventListener("click", handleClickOutside);
    return () => window.removeEventListener("click", handleClickOutside);
  }, [actionMenuOpenId]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("add") === "1") {
      setEditingProduct(null);
      setFormData({
        name: "",
        subtitle: "",
        sku: `SKU-${Math.floor(100 + Math.random() * 900)}`,
        category: "Electronics",
        stock: 0,
        price: 0,
        lowStockThreshold: 15,
      });
      setIsAddModalOpen(true);
      window.history.replaceState({}, "", "/inventory");
    } else if (params.get("import") === "1") {
      setIsImportModalOpen(true);
      window.history.replaceState({}, "", "/inventory");
    }
  }, []);

  const { products, alerts, metrics, booting, syncError } = storeState;

  const categoryFilters = useMemo(() => {
    const fromProducts = Array.from(
      new Set(products.map((p) => p.category).filter(Boolean))
    ).sort((a, b) => a.localeCompare(b));
    return ["All", ...fromProducts];
  }, [products]);

  const formCategoryOptions = useMemo(() => {
    const merged = new Set([...DEFAULT_CATEGORY_OPTIONS, ...products.map((p) => p.category).filter(Boolean)]);
    return Array.from(merged);
  }, [products]);

  useEffect(() => {
    if (selectedCategoryFilter !== "All" && !categoryFilters.includes(selectedCategoryFilter)) {
      setSelectedCategoryFilter("All");
    }
  }, [categoryFilters, selectedCategoryFilter]);

  const reloadDrafts = () => {
    void fetchPurchaseDrafts()
      .then(setDrafts)
      .catch(() => setDrafts([]));
  };

  useEffect(() => {
    reloadDrafts();
  }, [products.length]);

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (activeTab === "in_stock" && p.status !== "In Stock") return false;
      if (activeTab === "low_stock" && p.status !== "Low Stock") return false;
      if (activeTab === "out_of_stock" && p.status !== "Out of Stock") return false;
      if (selectedCategoryFilter !== "All" && p.category !== selectedCategoryFilter) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = p.name.toLowerCase().includes(q);
        const matchSku = p.sku.toLowerCase().includes(q);
        const matchSub = p.subtitle?.toLowerCase().includes(q) || false;
        const matchCat = p.category.toLowerCase().includes(q);
        if (!matchName && !matchSku && !matchSub && !matchCat) return false;
      }

      return true;
    });
  }, [products, activeTab, selectedCategoryFilter, searchQuery]);

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(new Set(filteredProducts.map((p) => p.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectRow = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const openAddModal = () => {
    setEditingProduct(null);
    setProductSaveError(null);
    setFormData({
      name: "",
      subtitle: "",
      sku: `SKU-${Math.floor(100 + Math.random() * 900)}`,
      category: "Electronics",
      stock: 0,
      price: 0,
      lowStockThreshold: 15,
    });
    setIsAddModalOpen(true);
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || mutationBusy) return;
    setProductSaveError(null);
    setMutationBusy(true);

    const payload = {
      name: formData.name.trim(),
      subtitle: formData.subtitle.trim() || "Standard Item",
      sku: formData.sku.trim() || `SKU-${Math.floor(100 + Math.random() * 900)}`,
      category: formData.category,
      stock: Number(formData.stock) || 0,
      price: Number(formData.price) || 0,
      low_stock_threshold: Number(formData.lowStockThreshold) || 15,
    };

    try {
      if (editingProduct) {
        await inventoryStore.updateProductAsync(editingProduct.id, payload);
        setEditingProduct(null);
      } else {
        await inventoryStore.createProductAsync(payload);
      }
      setIsAddModalOpen(false);
      setFormData({
        name: "",
        subtitle: "",
        sku: "",
        category: "Electronics",
        stock: 0,
        price: 0,
        lowStockThreshold: 15,
      });
    } catch (error) {
      setProductSaveError(error instanceof Error ? error.message : "Could not save product.");
    } finally {
      setMutationBusy(false);
    }
  };

  const handleOpenEdit = (p: InventoryProduct) => {
    setEditingProduct(p);
    setProductSaveError(null);
    setFormData({
      name: p.name,
      subtitle: p.subtitle || "",
      sku: p.sku,
      category: p.category,
      stock: p.stock,
      price: p.price,
      lowStockThreshold: p.lowStockThreshold || 15,
    });
    setIsAddModalOpen(true);
    setActionMenuOpenId(null);
  };

  const handleDeleteProduct = async (id: string) => {
    if (!confirm("Are you sure you want to delete this product from inventory?")) return;
    setActionMenuOpenId(null);
    setMutationBusy(true);
    try {
      await inventoryStore.deleteProductAsync(id);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Could not delete product.");
    } finally {
      setMutationBusy(false);
    }
  };

  const handleQuickAdjustStock = async (product: InventoryProduct, delta: number) => {
    if (mutationBusy) return;
    setMutationBusy(true);
    try {
      await inventoryStore.adjustStockAsync(product.id, delta, true);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Could not adjust stock.");
    } finally {
      setMutationBusy(false);
    }
  };

  const handleSetExactStock = async () => {
    if (!adjustingProduct || mutationBusy) return;
    setMutationBusy(true);
    try {
      await inventoryStore.adjustStockAsync(adjustingProduct.id, customStockAmount, false);
      setAdjustingProduct(null);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Could not set stock.");
    } finally {
      setMutationBusy(false);
    }
  };

  const handleBulkDelete = async () => {
    if (!confirm(`Delete ${selectedIds.size} selected products?`)) return;
    const ids = [...selectedIds];
    setMutationBusy(true);
    try {
      await inventoryStore.deleteProductsAsync(ids);
      setSelectedIds(new Set());
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Could not delete products.");
    } finally {
      setMutationBusy(false);
    }
  };

  const parseImportCsv = (text: string) => {
    const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    if (!lines.length) return [];
    const splitRow = (line: string) => {
      const cells: string[] = [];
      let current = "";
      let inQuotes = false;
      for (let i = 0; i < line.length; i += 1) {
        const ch = line[i];
        if (ch === '"') {
          inQuotes = !inQuotes;
          continue;
        }
        if (ch === "," && !inQuotes) {
          cells.push(current.trim());
          current = "";
          continue;
        }
        current += ch;
      }
      cells.push(current.trim());
      return cells;
    };
    const header = splitRow(lines[0]).map((cell) => cell.toLowerCase());
    const hasHeader = header.some((cell) => ["name", "sku", "stock", "price"].includes(cell));
    const rows = hasHeader ? lines.slice(1) : lines;
    const indexOf = (key: string) => (hasHeader ? header.indexOf(key) : -1);
    const nameIdx = indexOf("name");
    const skuIdx = indexOf("sku");
    const categoryIdx = indexOf("category");
    const stockIdx = indexOf("stock");
    const priceIdx = indexOf("price");
    const thresholdIdx = indexOf("low_stock_threshold");
    return rows
      .map((line) => splitRow(line))
      .filter((cells) => cells.some((cell) => cell.length > 0))
      .map((cells) => {
        const fallbackName = cells[0] || "";
        const name = nameIdx >= 0 ? cells[nameIdx] || "" : fallbackName;
        if (!name.trim()) return null;
        const sku =
          (skuIdx >= 0 ? cells[skuIdx] : cells[1])?.trim() ||
          `SKU-${Math.floor(100 + Math.random() * 900)}`;
        const category = (categoryIdx >= 0 ? cells[categoryIdx] : cells[2])?.trim() || "Others";
        const stockRaw = stockIdx >= 0 ? cells[stockIdx] : cells[3];
        const priceRaw = priceIdx >= 0 ? cells[priceIdx] : cells[4];
        const thresholdRaw = thresholdIdx >= 0 ? cells[thresholdIdx] : undefined;
        return {
          name: name.trim(),
          subtitle: "Imported",
          sku,
          category,
          stock: Number(stockRaw) || 0,
          price: Number(priceRaw) || 0,
          low_stock_threshold: Number(thresholdRaw) || 15,
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null);
  };

  const handleImportFile = async (file: File | null) => {
    if (!file || importBusy) return;
    setImportBusy(true);
    try {
      const text = await file.text();
      const rows =
        file.name.toLowerCase().endsWith(".json")
          ? (JSON.parse(text) as Array<Record<string, unknown>>).map((row) => ({
              name: String(row.name || "").trim(),
              subtitle: String(row.subtitle || "Imported"),
              sku: String(row.sku || `SKU-${Math.floor(100 + Math.random() * 900)}`),
              category: String(row.category || "Others"),
              stock: Number(row.stock) || 0,
              price: Number(row.price) || 0,
              low_stock_threshold: Number(row.low_stock_threshold ?? row.lowStockThreshold) || 15,
            })).filter((row) => row.name)
          : parseImportCsv(text);
      if (!rows.length) {
        window.alert("No products found in that file. Use columns: name, sku, category, stock, price.");
        return;
      }
      await inventoryStore.importProductsAsync(rows);
      setIsImportModalOpen(false);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Import failed");
    } finally {
      setImportBusy(false);
      if (importFileRef.current) importFileRef.current.value = "";
    }
  };

  const renderProductIcon = (p: InventoryProduct) => {
    const nameLower = p.name.toLowerCase();
    const catLower = p.category.toLowerCase();

    let IconComp = Package;
    if (nameLower.includes("headphone") || nameLower.includes("earbud")) IconComp = Headphones;
    else if (nameLower.includes("watch")) IconComp = Watch;
    else if (nameLower.includes("backpack") || nameLower.includes("folder")) IconComp = Folder;
    else if (nameLower.includes("mouse")) IconComp = Mouse;
    else if (nameLower.includes("cable")) IconComp = Cable;
    else if (nameLower.includes("chair")) IconComp = Armchair;
    else if (nameLower.includes("notebook") || nameLower.includes("pen")) IconComp = BookOpen;
    else if (nameLower.includes("hard drive") || nameLower.includes("camera")) IconComp = HardDrive;
    else if (nameLower.includes("mug") || nameLower.includes("coffee") || nameLower.includes("teapot")) IconComp = Coffee;
    else if (nameLower.includes("lamp")) IconComp = Lamp;
    else if (catLower.includes("electronics")) IconComp = Cpu;
    else if (catLower.includes("furniture")) IconComp = Armchair;

    return (
      <div className="w-9 h-9 rounded-[var(--app-radius-control)] border border-[var(--app-border)] bg-[var(--app-hover)] flex items-center justify-center text-[var(--app-ink)] flex-shrink-0">
        <IconComp className="w-4 h-4 stroke-[1.8]" />
      </div>
    );
  };

  const reorderingIds = new Set(
    drafts.filter((draft) => draft.status !== "accepted").map((draft) => draft.product_id)
  );

  const renderStockBadge = (product: InventoryProduct) => {
    if (reorderingIds.has(product.id)) {
      return (
        <Status tone="warning" filled>
          Reordering
        </Status>
      );
    }
    switch (product.status) {
      case "In Stock":
        return (
          <Status tone="positive" filled>
            In Stock
          </Status>
        );
      case "Low Stock":
        return (
          <Status tone="warning" filled>
            Low Stock
          </Status>
        );
      case "Out of Stock":
        return (
          <Status tone="critical" filled>
            Out of Stock
          </Status>
        );
      default: {
        const unreachable: never = product.status;
        return unreachable;
      }
    }
  };

  const emptyProducts = (
    <EmptyState
      title={searchQuery.trim() ? "No matching products" : "Your inventory is ready to grow."}
      description={
        searchQuery.trim()
          ? "Try a different search, or clear filters."
          : "Add your first products to start tracking stock, sales and business performance."
      }
      action={
        !searchQuery.trim() ? (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" type="button" onClick={openAddModal}>
              Add product
            </Button>
            <Button variant="secondary" size="sm" type="button" onClick={() => setIsImportModalOpen(true)}>
              Import products
            </Button>
          </div>
        ) : null
      }
    />
  );

  return (
    <AppShell
      searchPlaceholder="Filter products by name or SKU…"
      searchValue={searchQuery}
      onSearchChange={setSearchQuery}
      maxWidthClassName="max-w-[1360px]"
    >
      <PageHeader
        title="Inventory"
        description={
          booting
            ? `Loading stock levels for ${workspaceName}…`
            : metrics.lowStockCount > 0
              ? `${metrics.lowStockCount} ${metrics.lowStockCount === 1 ? "product is" : "products are"} below the reorder point.`
              : `Stock levels and reorder drafts for ${workspaceName}.`
        }
        actions={
          <>
            <Button variant="secondary" size="sm" type="button" onClick={() => setIsImportModalOpen(true)}>
              <Upload className="w-3.5 h-3.5" />
              Import
            </Button>
            <Button size="sm" type="button" onClick={openAddModal}>
              <Plus className="w-3.5 h-3.5" />
              Add product
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
            onClick={() => void inventoryStore.syncFromBackend(true)}
          >
            Retry
          </Button>
        </div>
      ) : null}

      {drafts.length === 0 ? <div id="purchase-drafts" className="scroll-mt-24" /> : null}
      {drafts.length > 0 ? (
        <section id="purchase-drafts" className="scroll-mt-24 overflow-hidden rounded-[var(--app-radius)] border border-[var(--app-border)] bg-[var(--app-surface)]">
          <div className="border-b border-[var(--app-border)] px-4 py-3">
            <SectionHeading
              title="Needs action"
              meta={<span>{drafts.length} draft purchase {drafts.length === 1 ? "order" : "orders"}</span>}
            />
          </div>
          <ul className="divide-y divide-[var(--app-border)]">
            {drafts.map((d) => (
              <li
                key={d.id}
                className="flex flex-col gap-2 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="text-[13px] font-semibold text-[var(--app-ink)]">
                    {d.product_name || d.sku} × {d.qty}
                  </p>
                  <p className="text-[11px] text-[var(--app-muted)]">{d.reason || d.status}</p>
                </div>
                {d.status !== "accepted" ? (
                  <Button
                    size="sm"
                    type="button"
                    disabled={draftBusy === d.id}
                    onClick={() => {
                      setDraftBusy(d.id);
                      void acceptPurchaseDraft(d.id)
                        .then(() => reloadDrafts())
                        .then(() => inventoryStore.syncFromBackend(true))
                        .finally(() => setDraftBusy(null));
                    }}
                    variant="secondary"
                  >
                    Accept
                  </Button>
                ) : (
                  <span className="text-[11px] font-semibold text-[var(--app-positive)]">Accepted</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <MetricStrip
        items={[
          { label: "Total products", value: booting ? "—" : String(metrics.totalProducts) },
          {
            label: "Stock value",
            value: booting
              ? "—"
              : `$${metrics.totalStockValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
          },
          {
            label: "Low stock",
            value: booting ? "—" : String(metrics.lowStockCount),
            hint: booting
              ? "Syncing…"
              : metrics.lowStockCount > 0
                ? "Below threshold"
                : "None below threshold",
          },
          {
            label: "Out of stock",
            value: booting ? "—" : String(metrics.outOfStockCount),
            hint: booting ? "Syncing…" : `${metrics.inStockPercentage}% in stock`,
          },
        ]}
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        <div className="lg:col-span-8 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--app-border)]">
            <div className="kpm-tabs items-center">
              {(
                [
                  {
                    id: "all" as const,
                    label: booting ? "All" : `All (${metrics.totalProducts})`,
                  },
                  {
                    id: "in_stock" as const,
                    label: booting ? "In stock" : `In stock (${metrics.inStockCount})`,
                  },
                  {
                    id: "low_stock" as const,
                    label: booting ? "Low" : `Low (${metrics.lowStockCount})`,
                  },
                  {
                    id: "out_of_stock" as const,
                    label: booting ? "Out" : `Out (${metrics.outOfStockCount})`,
                  },
                ] as const
              ).map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`relative px-2 py-2.5 text-xs font-semibold transition-colors cursor-pointer ${
                      isActive ? "text-[var(--app-ink)]" : "text-[var(--app-muted)] hover:text-[var(--app-ink)]"
                    }`}
                  >
                    {tab.label}
                    {isActive ? (
                      <span className="absolute bottom-0 left-0 right-0 h-[2px] rounded-full bg-[var(--app-ink)]" />
                    ) : null}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsFiltersOpen(!isFiltersOpen)}
                className={`inline-flex items-center gap-1.5 rounded-[var(--app-radius-control)] border px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                  selectedCategoryFilter !== "All"
                    ? "border-[var(--app-border-strong)] bg-[var(--app-hover)] text-[var(--app-ink)]"
                    : "border-[var(--app-border)] bg-[var(--app-surface)] text-[var(--app-ink)] hover:bg-[var(--app-hover)]"
                }`}
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                Filters
                {selectedCategoryFilter !== "All" ? (
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--app-ink)]" />
                ) : null}
              </button>

              <div className="flex items-center rounded-[var(--app-radius-control)] border border-[var(--app-border)] bg-[var(--app-hover)] p-0.5">
                <button
                  type="button"
                  onClick={() => setViewMode("grid")}
                  className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                    viewMode === "grid" ? "bg-[var(--app-surface)] text-[var(--app-ink)] shadow-sm" : "text-[var(--app-muted)]"
                  }`}
                  title="Grid view"
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("list")}
                  className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                    viewMode === "list" ? "bg-[var(--app-surface)] text-[var(--app-ink)] shadow-sm" : "text-[var(--app-muted)]"
                  }`}
                  title="List view"
                >
                  <List className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {selectedIds.size > 0 ? (
            <div className="flex items-center justify-between rounded-[var(--app-radius)] border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2 text-xs">
              <div className="font-semibold text-[var(--app-ink)]">{selectedIds.size} selected</div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleBulkDelete}
                  className="inline-flex items-center gap-1 rounded-[var(--app-radius-control)] border border-[var(--app-critical-border)] bg-[var(--app-surface)] px-3 py-1 font-semibold text-[var(--app-critical)] hover:bg-[var(--app-critical-bg)] cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" />
                  Delete
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedIds(new Set())}
                  className="rounded-[var(--app-radius-control)] px-2.5 py-1 text-[var(--app-muted)] hover:bg-[var(--app-hover)] cursor-pointer"
                >
                  Deselect
                </button>
              </div>
            </div>
          ) : null}

          {isFiltersOpen ? (
            <div className="space-y-3 rounded-[var(--app-radius)] border border-[var(--app-border)] bg-[var(--app-surface)] p-3.5 text-xs">
              <div className="flex items-center justify-between font-semibold text-[var(--app-ink)]">
                <span>Filter by category</span>
                <button type="button" onClick={() => setIsFiltersOpen(false)} className="text-[var(--app-muted)] hover:text-[var(--app-ink)]">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {categoryFilters.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => {
                        setSelectedCategoryFilter(cat);
                        setIsFiltersOpen(false);
                      }}
                      className={`rounded-[var(--app-radius-control)] px-3 py-1.5 font-medium transition-colors cursor-pointer ${
                        selectedCategoryFilter === cat
                          ? "bg-[var(--app-nav-active-bg)] text-[var(--app-nav-active)]"
                          : "bg-[var(--app-hover)] text-[var(--app-ink)] hover:bg-slate-200"
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
              </div>
            </div>
          ) : null}

          {booting ? (
            <TableSkeleton rows={6} />
          ) : viewMode === "list" ? (
            <div className="max-md:overflow-visible md:overflow-hidden rounded-[var(--app-radius)] border border-[var(--app-border)] bg-[var(--app-surface)]">
              <div className="kpm-cards md:overflow-x-auto">
                <table className="w-full border-collapse text-left md:min-w-[760px]">
                  <thead>
                    <tr className="border-b border-[var(--app-border)] bg-[var(--app-hover)] text-[11px] font-semibold uppercase tracking-wider text-[var(--app-muted)]">
                      <th className="py-2.5 px-3 w-10">
                        <input
                          type="checkbox"
                          checked={filteredProducts.length > 0 && selectedIds.size === filteredProducts.length}
                          onChange={handleSelectAll}
                          className="w-4 h-4 rounded border-[var(--app-border-strong)] text-[var(--app-ink)] focus:ring-0 cursor-pointer"
                        />
                      </th>
                      <th className="py-2.5 px-3">Product</th>
                      <th className="py-2.5 px-3">SKU</th>
                      <th className="py-2.5 px-3">Category</th>
                      <th className="py-2.5 px-3">Stock</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">Price</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--app-border)] text-xs">
                    {filteredProducts.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-6">
                          {emptyProducts}
                        </td>
                      </tr>
                    ) : (
                      filteredProducts.slice(0, 30).map((product) => {
                        const isChecked = selectedIds.has(product.id);
                        return (
                          <tr
                            key={product.id}
                            className={`group hover:bg-[var(--app-hover)] transition-colors ${
                              isChecked ? "bg-[var(--app-hover)]" : ""
                            }`}
                          >
                            <td data-label="Select" className="px-3 py-3">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => handleSelectRow(product.id)}
                                aria-label={`Select ${product.name}`}
                                className="w-4 h-4 rounded border-[var(--app-border-strong)] text-[var(--app-ink)] focus:ring-0 cursor-pointer"
                              />
                            </td>
                            <td data-label="Product" className="kpm-card-lead px-3 py-3">
                              <div className="flex items-center gap-2.5">
                                {renderProductIcon(product)}
                                <div>
                                  <div className="font-semibold text-[var(--app-ink)] leading-tight">{product.name}</div>
                                  <div className="text-[13px] text-[var(--app-muted)] mt-0.5">{product.subtitle}</div>
                                </div>
                              </div>
                            </td>
                            <td data-label="SKU" className="px-3 py-3 font-mono text-[11px] text-[var(--app-muted)]">{product.sku}</td>
                            <td data-label="Category" className="px-3 py-3 text-[var(--app-ink)]">{product.category}</td>
                            <td data-label="Stock" className="px-3 py-3 font-semibold tabular-nums text-[var(--app-ink)]">{product.stock}</td>
                            <td data-label="Status" className="px-3 py-3">
                              {renderStockBadge(product)}
                            </td>
                            <td data-label="Price" className="px-3 py-3 font-semibold tabular-nums text-[var(--app-ink)]">
                              ${product.price.toFixed(2)}
                            </td>
                            <td data-label="Actions" className="relative action-menu-container px-3 py-3 text-right">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActionMenuOpenId(actionMenuOpenId === product.id ? null : product.id);
                                }}
                                className="cursor-pointer rounded-[var(--app-radius-control)] p-1.5 text-[var(--app-muted)] hover:bg-[var(--app-hover)] hover:text-[var(--app-ink)]"
                                aria-label={`Actions for ${product.name}`}
                              >
                                <MoreHorizontal className="w-4 h-4" />
                              </button>
                              {actionMenuOpenId === product.id ? (
                                <div className="kpm-row-menu absolute right-3 top-9 z-50 w-44 rounded-[var(--app-radius)] border border-[var(--app-border)] bg-[var(--app-surface)] p-1.5 text-left text-xs shadow-lg">
                                  <button
                                    type="button"
                                    onClick={() => handleOpenEdit(product)}
                                    className="flex w-full items-center gap-2 rounded-[var(--app-radius-control)] px-3 py-2 font-medium text-[var(--app-ink)] hover:bg-[var(--app-hover)] cursor-pointer"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                    Edit details
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setAdjustingProduct(product);
                                      setCustomStockAmount(product.stock);
                                      setActionMenuOpenId(null);
                                    }}
                                    className="flex w-full items-center gap-2 rounded-[var(--app-radius-control)] px-3 py-2 font-medium text-[var(--app-ink)] hover:bg-[var(--app-hover)] cursor-pointer"
                                  >
                                    <RefreshCw className="w-3.5 h-3.5" />
                                    Adjust stock
                                  </button>
                                  <div className="my-1 flex items-center justify-between border-y border-[var(--app-border)] px-3 py-1.5 text-[11px] text-[var(--app-muted)]">
                                    <span>Quick:</span>
                                    <div className="flex items-center gap-1">
                                      <button
                                        type="button"
                                        onClick={() => handleQuickAdjustStock(product, -10)}
                                        className="rounded px-1.5 py-0.5 font-bold bg-[var(--app-hover)] hover:bg-slate-200"
                                      >
                                        -10
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleQuickAdjustStock(product, 10)}
                                        className="rounded px-1.5 py-0.5 font-bold bg-[var(--app-hover)] hover:bg-slate-200"
                                      >
                                        +10
                                      </button>
                                    </div>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteProduct(product.id)}
                                    className="flex w-full items-center gap-2 rounded-[var(--app-radius-control)] px-3 py-2 font-medium text-rose-600 hover:bg-rose-50 cursor-pointer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    Delete
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
              {filteredProducts.length > 30 ? (
                <div className="border-t border-[var(--app-border)] p-2.5 text-center text-xs text-[var(--app-muted)]">
                  Showing 30 of {filteredProducts.length}. Use search to narrow results.
                </div>
              ) : null}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredProducts.length === 0 ? (
                <div className="rounded-[var(--app-radius)] border border-[var(--app-border)] bg-[var(--app-surface)] p-4 sm:col-span-2 lg:col-span-3">
                  {emptyProducts}
                </div>
              ) : (
                filteredProducts.map((product) => (
                  <div
                    key={product.id}
                    className="flex flex-col justify-between gap-3 rounded-[var(--app-radius)] border border-[var(--app-border)] bg-[var(--app-surface)] p-3.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        {renderProductIcon(product)}
                        <div>
                          <div className="text-xs font-semibold text-[var(--app-ink)] leading-tight">{product.name}</div>
                          <div className="mt-0.5 text-[13px] text-[var(--app-muted)]">
                            {product.sku} · {product.category}
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(product)}
                        className="p-1 text-[var(--app-muted)] hover:text-[var(--app-ink)]"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="flex items-center justify-between border-t border-[var(--app-border)] pt-2 text-xs">
                      <div>
                        <span className="block text-[13px] text-[var(--app-muted)]">Stock</span>
                        <span className="font-semibold tabular-nums">{product.stock}</span>
                      </div>
                      <div>
                        <span className="block text-[13px] text-[var(--app-muted)]">Price</span>
                        <span className="font-semibold tabular-nums">${product.price.toFixed(2)}</span>
                      </div>
                      <div>{renderStockBadge(product)}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        <div className="lg:col-span-4 space-y-4">
          <div className="space-y-3 rounded-[var(--app-radius)] border border-[var(--app-border)] bg-[var(--app-surface)] p-4">
            <SectionHeading
              title="Stock overview"
              meta={<span>{booting ? "—" : `${metrics.inStockPercentage}% available`}</span>}
            />
            <div className="space-y-2 text-xs">
              {(
                [
                  {
                    label: "In stock",
                    count: booting ? 0 : metrics.inStockCount,
                    pct: booting ? 0 : metrics.inStockPercentage,
                    tone: "bg-[var(--app-ink)]",
                  },
                  {
                    label: "Low stock",
                    count: booting ? 0 : metrics.lowStockCount,
                    pct: booting ? 0 : metrics.lowStockPercentage,
                    tone: "bg-[var(--app-warning)]",
                  },
                  {
                    label: "Out of stock",
                    count: booting ? 0 : metrics.outOfStockCount,
                    pct: booting ? 0 : metrics.outOfStockPercentage,
                    tone: "bg-rose-500",
                  },
                ] as const
              ).map((row) => (
                <div key={row.label} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${row.tone}`} />
                      <span className="text-[var(--app-muted)]">{row.label}</span>
                    </div>
                    <span className="font-semibold tabular-nums text-[var(--app-ink)]">
                      {booting ? "—" : `${row.count} (${row.pct}%)`}
                    </span>
                  </div>
                  <div className="h-1 w-full overflow-hidden rounded-full bg-[var(--app-hover)]">
                    <div className={`h-full rounded-full ${row.tone}`} style={{ width: `${Math.min(100, row.pct)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3 rounded-[var(--app-radius)] border border-[var(--app-border)] bg-[var(--app-surface)] p-4">
            <SectionHeading title="Top categories" />
            <div className="space-y-2.5">
              {booting ? (
                <p className="text-xs text-[var(--app-muted)]">Syncing categories…</p>
              ) : metrics.topCategories.length === 0 ? (
                <p className="text-xs text-[var(--app-muted)]">No categories yet — add products to see the mix.</p>
              ) : null}
              {!booting && metrics.topCategories.map((cat) => {
                let Icon = Package;
                if (cat.name === "Electronics") Icon = Cpu;
                else if (cat.name === "Furniture") Icon = Armchair;
                else if (cat.name === "Accessories") Icon = Tag;
                else if (cat.name === "Home & Kitchen") Icon = Home;
                else if (cat.name === "Stationery") Icon = BookOpen;
                else Icon = Layers;

                return (
                  <div key={cat.name} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <Icon className="w-3.5 h-3.5 text-[var(--app-muted)]" />
                        <span className="text-[var(--app-ink)]">{cat.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-[var(--app-muted)]">{cat.percentage}%</span>
                        <span className="font-semibold tabular-nums text-[var(--app-ink)]">
                          ${cat.value.toLocaleString()}
                        </span>
                      </div>
                    </div>
                    <div className="h-1 w-full overflow-hidden rounded-full bg-[var(--app-hover)]">
                      <div
                        className="h-full rounded-full bg-[var(--app-ink)]"
                        style={{ width: `${Math.min(100, Math.max(0, cat.percentage))}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="space-y-3 rounded-[var(--app-radius)] border border-[var(--app-border)] bg-[var(--app-surface)] p-4">
            <SectionHeading title="Recent alerts" />
            <div className="space-y-2.5">
              {booting ? (
                <p className="text-xs text-[var(--app-muted)]">Syncing alerts…</p>
              ) : alerts.length === 0 ? (
                <p className="text-xs text-[var(--app-muted)]">No stock alerts right now.</p>
              ) : null}
              {!booting &&
                alerts.slice(0, 4).map((alertItem) => (
                <div key={alertItem.id} className="flex items-start gap-2.5 text-xs">
                  {alertItem.type === "critical" || alertItem.type === "warning" ? (
                    <AlertTriangle
                      className={`mt-0.5 h-3.5 w-3.5 flex-shrink-0 ${
                        alertItem.type === "critical" ? "text-[var(--app-critical)]" : "text-[var(--app-warning)]"
                      }`}
                    />
                  ) : alertItem.type === "success" ? (
                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-[var(--app-positive)]" />
                  ) : (
                    <RotateCcw className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-[var(--app-muted)]" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-semibold text-[var(--app-ink)]">{alertItem.title}</span>
                      <span className="flex-shrink-0 text-[13px] text-[var(--app-muted)]">{alertItem.time}</span>
                    </div>
                    <p className="mt-0.5 truncate text-[11px] text-[var(--app-muted)]">{alertItem.subtitle}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {isAddModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md space-y-4 rounded-[var(--app-radius)] border border-[var(--app-border)] bg-[var(--app-surface)] p-5 text-xs shadow-xl">
            <div className="flex items-center justify-between border-b border-[var(--app-border)] pb-3">
              <h3 className="text-base font-semibold text-[var(--app-ink)]">
                {editingProduct ? "Edit product" : "Add product"}
              </h3>
              <button type="button" onClick={() => setIsAddModalOpen(false)} className="text-[var(--app-muted)] hover:text-[var(--app-ink)]">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleAddSubmit} className="space-y-3">
              {productSaveError ? (
                <p className="rounded-[var(--app-radius-control)] border border-[var(--app-critical-border)] bg-[var(--app-critical-bg)] px-3 py-2 text-[13px] text-[var(--app-critical)]">
                  {productSaveError}
                </p>
              ) : null}
              <div>
                <label className="mb-1 block font-semibold text-[var(--app-ink)]">Product name *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Wireless Bluetooth Headphones"
                  className="w-full rounded-[var(--app-radius-control)] border border-[var(--app-border)] px-3 py-2 outline-none focus:border-[var(--app-border-strong)]"
                />
              </div>
              <div>
                <label className="mb-1 block font-semibold text-[var(--app-ink)]">Subtitle</label>
                <input
                  type="text"
                  value={formData.subtitle}
                  onChange={(e) => setFormData({ ...formData, subtitle: e.target.value })}
                  placeholder="e.g. Noise Cancelling, Black"
                  className="w-full rounded-[var(--app-radius-control)] border border-[var(--app-border)] px-3 py-2 outline-none focus:border-[var(--app-border-strong)]"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block font-semibold text-[var(--app-ink)]">SKU</label>
                  <input
                    type="text"
                    value={formData.sku}
                    onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                    className="w-full rounded-[var(--app-radius-control)] border border-[var(--app-border)] px-3 py-2 font-mono outline-none focus:border-[var(--app-border-strong)]"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-semibold text-[var(--app-ink)]">Category</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full cursor-pointer rounded-[var(--app-radius-control)] border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2 outline-none"
                  >
                    {formCategoryOptions.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="mb-1 block font-semibold text-[var(--app-ink)]">Stock</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.stock}
                    onChange={(e) => setFormData({ ...formData, stock: Number(e.target.value) })}
                    className="w-full rounded-[var(--app-radius-control)] border border-[var(--app-border)] px-3 py-2 font-semibold outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-semibold text-[var(--app-ink)]">Price ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })}
                    className="w-full rounded-[var(--app-radius-control)] border border-[var(--app-border)] px-3 py-2 font-semibold outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-semibold text-[var(--app-ink)]">Low alert</label>
                  <input
                    type="number"
                    min="1"
                    value={formData.lowStockThreshold}
                    onChange={(e) => setFormData({ ...formData, lowStockThreshold: Number(e.target.value) })}
                    className="w-full rounded-[var(--app-radius-control)] border border-[var(--app-border)] px-3 py-2 outline-none"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="secondary" size="sm" type="button" onClick={() => setIsAddModalOpen(false)}>
                  Cancel
                </Button>
                <Button size="sm" type="submit" disabled={mutationBusy}>
                  {mutationBusy
                    ? "Saving…"
                    : editingProduct
                      ? "Save changes"
                      : "Create product"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {adjustingProduct ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm space-y-4 rounded-[var(--app-radius)] border border-[var(--app-border)] bg-[var(--app-surface)] p-5 text-xs shadow-xl">
            <div className="flex items-center justify-between border-b border-[var(--app-border)] pb-2">
              <div>
                <h3 className="text-sm font-semibold text-[var(--app-ink)]">Adjust stock</h3>
                <p className="mt-0.5 text-[11px] text-[var(--app-muted)]">{adjustingProduct.name}</p>
              </div>
              <button type="button" onClick={() => setAdjustingProduct(null)} className="text-[var(--app-muted)] hover:text-[var(--app-ink)]">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex items-center justify-center gap-4 py-2">
              <button
                type="button"
                onClick={() => setCustomStockAmount(Math.max(0, customStockAmount - 10))}
                className="h-9 w-9 rounded-[var(--app-radius-control)] bg-[var(--app-hover)] font-bold hover:bg-slate-200 cursor-pointer"
              >
                -10
              </button>
              <input
                type="number"
                min="0"
                value={customStockAmount}
                onChange={(e) => setCustomStockAmount(Math.max(0, Number(e.target.value)))}
                className="w-24 rounded-[var(--app-radius-control)] border border-[var(--app-border)] py-2 text-center text-xl font-semibold tabular-nums"
              />
              <button
                type="button"
                onClick={() => setCustomStockAmount(customStockAmount + 10)}
                className="h-9 w-9 rounded-[var(--app-radius-control)] bg-[var(--app-hover)] font-bold hover:bg-slate-200 cursor-pointer"
              >
                +10
              </button>
            </div>
            <div className="flex justify-between text-[11px] text-[var(--app-muted)]">
              <span>Threshold: {adjustingProduct.lowStockThreshold || 15}</span>
              <span className="font-semibold text-[var(--app-ink)]">
                {customStockAmount === 0
                  ? "Out of Stock"
                  : customStockAmount <= (adjustingProduct.lowStockThreshold || 15)
                    ? "Low Stock"
                    : "In Stock"}
              </span>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="secondary" size="sm" type="button" onClick={() => setAdjustingProduct(null)}>
                Cancel
              </Button>
              <Button size="sm" type="button" onClick={handleSetExactStock}>
                Update stock
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {isImportModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md space-y-4 rounded-[var(--app-radius)] border border-[var(--app-border)] bg-[var(--app-surface)] p-5 text-xs shadow-xl">
            <div className="flex items-center justify-between border-b border-[var(--app-border)] pb-2">
              <h3 className="text-base font-semibold text-[var(--app-ink)]">Import products</h3>
              <button type="button" onClick={() => setIsImportModalOpen(false)} className="text-[var(--app-muted)] hover:text-[var(--app-ink)]">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-[var(--app-muted)]">
              Upload CSV or JSON — each row is saved to your workspace database (columns: name, sku, category, stock, price).
            </p>
            <input
              ref={importFileRef}
              type="file"
              accept=".csv,.json,text/csv,application/json"
              className="hidden"
              onChange={(event) => void handleImportFile(event.target.files?.[0] ?? null)}
            />
            <button
              type="button"
              disabled={importBusy}
              onClick={() => importFileRef.current?.click()}
              className="w-full space-y-2 rounded-[var(--app-radius)] border border-dashed border-[var(--app-border)] bg-[var(--app-hover)] p-4 text-center cursor-pointer disabled:opacity-60"
            >
              <Upload className="mx-auto h-6 w-6 text-[var(--app-muted)]" />
              <div className="font-semibold text-[var(--app-ink)]">{importBusy ? "Importing…" : "Choose CSV or JSON"}</div>
              <div className="text-[13px] text-[var(--app-muted)]">Excel: export as CSV first</div>
            </button>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="secondary" size="sm" type="button" onClick={() => setIsImportModalOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}
