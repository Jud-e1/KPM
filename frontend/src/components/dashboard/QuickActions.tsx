import Link from "next/link";
import { ClipboardList, Plus, Scale, ShoppingBag } from "lucide-react";
import { Card, CardHeader } from "./Card";

const ACTIONS = [
  {
    href: "/inventory?add=1",
    title: "Add Product",
    detail: "Create a new product",
    icon: Plus,
    tour: "inventory",
  },
  {
    href: "/sales?new=1",
    title: "Create Sale",
    detail: "Process a new sale",
    icon: ShoppingBag,
    tour: "sales",
  },
  {
    href: "/inventory#purchase-drafts",
    title: "Record Purchase",
    detail: "Add supplier purchase",
    icon: ClipboardList,
    tour: undefined,
  },
  {
    href: "/accounting",
    title: "Reconcile Accounting",
    detail: "Match and review transactions",
    icon: Scale,
    tour: undefined,
  },
] as const;

export function QuickActions() {
  return (
    <Card className="p-4 sm:p-5">
      <CardHeader title="Quick Actions" />
      <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {ACTIONS.map((action) => {
          const Icon = action.icon;
          return (
            <li key={action.href}>
              <Link
                href={action.href}
                data-tour={action.tour}
                className="flex h-full items-center gap-3 rounded-xl border border-[var(--app-border)] px-3 py-2.5 transition-colors duration-150 hover:bg-[var(--app-hover)]"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#eef3ff] text-[#3b6cff]">
                  <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0">
                  <span className="block text-[13px] font-semibold text-[var(--app-ink)]">{action.title}</span>
                  <span className="block truncate text-[12px] text-[var(--app-muted)]">{action.detail}</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
