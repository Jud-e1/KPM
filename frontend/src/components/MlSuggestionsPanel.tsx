"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Check, RotateCcw, X } from "lucide-react";
import {
  acceptMlSuggestion,
  dismissMlFlag,
  dismissMlSuggestion,
  fetchMlAudit,
  fetchMlFlags,
  fetchMlSuggestions,
  undoMlAudit,
  type MlAudit,
  type MlFlag,
  type MlSuggestion,
} from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Status } from "@/components/ui/Status";

type Props = {
  kindFilter?: string;
  compact?: boolean;
  title?: string;
};

export function MlSuggestionsPanel({
  kindFilter,
  compact = false,
  title = "Suggestions",
}: Props) {
  const [suggestions, setSuggestions] = useState<MlSuggestion[]>([]);
  const [flags, setFlags] = useState<MlFlag[]>([]);
  const [audit, setAudit] = useState<MlAudit[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const [s, f, a] = await Promise.all([
        fetchMlSuggestions({ status: "suggested", kind: kindFilter, limit: 20 }),
        fetchMlFlags({ status: "open", limit: 20 }),
        fetchMlAudit(8),
      ]);
      setSuggestions(s);
      setFlags(kindFilter === "reconcile" ? [] : f);
      setAudit(a.filter((row) => row.undone !== "true"));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load suggestions");
    }
  }, [kindFilter]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const run = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key);
    try {
      await fn();
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy(null);
    }
  };

  if (!suggestions.length && !flags.length && !audit.length) {
    if (compact) return null;
    return (
      <section className="rounded-[var(--app-radius)] border border-[var(--app-border)] bg-[var(--app-surface)] px-4 py-3">
        <h2 className="text-sm font-semibold text-[var(--app-ink)]">{title}</h2>
        <p className="mt-1 text-[13px] text-[var(--app-muted)]">Nothing is waiting for a decision.</p>
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-[var(--app-radius)] border border-[var(--app-border)] bg-[var(--app-surface)]">
      <div className="flex items-center justify-between gap-2 border-b border-[var(--app-border)] px-4 py-3">
        <h2 className="text-sm font-semibold text-[var(--app-ink)]">{title}</h2>
        <span className="text-xs text-[var(--app-muted)]">
          {error ? error : `${suggestions.length + flags.length} open`}
        </span>
      </div>
      <ul className="divide-y divide-[var(--app-border)]">
        {suggestions.map((s) => (
          <li key={s.id} className="flex flex-col gap-2 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <Status tone="warning" filled>
                Suggest
              </Status>
              <div className="min-w-0">
                <p className="truncate text-[13px] font-semibold text-[var(--app-ink)]">
                  {s.kind} · {(s.score * 100).toFixed(0)}%
                </p>
                <p className="truncate text-xs text-[var(--app-muted)]">{s.explanation || s.entity_id}</p>
              </div>
            </div>
            <div className="flex shrink-0 gap-2">
              <Button type="button" size="sm" disabled={busy === s.id} onClick={() => run(s.id, () => acceptMlSuggestion(s.id))}>
                <Check className="h-3.5 w-3.5" />
                Approve
              </Button>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={busy === s.id}
                onClick={() => run(s.id, () => dismissMlSuggestion(s.id))}
              >
                <X className="h-3.5 w-3.5" />
                Dismiss
              </Button>
            </div>
          </li>
        ))}
        {flags.map((f) => (
          <li key={f.id} className="flex flex-col gap-2 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <Status tone={f.severity === "high" ? "critical" : "warning"} filled>
                Flag
              </Status>
              <div className="min-w-0">
                <p className="truncate text-[13px] font-semibold text-[var(--app-ink)]">
                  {f.severity} · {(f.score * 100).toFixed(0)}%
                </p>
                <p className="truncate text-xs text-[var(--app-muted)]">{f.explanation || f.entity_id}</p>
              </div>
            </div>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={busy === f.id}
              onClick={() => run(f.id, () => dismissMlFlag(f.id))}
            >
              <X className="h-3.5 w-3.5" />
              Dismiss
            </Button>
          </li>
        ))}
      </ul>
      {audit.length > 0 ? (
        <div className="border-t border-[var(--app-border)] px-4 py-3">
          <p className="mb-2 text-xs font-semibold text-[var(--app-muted)]">Recent actions</p>
          <ul className="space-y-1.5">
            {audit.slice(0, 5).map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-2 text-xs text-[var(--app-muted)]">
                <span className="truncate">
                  {a.action} · {a.kind} · {a.explanation || a.entity_id}
                </span>
                <button
                  type="button"
                  className="inline-flex items-center gap-1 font-semibold text-[var(--app-ink)] disabled:opacity-50"
                  disabled={busy === a.id}
                  onClick={() => run(a.id, () => undoMlAudit(a.id))}
                >
                  <RotateCcw className="h-3 w-3" />
                  Undo
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
