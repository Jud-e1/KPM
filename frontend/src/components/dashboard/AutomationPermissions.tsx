"use client";

import { BarChart3, Boxes, FileText, ShoppingCart } from "lucide-react";
import type { ComponentType } from "react";
import type { AutomationMode } from "@/lib/api";
import { Card, CardHeader } from "./Card";

export type PermissionKey = "inventory" | "sales" | "accounting" | "reports";

const ROWS: Array<{
  id: PermissionKey;
  label: string;
  icon: ComponentType<{ className?: string }>;
  functionId: string;
}> = [
  { id: "inventory", label: "Inventory", icon: Boxes, functionId: "reorder" },
  { id: "sales", label: "Sales", icon: ShoppingCart, functionId: "flag_anomalies" },
  { id: "accounting", label: "Accounting", icon: FileText, functionId: "reconcile" },
  { id: "reports", label: "Reports", icon: BarChart3, functionId: "forecast" },
];

function statusLabel(mode: AutomationMode, paused: boolean) {
  if (paused) return "Paused";
  if (mode === "automatic") return "Enabled";
  if (mode === "suggest") return "Review required";
  return "Off";
}

export function AutomationPermissions({
  modes,
  paused,
  saving,
  error,
  onChange,
  onTogglePause,
}: {
  modes: Record<string, AutomationMode>;
  paused: boolean;
  saving: boolean;
  error: string | null;
  onChange: (functionId: string, mode: AutomationMode) => void;
  onTogglePause: () => void;
}) {
  return (
    <Card className="p-4 sm:p-5">
      <div data-tour="accounting">
        <CardHeader
          title="Automation Permissions"
          subtitle="Control what KPM can automate for you."
          action={
            <button
              type="button"
              onClick={onTogglePause}
              className="text-[12px] font-medium text-[var(--app-muted)] hover:text-[var(--app-ink)]"
            >
              {paused ? "Resume" : "Pause"}
            </button>
          }
        />
        <ul className="mt-3 space-y-2">
          {ROWS.map((row) => {
            const Icon = row.icon;
            const mode = modes[row.functionId] || "off";
            const label = statusLabel(mode, paused);
            const dot =
              paused || mode === "off"
                ? "bg-[var(--app-faint)]"
                : mode === "suggest"
                  ? "bg-[var(--app-warning)]"
                  : "bg-[var(--app-accent)]";
            return (
              <li key={row.id} className="flex items-center gap-3 rounded-xl border border-[var(--app-border)] px-3 py-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#f4f6fb] text-[var(--app-ink)]">
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-semibold text-[var(--app-ink)]">{row.label}</span>
                  <button
                    type="button"
                    disabled={paused || saving || mode === "off"}
                    onClick={() => onChange(row.functionId, mode === "suggest" ? "automatic" : "suggest")}
                    className="mt-0.5 flex items-center gap-1.5 text-[12px] text-[var(--app-muted)] disabled:cursor-default"
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${dot}`} aria-hidden />
                    {label}
                  </button>
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={mode !== "off"}
                  aria-label={`${row.label} automation`}
                  disabled={paused || saving}
                  onClick={() => onChange(row.functionId, mode === "off" ? "automatic" : "off")}
                  className={`relative h-6 w-11 shrink-0 rounded-full transition-colors duration-150 disabled:opacity-50 ${
                    mode === "off" ? "bg-[#e4e6ec]" : mode === "suggest" ? "bg-[#c4a15a]" : "bg-[#3e4fbe]"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 h-5 w-5 rounded-full bg-[var(--app-surface)] shadow-sm transition-[left] duration-150 ${
                      mode === "off" ? "left-0.5" : "left-[22px]"
                    }`}
                  />
                </button>
              </li>
            );
          })}
        </ul>
        {error ? <p className="mt-2 text-[12px] text-[var(--app-critical)]">{error}</p> : null}
        {saving ? <p className="mt-2 text-[12px] text-[var(--app-faint)]">Saving permissions…</p> : null}
      </div>
    </Card>
  );
}

export const PERMISSION_FUNCTIONS = ROWS.map((row) => row.functionId);
