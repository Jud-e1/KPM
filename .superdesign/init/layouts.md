# Shared Layouts

## AppShell
- Path: `frontend/src/components/AppShell.tsx`
- Description: Signed-in shell: sticky sidebar (logo + nav), top search/notifications/user, main content

```tsx
"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3,
  Bell,
  Boxes,
  FileText,
  Home,
  LineChart,
  Menu,
  Search,
  Settings,
  ShoppingCart,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { authStore } from "@/lib/authStore";
import { accountingStore } from "@/lib/accountingStore";
import { KpmLogo } from "@/components/ui/Logo";

export type AppShellNavId =
  | "home"
  | "inventory"
  | "sales"
  | "accounting"
  | "customers"
  | "suppliers"
  | "insights"
  | "reports"
  | "settings";

const NAV_ITEMS: Array<{
  id: AppShellNavId;
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  match: (pathname: string) => boolean;
}> = [
  { id: "home", name: "Home", href: "/dashboard", icon: Home, match: (p) => p.startsWith("/dashboard") },
  { id: "inventory", name: "Inventory", href: "/inventory", icon: Boxes, match: (p) => p.startsWith("/inventory") },
  { id: "sales", name: "Sales", href: "/sales", icon: ShoppingCart, match: (p) => p.startsWith("/sales") },
  { id: "accounting", name: "Accounting", href: "/accounting", icon: FileText, match: (p) => p.startsWith("/accounting") },
  { id: "insights", name: "Insights", href: "/insights", icon: LineChart, match: (p) => p.startsWith("/insights") },
  { id: "suppliers", name: "Suppliers", href: "/suppliers", icon: Users, match: (p) => p.startsWith("/suppliers") },
  { id: "customers", name: "Customers", href: "/customers", icon: UserRound, match: (p) => p.startsWith("/customers") },
  { id: "reports", name: "Reports", href: "/insights", icon: BarChart3, match: () => false },
  { id: "settings", name: "Settings", href: "/settings", icon: Settings, match: (p) => p.startsWith("/settings") },
];

function profileInitials(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  return `${parts[0]?.[0] || ""}${parts[1]?.[0] || ""}`.toUpperCase() || "KP";
}

type AppShellProps = {
  children: React.ReactNode;
  searchPlaceholder?: string;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  onSearchSubmit?: (event: React.FormEvent) => void;
  headerExtra?: React.ReactNode;
  notifications?: Array<{ id: string; title: string; subtitle?: string; time?: string }>;
  onNotificationClick?: (id: string) => void;
  maxWidthClassName?: string;
};

function NavList({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <nav className="space-y-0.5">
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        const isActive = item.match(pathname);
        return (
          <Link
            key={item.id}
            href={item.href}
            onClick={onNavigate}
            aria-current={isActive ? "page" : undefined}
            className={`flex items-center gap-3 rounded-[var(--app-radius-control)] px-3 py-2 text-[13.5px] font-medium transition-colors duration-150 ${
              isActive
                ? "bg-[var(--app-nav-active-bg)] text-[var(--app-nav-active)]"
                : "text-[var(--app-muted)] hover:bg-[var(--app-hover)] hover:text-[var(--app-ink)]"
            }`}
          >
            <Icon className={`h-[18px] w-[18px] ${isActive ? "text-[var(--app-ink)]" : "text-[var(--app-faint)]"}`} />
            <span>{item.name}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export function AppShell({
  children,
  searchPlaceholder = "Search stock, orders, invoices…",
  searchValue,
  onSearchChange,
  onSearchSubmit,
  headerExtra,
  notifications = [],
  onNotificationClick,
  maxWidthClassName = "max-w-[1400px]",
}: AppShellProps) {
  const pathname = usePathname() || "/dashboard";
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [profile, setProfile] = useState(accountingStore.getState().profile);
  const [authUser, setAuthUser] = useState(authStore.getState().user);
  const headerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const unsubAcct = accountingStore.subscribe((state) => setProfile(state.profile));
    const unsubAuth = authStore.subscribe((state) => setAuthUser(state.user));
    return () => {
      unsubAcct();
      unsubAuth();
    };
  }, []);

  useEffect(() => {
    setMobileOpen(false);
    setUserOpen(false);
    setNotifOpen(false);
  }, [pathname]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobileOpen(false);
        setUserOpen(false);
        setNotifOpen(false);
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    const onPointer = (event: MouseEvent) => {
      if (!headerRef.current?.contains(event.target as Node)) {
        setUserOpen(false);
        setNotifOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onPointer);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onPointer);
    };
  }, []);

  const displayName = profile.fullName || authUser?.full_name || "KPM User";
  const displayRole = profile.role || authUser?.role || "Admin";
  const initials = profileInitials(displayName);
  const unread = notifications.length;

  const signOut = () => {
    authStore.clearSession();
    router.replace("/signin");
  };

  const handleDefaultSearch = (event: React.FormEvent) => {
    event.preventDefault();
    if (onSearchSubmit) {
      onSearchSubmit(event);
      return;
    }
    const query = (searchValue || "").trim().toLowerCase();
    if (!query) return;
    if (query.includes("stock") || query.includes("inventory") || query.includes("sku")) {
      router.push("/inventory");
      return;
    }
    if (query.includes("sale") || query.includes("order")) {
      router.push("/sales");
      return;
    }
    if (query.includes("account") || query.includes("invoice") || query.includes("ledger")) {
      router.push("/accounting");
      return;
    }
    if (query.includes("customer")) {
      router.push("/customers");
      return;
    }
    if (query.includes("supplier") || query.includes("partner") || query.includes("b2b")) {
      router.push("/suppliers");
      return;
    }
    if (query.includes("insight") || query.includes("forecast") || query.includes("ai") || query.includes("report")) {
      router.push("/insights");
      return;
    }
    if (query.includes("setting")) {
      router.push("/settings");
    }
  };

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="px-5 pb-3 pt-5">
        <KpmLogo />
      </div>
      <div className="flex-1 overflow-y-auto px-3">
        <NavList pathname={pathname} onNavigate={() => setMobileOpen(false)} />
      </div>
      <div className="m-3 border-t border-[var(--app-border)] pt-3">
        <Link
          href="/insights"
          onClick={() => setMobileOpen(false)}
          className="flex items-center gap-2 rounded-[var(--app-radius-control)] px-3 py-2 text-[12.5px] font-medium text-[var(--app-muted)] hover:bg-[var(--app-hover)] hover:text-[var(--app-ink)]"
        >
          <LineChart className="h-3.5 w-3.5" />
          Open Insights
        </Link>
        <Link
          href="/settings"
          onClick={() => setMobileOpen(false)}
          className="mt-0.5 flex items-center gap-2 rounded-[var(--app-radius-control)] px-3 py-2 text-[12.5px] font-medium text-[var(--app-muted)] hover:bg-[var(--app-hover)] hover:text-[var(--app-ink)]"
        >
          <Settings className="h-3.5 w-3.5" />
          Automation settings
        </Link>
      </div>
    </div>
  );

  return (
    <div className="app-root min-h-screen bg-[var(--app-canvas)] text-[var(--app-ink)] flex font-sans antialiased">
      <aside className="hidden md:flex w-[232px] shrink-0 flex-col sticky top-0 h-screen border-r border-[var(--app-border)] bg-[var(--app-surface)]">
        {sidebar}
      </aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            className="absolute inset-0 bg-[#121417]/40"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 flex w-[min(16.5rem,88vw)] flex-col border-r border-[var(--app-border)] bg-[var(--app-surface)]">
            <div className="flex justify-end px-2 pt-2">
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="rounded-[var(--app-radius-control)] p-2 text-[var(--app-muted)] hover:bg-[var(--app-hover)]"
                aria-label="Close navigation"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {sidebar}
          </div>
        </div>
      ) : null}

      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 bg-[var(--app-canvas)]/95 backdrop-blur-sm">
          <div ref={headerRef} className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <button
                type="button"
                className="md:hidden rounded-[var(--app-radius-control)] border border-[var(--app-border)] bg-[var(--app-surface)] p-2 text-[var(--app-ink)]"
                onClick={() => setMobileOpen(true)}
                aria-label="Open navigation"
              >
                <Menu className="h-4 w-4" />
              </button>
              <form onSubmit={handleDefaultSearch} className="relative w-full max-w-xl" role="search">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--app-faint)]" />
                <input
                  ref={searchRef}
                  type="search"
                  placeholder={searchPlaceholder}
                  value={searchValue ?? ""}
                  onChange={(event) => onSearchChange?.(event.target.value)}
                  className="h-9 w-full rounded-[var(--app-radius-control)] border border-[var(--app-border)] bg-[var(--app-surface)] pl-9 pr-12 text-[13px] text-[var(--app-ink)] placeholder:text-[var(--app-faint)] outline-none focus:border-[var(--app-border-strong)]"
                />
                <kbd className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 rounded border border-[var(--app-border)] bg-[var(--app-hover)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--app-faint)] sm:inline">
                  ⌘K
                </kbd>
              </form>
            </div>

            <div className="flex items-center gap-1.5">
              {headerExtra}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setNotifOpen((open) => !open);
                    setUserOpen(false);
                  }}
                  className="relative flex h-9 w-9 items-center justify-center rounded-[var(--app-radius-control)] text-[var(--app-muted)] hover:bg-[var(--app-hover)]"
                  aria-label="Notifications"
                  aria-expanded={notifOpen}
                >
                  <Bell className="h-4 w-4" />
                  {unread > 0 ? (
                    <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-[var(--app-critical)]" />
                  ) : null}
                </button>
                {notifOpen ? (
                  <div className="absolute right-0 z-50 mt-1 w-80 rounded-[var(--app-radius)] border border-[var(--app-border)] bg-white p-2 shadow-[var(--app-shadow-pop)]">
                    <div className="flex items-center justify-between px-2 py-1.5 text-sm font-medium">
                      <span>Notifications</span>
                      <button
                        type="button"
                        onClick={() => setNotifOpen(false)}
                        className="rounded-[var(--app-radius-control)] p-1 text-[var(--app-muted)] hover:bg-[var(--app-hover)]"
                        aria-label="Close notifications"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="max-h-72 overflow-y-auto">
                      {notifications.length === 0 ? (
                        <p className="px-2 py-6 text-center text-sm text-[var(--app-muted)]">No new notifications</p>
                      ) : (
                        notifications.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => {
                              setNotifOpen(false);
                              onNotificationClick?.(item.id);
                            }}
                            className="block w-full rounded-[var(--app-radius-control)] px-2 py-2 text-left hover:bg-[var(--app-hover)]"
                          >
                            <div className="text-sm font-medium text-[var(--app-ink)]">{item.title}</div>
                            <div className="mt-0.5 text-xs text-[var(--app-muted)]">{item.subtitle || item.time}</div>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setUserOpen((open) => !open);
                    setNotifOpen(false);
                  }}
                  className="flex items-center gap-2 rounded-[var(--app-radius-control)] py-1 pl-1 pr-1.5 hover:bg-[var(--app-hover)]"
                  aria-expanded={userOpen}
                  aria-haspopup="menu"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--app-hover)] text-xs font-semibold text-[var(--app-ink)]">
                    {initials}
                  </span>
                  <span className="hidden text-left sm:block">
                    <span className="block text-[13px] font-semibold leading-tight text-[var(--app-ink)]">{displayName}</span>
                    <span className="block text-[11px] text-[var(--app-faint)]">{displayRole}</span>
                  </span>
                </button>
                {userOpen ? (
                  <div
                    role="menu"
                    className="absolute right-0 z-50 mt-1 w-48 rounded-[var(--app-radius)] border border-[var(--app-border)] bg-white p-1 shadow-[var(--app-shadow-pop)]"
                  >
                    <Link
                      href="/settings"
                      role="menuitem"
                      onClick={() => setUserOpen(false)}
                      className="block rounded-[var(--app-radius-control)] px-2.5 py-2 text-sm text-[var(--app-ink)] hover:bg-[var(--app-hover)]"
                    >
                      Account settings
                    </Link>
                    <Link
                      href="/insights"
                      role="menuitem"
                      onClick={() => setUserOpen(false)}
                      className="block rounded-[var(--app-radius-control)] px-2.5 py-2 text-sm text-[var(--app-ink)] hover:bg-[var(--app-hover)]"
                    >
                      Insights
                    </Link>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={signOut}
                      className="block w-full rounded-[var(--app-radius-control)] px-2.5 py-2 text-left text-sm text-[var(--app-critical)] hover:bg-[var(--app-critical-bg)]"
                    >
                      Log out
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </header>

        <main className={`mx-auto w-full flex-1 space-y-4 px-4 pb-8 sm:px-5 ${maxWidthClassName}`}>
          {children}
        </main>
      </div>
    </div>
  );
}
```

## Dashboard layout (AuthGuard)
- Path: `frontend/src/app/dashboard/layout.tsx`
- Description: Wraps dashboard in AuthGuard

```tsx
"use client";

import { AuthGuard } from "@/components/AuthGuard";

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return <AuthGuard>{children}</AuthGuard>;
}
```

## AuthGuard
- Path: `frontend/src/components/AuthGuard.tsx`
- Description: Redirects unauthenticated users to /signin

```tsx
"use client";

import React, { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { authStore } from "@/lib/authStore";
import { fetchMe } from "@/lib/api";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      const token = authStore.getToken();
      if (!token) {
        router.replace(`/signin?next=${encodeURIComponent(pathname || "/dashboard")}`);
        return;
      }
      try {
        const user = await fetchMe();
        if (cancelled) return;
        authStore.updateUser(user);
        setAllowed(true);
      } catch {
        if (cancelled) return;
        authStore.clearSession();
        router.replace(`/signin?next=${encodeURIComponent(pathname || "/dashboard")}`);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [pathname, router]);

  if (!allowed) {
    return (
      <div className="min-h-screen bg-[var(--app-canvas)] flex items-center justify-center text-sm text-[var(--app-muted)]">
        Checking your session…
      </div>
    );
  }

  return <>{children}</>;
}
```

## Root layout
- Path: `frontend/src/app/layout.tsx`
- Description: Plus Jakarta Sans font variable + globals.css

```tsx
import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "KPM | Smarter Inventory, Healthier Finances",
  description:
    "KPM automates your inventory, reconciles your accounts, catches errors, and runs 24/7 with AI — so you can focus on growing your business.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="scroll-smooth">
      <body
        className={`${plusJakartaSans.variable} font-sans antialiased bg-[#F8FAFC] text-[#0F172A] selection:bg-[#0F172A] selection:text-white`}
      >
        <script src="https://mcp.figma.com/mcp/html-to-design/capture.js" async />
        {children}
      </body>
    </html>
  );
}
```

