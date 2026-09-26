"use client";

import { ChevronRight } from "lucide-react";
import type { ComponentType } from "react";
import { Card, CardHeader } from "./Card";

export type ActivityItem = {
  id: string;
  title: string;
  detail: string;
  time: string;
  badge: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
};

export function RecentActivity({
  items,
  onOpen,
  onViewAll,
}: {
  items: ActivityItem[];
  onOpen: (item: ActivityItem) => void;
  onViewAll: () => void;
}) {
  return (
    <Card className="p-4 sm:p-5">
      <CardHeader
        title="Recent Activity"
        action={
          <button
            type="button"
            onClick={onViewAll}
            className="text-[12.5px] font-medium text-[var(--app-muted)] hover:text-[var(--app-ink)]"
          >
            View all
          </button>
        }
      />
      {items.length === 0 ? (
        <p className="px-1 py-8 text-center text-[13px] text-[var(--app-muted)]">
          Activity shows up after the first order, stock change, or transaction.
        </p>
      ) : (
        <ul className="mt-2 divide-y divide-[var(--app-border)]">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => onOpen(item)}
                  className="flex w-full items-center gap-3 py-2.5 text-left hover:bg-[var(--app-hover)]"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#f4f6fb] text-[var(--app-accent)]">
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-semibold text-[var(--app-ink)]">{item.title}</span>
                    <span className="block truncate text-[12px] text-[var(--app-muted)]">{item.detail}</span>
                  </span>
                  <span className="hidden shrink-0 text-right sm:block">
                    <span className="block text-[11px] text-[var(--app-faint)]">{item.time}</span>
                    <span className="mt-1 inline-flex rounded-md bg-[var(--app-hover)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--app-muted)]">
                      {item.badge}
                    </span>
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-[var(--app-faint)]" aria-hidden />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
