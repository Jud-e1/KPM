"use client";

import React from "react";
import { AlertCircle, Loader2 } from "lucide-react";

type EmptyStateProps = {
  title: string;
  description?: string;
  action?: React.ReactNode;
};

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-start gap-1 rounded-[var(--app-radius)] border border-dashed border-[var(--app-border-strong)] bg-[var(--app-surface)] px-4 py-8">
      <p className="text-sm font-medium text-[var(--app-ink)]">{title}</p>
      {description ? <p className="text-sm text-[var(--app-muted)] max-w-md">{description}</p> : null}
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}

type SyncBannerProps = {
  loading?: boolean;
  error?: string | null;
};

export function SyncBanner({ loading, error }: SyncBannerProps) {
  if (!loading && !error) return null;
  if (error) {
    return (
      <div className="mb-4 flex items-start gap-2 rounded-[var(--app-radius)] border border-[var(--app-critical-border)] bg-[var(--app-critical-bg)] px-3 py-2.5 text-sm text-[var(--app-critical)]">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
        <span>{error}</span>
      </div>
    );
  }
  return (
    <div className="mb-4 flex items-center gap-2 rounded-[var(--app-radius)] border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2.5 text-sm text-[var(--app-muted)]">
      <Loader2 className="h-4 w-4 animate-spin shrink-0" />
      <span>Syncing latest data…</span>
    </div>
  );
}
