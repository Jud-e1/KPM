"use client";

import React, { useState, useEffect, useCallback } from "react";
import { 
  Plus, Search, Trash2, Edit3, CheckCircle2, Clock, 
  RefreshCw, AlertCircle, Folder, ArrowRight
} from "lucide-react";
import { Item, ItemCreateInput } from "@/types";
import { fetchItems, createItem, updateItem, deleteItem } from "@/lib/api";

interface ItemManagerProps {
  isBackendOnline: boolean;
}

export const ItemManager: React.FC<ItemManagerProps> = ({ isBackendOnline }) => {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Create / Edit modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [formData, setFormData] = useState<ItemCreateInput>({
    title: "",
    description: "",
    category: "General",
    status: "active",
  });
  const [formSubmitting, setFormSubmitting] = useState(false);

  const loadItems = useCallback(async () => {
    if (!isBackendOnline) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchItems({
        status: statusFilter,
        search: search.trim() || undefined,
      });
      setItems(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load items";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [isBackendOnline, statusFilter, search]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const handleOpenAdd = () => {
    setEditingItem(null);
    setFormData({
      title: "",
      description: "",
      category: "General",
      status: "active",
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (item: Item) => {
    setEditingItem(item);
    setFormData({
      title: item.title,
      description: item.description || "",
      category: item.category,
      status: item.status,
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) return;

    setFormSubmitting(true);
    try {
      if (editingItem) {
        await updateItem(editingItem.id, formData);
      } else {
        await createItem(formData);
      }
      setIsModalOpen(false);
      await loadItems();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Operation failed");
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this record from PostgreSQL?")) return;
    try {
      await deleteItem(id);
      setItems((prev) => prev.filter((i) => i.id !== id));
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to delete item");
    }
  };

  const handleSeedDemo = async () => {
    const sampleItems: ItemCreateInput[] = [
      {
        title: "Setup Next.js Frontend Layer",
        description: "Scaffold Next.js 15 with App Router, TypeScript, Tailwind CSS, and API client.",
        category: "Frontend",
        status: "completed",
      },
      {
        title: "Build Python FastAPI Backend",
        description: "Created modular API architecture with SQLAlchemy ORM and Pydantic validation.",
        category: "Backend",
        status: "completed",
      },
      {
        title: "Configure PostgreSQL Database",
        description: "Verify PostgreSQL connection pooling, migrations, and health telemetry.",
        category: "Database",
        status: "active",
      },
      {
        title: "Deploy Production Pipeline",
        description: "Configure CI/CD, environment variables, and Docker deployment.",
        category: "DevOps",
        status: "pending",
      },
    ];

    setLoading(true);
    try {
      for (const sample of sampleItems) {
        await createItem(sample);
      }
      await loadItems();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to seed demo data");
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-3 h-3" />
            <span className="capitalize">Completed</span>
          </span>
        );
      case "pending":
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Clock className="w-3 h-3" />
            <span className="capitalize">Pending</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[var(--app-hover)]0/10 text-slate-300 border border-slate-500/20">
            <CheckCircle2 className="w-3 h-3" />
            <span className="capitalize">Active</span>
          </span>
        );
    }
  };

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/50 backdrop-blur-md p-6 shadow-xl relative">
      {/* Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800/80">
        <div>
          <div className="flex items-center space-x-2">
            <Folder className="w-5 h-5 text-indigo-400" />
            <h2 className="text-lg font-bold text-white tracking-tight">PostgreSQL Database Records</h2>
          </div>
          <p className="text-xs text-[var(--app-faint)] mt-1">
            Live interactive CRUD operations executed via Python FastAPI & PostgreSQL
          </p>
        </div>

        <div className="flex items-center space-x-2.5">
          {items.length === 0 && (
            <button
              onClick={handleSeedDemo}
              disabled={loading || !isBackendOnline}
              className="flex items-center space-x-1.5 px-3 py-2 rounded-xl border border-indigo-500/30 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 text-xs font-medium transition-all cursor-pointer disabled:opacity-50"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Seed Demo Data</span>
            </button>
          )}

          <button
            onClick={handleOpenAdd}
            disabled={!isBackendOnline}
            className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white text-xs font-semibold shadow-lg shadow-indigo-500/20 transition-all cursor-pointer disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
            <span>New Record</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 my-5">
        <div className="flex items-center space-x-1 p-1 bg-slate-950/60 rounded-xl border border-slate-800/80 text-xs">
          {["all", "active", "pending", "completed"].map((tab) => (
            <button
              key={tab}
              onClick={() => setStatusFilter(tab)}
              className={`px-3 py-1.5 rounded-lg capitalize font-medium transition-all cursor-pointer ${
                statusFilter === tab
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-[var(--app-faint)] hover:text-slate-200"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="relative flex-1 sm:max-w-xs">
          <Search className="w-4 h-4 text-[var(--app-faint)] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search records..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 bg-slate-950/60 border border-slate-800/80 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500/50"
          />
        </div>
      </div>

      {/* Error Notice */}
      {error && (
        <div className="mb-4 p-3.5 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-300 text-xs flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Items Grid / List */}
      {loading ? (
        <div className="py-16 text-center">
          <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin mx-auto mb-3" />
          <p className="text-xs text-[var(--app-faint)]">Communicating with Python backend & PostgreSQL...</p>
        </div>
      ) : items.length === 0 ? (
        <div className="py-14 text-center border border-dashed border-slate-800 rounded-xl bg-slate-950/30">
          <Folder className="w-10 h-10 text-[var(--app-muted)] mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-slate-300">No records found</h3>
          <p className="text-xs text-[var(--app-muted)] max-w-sm mx-auto mt-1">
            {search
              ? "No items match your search filter."
              : "No database records in PostgreSQL yet. Create a new record or click 'Seed Demo Data'."}
          </p>
          {!search && (
            <button
              onClick={handleSeedDemo}
              disabled={!isBackendOnline}
              className="mt-4 inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-xs font-medium hover:bg-indigo-500/20 transition-all cursor-pointer"
            >
              <Plus className="w-3 h-3" />
              <span>Insert Sample PostgreSQL Rows</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {items.map((item) => (
            <div
              key={item.id}
              className="group rounded-xl border border-slate-800/80 bg-slate-950/40 hover:bg-slate-950/70 hover:border-slate-700/80 p-4 transition-all duration-200 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center space-x-2">
                    <span className="text-[10px] font-mono text-[var(--app-muted)] px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800">
                      #{item.id}
                    </span>
                    <span className="text-xs font-semibold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded">
                      {item.category}
                    </span>
                  </div>
                  {getStatusBadge(item.status)}
                </div>

                <h3 className="text-sm font-semibold text-slate-100 mt-2.5 group-hover:text-white transition-colors">
                  {item.title}
                </h3>
                {item.description && (
                  <p className="text-xs text-[var(--app-faint)] mt-1 line-clamp-2">{item.description}</p>
                )}
              </div>

              <div className="mt-4 pt-3 border-t border-slate-900/80 flex items-center justify-between text-[11px] text-[var(--app-muted)]">
                <span>{new Date(item.created_at).toLocaleDateString()}</span>
                <div className="flex items-center space-x-1 opacity-80 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => handleOpenEdit(item)}
                    className="p-1 rounded hover:bg-slate-800 text-[var(--app-faint)] hover:text-indigo-300 transition-colors cursor-pointer"
                    title="Edit Record"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="p-1 rounded hover:bg-rose-500/20 text-[var(--app-faint)] hover:text-rose-400 transition-colors cursor-pointer"
                    title="Delete Record"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl relative">
            <h3 className="text-base font-bold text-white mb-4">
              {editingItem ? "Edit PostgreSQL Record" : "Create New PostgreSQL Record"}
            </h3>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Implement Auth Service"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Category</label>
                <input
                  type="text"
                  placeholder="e.g. Frontend, Backend, Database"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-indigo-500"
                >
                  <option value="active">Active</option>
                  <option value="pending">Pending</option>
                  <option value="completed">Completed</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Description</label>
                <textarea
                  rows={3}
                  placeholder="Provide context or details..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-indigo-500 resize-none"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-800 text-[var(--app-faint)] hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium shadow-lg shadow-indigo-500/20 transition-all cursor-pointer disabled:opacity-50"
                >
                  {formSubmitting ? "Saving..." : editingItem ? "Update Record" : "Save Record"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
