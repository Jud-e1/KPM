"use client";

import React, { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  BarChart3,
  Bell,
  Boxes,
  ChevronRight,
  ChevronsUpDown,
  CircleHelp,
  ClipboardList,
  Ellipsis,
  FileText,
  LayoutDashboard,
  Menu,
  PanelLeft,
  Search,
  Settings,
  ShoppingCart,
  Sparkles,
  Truck,
  Users,
  X,
} from "lucide-react";
import { authStore } from "@/lib/authStore";
import { accountingStore } from "@/lib/accountingStore";
import { KpmLogo } from "@/components/ui/Logo";
import { SetupRail } from "@/components/SetupRail";

const SIDEBAR_KEY = "kpm_sidebar_collapsed";

type NavItem = {
  id: string;
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  section: "primary" | "business";
  isActive: (ctx: { pathname: string; hash: string; search: string }) => boolean;
};

const NAV_ITEMS: NavItem[] = [
  {
    id: "home",
    name: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    section: "primary",
    isActive: ({ pathname }) => pathname.startsWith("/dashboard"),
  },
  {
    id: "inventory",
    name: "Inventory",
    href: "/inventory",
    icon: Boxes,
    section: "primary",
    isActive: ({ pathname, hash }) => pathname.startsWith("/inventory") && hash !== "#purchase-drafts",
  },
  {
    id: "sales",
    name: "Sales",
    href: "/sales",
    icon: ShoppingCart,
    section: "primary",
    isActive: ({ pathname }) => pathname.startsWith("/sales"),
  },
  {
    id: "purchases",
    name: "Purchases",
    href: "/inventory#purchase-drafts",
    icon: ClipboardList,
    section: "primary",
    isActive: ({ pathname, hash }) => pathname.startsWith("/inventory") && hash === "#purchase-drafts",
  },
  {
    id: "accounting",
    name: "Accounting",
    href: "/accounting",
    icon: FileText,
    section: "primary",
    isActive: ({ pathname }) => pathname.startsWith("/accounting"),
  },
  {
    id: "insights",
    name: "Insights",
    href: "/insights",
    icon: Sparkles,
    section: "primary",
    isActive: ({ pathname, search }) => pathname.startsWith("/insights") && !search.includes("view=reports"),
  },
  {
    id: "suppliers",
    name: "Suppliers",
    href: "/suppliers",
    icon: Truck,
    section: "primary",
    isActive: ({ pathname }) => pathname.startsWith("/suppliers"),
  },
  {
    id: "customers",
    name: "Customers",
    href: "/customers",
    icon: Users,
    section: "business",
    isActive: ({ pathname }) => pathname.startsWith("/customers"),
  },
  {
    id: "reports",
    name: "Reports",
    href: "/insights?view=reports",
    icon: BarChart3,
    section: "business",
    isActive: ({ pathname, search }) => pathname.startsWith("/insights") && search.includes("view=reports"),
  },
  {
    id: "settings",
    name: "Settings",
    href: "/settings",
    icon: Settings,
    section: "business",
    isActive: ({ pathname }) => pathname.startsWith("/settings"),
  },
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
  getStartedHref?: string;
  onGetStarted?: () => void;
};

function SearchListener({ onSearch }: { onSearch: (search: string) => void }) {
  const params = useSearchParams();
  useEffect(() => {
    const value = params.toString();
    onSearch(value ? `?${value}` : "");
  }, [params, onSearch]);
  return null;
}

function NavLinks({
  pathname,
  hash,
  search,
  collapsed,
  onNavigate,
}: {
  pathname: string;
  hash: string;
  search: string;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const primary = NAV_ITEMS.filter((item) => item.section === "primary");
  const business = NAV_ITEMS.filter((item) => item.section === "business");

  const renderItem = (item: NavItem) => {
    const Icon = item.icon;
    const isActive = item.isActive({ pathname, hash, search });
    return (
      <Link
        key={item.id}
        href={item.href}
        title={collapsed ? item.name : undefined}
        aria-current={isActive ? "page" : undefined}
        aria-label={item.name}
        onClick={onNavigate}
        className={`group flex items-center gap-3 rounded-lg px-3 py-2 text-[13.5px] font-medium transition-colors duration-150 ${
          collapsed ? "justify-center px-0" : ""
        } ${
          isActive
            ? "bg-[var(--app-nav-active-bg)] text-[var(--app-nav-active)]"
            : "text-[var(--app-muted)] hover:bg-[var(--app-hover)] hover:text-[var(--app-ink)]"
        }`}
      >
        <Icon className={`h-[18px] w-[18px] shrink-0 ${isActive ? "text-[var(--app-nav-active)]" : "text-[var(--app-faint)]"}`} />
        {collapsed ? <span className="sr-only">{item.name}</span> : <span className="min-w-0 flex-1 truncate">{item.name}</span>}
        {collapsed ? null : (
          <ChevronRight className={`h-3.5 w-3.5 shrink-0 ${isActive ? "text-[var(--app-nav-active)]/70" : "text-[var(--app-faint)]"}`} />
        )}
      </Link>
    );
  };

  return (
    <nav className="space-y-4" aria-label="Primary">
      <div className="space-y-0.5">{primary.map(renderItem)}</div>
      <div className="space-y-0.5">
        {collapsed ? null : (
          <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--app-faint)]">Business</p>
        )}
        {business.map(renderItem)}
      </div>
    </nav>
  );
}

function SidebarBody({
  collapsed,
  onToggle,
  showToggle,
  pathname,
  hash,
  search,
  onNavigate,
  workspaceName,
  workspacePlan,
  workspaceInitials,
  getStartedHref,
  onGetStarted,
}: {
  collapsed: boolean;
  onToggle: () => void;
  showToggle: boolean;
  pathname: string;
  hash: string;
  search: string;
  onNavigate?: () => void;
  workspaceName: string;
  workspacePlan: string;
  workspaceInitials: string;
  getStartedHref?: string;
  onGetStarted?: () => void;
}) {
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const workspaceRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!workspaceOpen) return;
    const onPointer = (event: MouseEvent) => {
      if (!workspaceRef.current?.contains(event.target as Node)) setWorkspaceOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    return () => document.removeEventListener("mousedown", onPointer);
  }, [workspaceOpen]);

  return (
    <div className="flex h-full flex-col">
      <div className={`flex items-center gap-2 pb-3 pt-4 ${collapsed ? "flex-col px-2" : "justify-between px-4"}`}>
        {collapsed ? (
          <Link href="/dashboard" className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--app-nav-active-bg)] text-sm font-semibold text-[var(--app-nav-active)]" aria-label="KPM home">
            K
          </Link>
        ) : (
          <KpmLogo />
        )}
        {showToggle ? (
          <button
            type="button"
            onClick={onToggle}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!collapsed}
            className="rounded-lg p-2 text-[var(--app-muted)] hover:bg-[var(--app-hover)] hover:text-[var(--app-ink)]"
          >
            <PanelLeft className="h-4 w-4" />
          </button>
        ) : null}
      </div>
      <div className="flex-1 overflow-y-auto px-3">
        <NavLinks pathname={pathname} hash={hash} search={search} collapsed={collapsed} onNavigate={onNavigate} />
      </div>
      {getStartedHref || onGetStarted ? (
        <div className={`px-3 pb-1 ${collapsed ? "flex justify-center" : ""}`}>
          {onGetStarted ? (
            <button
              type="button"
              onClick={() => {
                onNavigate?.();
                onGetStarted();
              }}
              title={collapsed ? "Get Started" : undefined}
              className={`block w-full rounded-2xl border border-[var(--app-border)] bg-[var(--app-hover)] text-left transition-colors duration-150 hover:bg-[var(--app-surface)] ${
                collapsed ? "p-2" : "p-3"
              }`}
            >
              {collapsed ? (
                <span className="flex h-8 w-8 items-center justify-center text-[11px] font-semibold text-[var(--app-ink)]">GS</span>
              ) : (
                <>
                  <p className="text-[13px] font-semibold text-[var(--app-ink)]">Get Started</p>
                  <p className="mt-1 text-[12px] leading-5 text-[var(--app-muted)]">Set your business name, type, and currency.</p>
                  <span className="mt-3 inline-flex h-8 items-center rounded-lg bg-[var(--app-nav-active-bg)] px-3 text-[12px] font-medium text-[var(--app-nav-active)]">
                    Get Started
                  </span>
                </>
              )}
            </button>
          ) : (
            <Link
              href={getStartedHref || "/dashboard"}
              onClick={onNavigate}
              title={collapsed ? "Get Started" : undefined}
              className={`block rounded-2xl border border-[var(--app-border)] bg-[var(--app-hover)] transition-colors duration-150 hover:bg-[var(--app-surface)] ${
                collapsed ? "p-2" : "p-3"
              }`}
            >
              {collapsed ? (
                <span className="flex h-8 w-8 items-center justify-center text-[11px] font-semibold text-[var(--app-ink)]">GS</span>
              ) : (
                <>
                  <p className="text-[13px] font-semibold text-[var(--app-ink)]">Get Started</p>
                  <p className="mt-1 text-[12px] leading-5 text-[var(--app-muted)]">Set your business name, type, and currency.</p>
                  <span className="mt-3 inline-flex h-8 items-center rounded-lg bg-[var(--app-nav-active-bg)] px-3 text-[12px] font-medium text-[var(--app-nav-active)]">
                    Get Started
                  </span>
                </>
              )}
            </Link>
          )}
        </div>
      ) : null}
      <div ref={workspaceRef} className="relative m-3 border-t border-[var(--app-border)] pt-3">
        <button
          type="button"
          onClick={() => setWorkspaceOpen((open) => !open)}
          aria-expanded={workspaceOpen}
          aria-haspopup="menu"
          title={collapsed ? workspaceName : undefined}
          className={`flex w-full items-center gap-2 rounded-xl border border-[var(--app-border)] px-2.5 py-2 text-left hover:bg-[var(--app-hover)] ${
            collapsed ? "justify-center px-0" : ""
          }`}
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#eef0f6] text-[11px] font-semibold text-[var(--app-ink)]">
            {workspaceInitials}
          </span>
          {collapsed ? null : (
            <>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-semibold text-[var(--app-ink)]">{workspaceName}</span>
                <span className="block truncate text-[11px] text-[var(--app-faint)]">{workspacePlan}</span>
              </span>
              <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-[var(--app-faint)]" />
            </>
          )}
        </button>
        {workspaceOpen ? (
          <div role="menu" className="absolute bottom-14 left-0 z-50 w-56 rounded-[14px] border border-[var(--app-border)] bg-[var(--app-surface)] p-1 shadow-[var(--app-shadow-pop)]">
            <p className="px-2.5 py-2 text-[12px] text-[var(--app-muted)]">Current workspace</p>
            <p className="px-2.5 pb-2 text-[13px] font-semibold text-[var(--app-ink)]">{workspaceName}</p>
            <Link
              href="/settings"
              role="menuitem"
              onClick={() => {
                setWorkspaceOpen(false);
                onNavigate?.();
              }}
              className="block rounded-lg px-2.5 py-2 text-sm text-[var(--app-ink)] hover:bg-[var(--app-hover)]"
            >
              Manage workspace
            </Link>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function AppShell({
  children,
  searchPlaceholder = "Search products, orders, customers, reports...",
  searchValue,
  onSearchChange,
  onSearchSubmit,
  headerExtra,
  notifications = [],
  onNotificationClick,
  maxWidthClassName = "max-w-[1400px]",
  getStartedHref,
  onGetStarted,
}: AppShellProps) {
  const pathname = usePathname() || "/dashboard";
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [compactHeader, setCompactHeader] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [hash, setHash] = useState("");
  const [search, setSearch] = useState("");
  const [shortcut, setShortcut] = useState("⌘K");
  const [profile, setProfile] = useState(accountingStore.getState().profile);
  const [authUser, setAuthUser] = useState(authStore.getState().user);
  const headerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const stored = window.localStorage.getItem(SIDEBAR_KEY);
    if (stored === "1" || stored === "0") setCollapsed(stored === "1");
    else setCollapsed(window.matchMedia("(max-width: 1023px)").matches);
    setShortcut(/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent) ? "⌘K" : "Ctrl K");
  }, []);

  useEffect(() => {
    const sync = () => setHash(window.location.hash);
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, [pathname]);

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
        setHelpOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onPointer);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onPointer);
    };
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 767px)");
    const apply = () => setCompactHeader(media.matches);
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);

  const displayName = profile.fullName || authUser?.full_name || "KPM User";
  const displayRole = profile.role || authUser?.role || "Admin";
  const initials = profileInitials(displayName);
  const workspaceName = profile.organization || authUser?.organization || "Your workspace";
  const workspacePlan = authUser?.business_type || "Workspace";
  const unread = notifications.length;

  const toggleCollapsed = () => {
    setCollapsed((value) => {
      const next = !value;
      window.localStorage.setItem(SIDEBAR_KEY, next ? "1" : "0");
      return next;
    });
  };

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
    if (query.includes("stock") || query.includes("inventory") || query.includes("sku") || query.includes("product")) {
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
    if (query.includes("supplier") || query.includes("partner") || query.includes("purchase")) {
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

  const sidebarProps = {
    pathname,
    hash,
    search,
    workspaceName,
    workspacePlan,
    workspaceInitials: profileInitials(workspaceName),
    getStartedHref,
    onGetStarted,
  };

  return (
    <div className="app-root flex min-h-screen bg-[var(--app-canvas)] font-sans text-[var(--app-ink)] antialiased">
      <Suspense fallback={null}>
        <SearchListener onSearch={setSearch} />
      </Suspense>
      <aside
        className="sticky top-0 hidden h-screen shrink-0 flex-col border-r border-[var(--app-glass-border)] bg-[var(--app-glass)] backdrop-blur-[var(--app-blur)] transition-[width] duration-200 ease-out md:flex"
        style={{ width: collapsed ? 76 : 248 }}
      >
        <SidebarBody {...sidebarProps} collapsed={collapsed} showToggle onToggle={toggleCollapsed} />
      </aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <button type="button" aria-label="Close navigation" className="absolute inset-0 bg-[var(--app-overlay)]" onClick={() => setMobileOpen(false)} />
          <div className="absolute inset-y-0 left-0 flex w-[min(18rem,88vw)] flex-col border-r border-[var(--app-glass-border)] bg-[var(--app-glass)] backdrop-blur-[var(--app-blur)]">
            <div className="flex justify-end px-2 pt-2">
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="rounded-lg p-2 text-[var(--app-muted)] hover:bg-[var(--app-hover)]"
                aria-label="Close navigation"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <SidebarBody
              {...sidebarProps}
              collapsed={false}
              showToggle={false}
              onToggle={() => undefined}
              onNavigate={() => setMobileOpen(false)}
            />
          </div>
        </div>
      ) : null}

      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-[var(--app-glass-border)] bg-[var(--app-glass)] backdrop-blur-[var(--app-blur)]">
          <div ref={headerRef} className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <button
                type="button"
                className="rounded-[var(--app-radius-control)] border border-[var(--app-border)] bg-[var(--app-surface)] p-2 text-[var(--app-ink)] transition-colors duration-160 md:hidden"
                onClick={() => setMobileOpen(true)}
                aria-label="Open navigation"
              >
                <Menu className="h-4 w-4" />
              </button>
              <form onSubmit={handleDefaultSearch} className="relative min-w-0 w-full max-w-xl" role="search">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--app-faint)]" />
                <input
                  ref={searchRef}
                  type="search"
                  placeholder={compactHeader ? "Search" : searchPlaceholder}
                  value={searchValue ?? ""}
                  onChange={(event) => onSearchChange?.(event.target.value)}
                  aria-label="Search"
                  className="h-10 w-full min-w-0 rounded-[var(--app-radius-control)] border border-[var(--app-border)] bg-[var(--app-hover)] pl-9 pr-3 text-[13px] text-[var(--app-ink)] outline-none placeholder:text-[var(--app-faint)] transition-[border-color,background-color,box-shadow] duration-160 focus:border-[var(--app-accent)] focus:bg-[var(--app-surface)] focus:shadow-[var(--app-focus-ring)] sm:pr-16"
                />
                <kbd className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 rounded-md border border-[var(--app-border)] bg-[var(--app-surface)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--app-faint)] sm:inline">
                  {shortcut}
                </kbd>
              </form>
            </div>

            <div className="flex items-center gap-1.5">
              {headerExtra}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setHelpOpen((open) => !open);
                    setNotifOpen(false);
                    setUserOpen(false);
                  }}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--app-muted)] hover:bg-[var(--app-hover)]"
                  aria-label="Help"
                  aria-expanded={helpOpen}
                >
                  <CircleHelp className="h-4 w-4" />
                </button>
                {helpOpen ? (
                  <div className="absolute right-0 z-50 mt-1 w-64 rounded-[14px] border border-[var(--app-border)] bg-[var(--app-surface)] p-2 shadow-[var(--app-shadow-pop)]">
                    <p className="px-2 py-1.5 text-sm font-medium text-[var(--app-ink)]">Help</p>
                    <Link href="/dashboard?tour=1" onClick={() => setHelpOpen(false)} className="block rounded-lg px-2 py-2 text-[13px] text-[var(--app-ink)] hover:bg-[var(--app-hover)]">
                      Take the dashboard tour
                    </Link>
                    <Link href="/dashboard#get-started" onClick={() => setHelpOpen(false)} className="block rounded-lg px-2 py-2 text-[13px] text-[var(--app-ink)] hover:bg-[var(--app-hover)]">
                      Get started with your business
                    </Link>
                    <Link href="/settings" onClick={() => setHelpOpen(false)} className="block rounded-lg px-2 py-2 text-[13px] text-[var(--app-ink)] hover:bg-[var(--app-hover)]">
                      Settings and connections
                    </Link>
                  </div>
                ) : null}
              </div>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setNotifOpen((open) => !open);
                    setUserOpen(false);
                    setHelpOpen(false);
                  }}
                  className="relative flex h-9 w-9 items-center justify-center rounded-lg text-[var(--app-muted)] hover:bg-[var(--app-hover)]"
                  aria-label="Notifications"
                  aria-expanded={notifOpen}
                >
                  <Bell className="h-4 w-4" />
                  {unread > 0 ? <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-[var(--app-critical)]" /> : null}
                </button>
                {notifOpen ? (
                  <div className="absolute right-0 z-50 mt-1 w-[min(20rem,calc(100vw-1.5rem))] rounded-[14px] border border-[var(--app-border)] bg-[var(--app-surface)] p-2 shadow-[var(--app-shadow-pop)]">
                    <div className="flex items-center justify-between px-2 py-1.5 text-sm font-medium">
                      <span>Notifications</span>
                      <button
                        type="button"
                        onClick={() => setNotifOpen(false)}
                        className="rounded-lg p-1 text-[var(--app-muted)] hover:bg-[var(--app-hover)]"
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
                            className="block w-full rounded-lg px-2 py-2 text-left hover:bg-[var(--app-hover)]"
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
                    setHelpOpen(false);
                  }}
                  className="flex items-center gap-2 rounded-lg py-1 pl-1 pr-1.5 hover:bg-[var(--app-hover)]"
                  aria-expanded={userOpen}
                  aria-haspopup="menu"
                  aria-label="Account menu"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--app-nav-active-bg)] text-xs font-semibold text-[var(--app-nav-active)]">
                    {initials}
                  </span>
                  <span className="hidden text-left sm:block">
                    <span className="block max-w-[9rem] truncate text-[13px] font-semibold leading-tight text-[var(--app-ink)]">{displayName}</span>
                    <span className="block text-[11px] text-[var(--app-faint)]">{displayRole}</span>
                  </span>
                </button>
                {userOpen ? (
                  <div role="menu" className="absolute right-0 z-50 mt-1 w-48 rounded-[14px] border border-[var(--app-border)] bg-[var(--app-surface)] p-1 shadow-[var(--app-shadow-pop)]">
                    <Link href="/settings" role="menuitem" onClick={() => setUserOpen(false)} className="block rounded-lg px-2.5 py-2 text-sm text-[var(--app-ink)] hover:bg-[var(--app-hover)]">
                      Account settings
                    </Link>
                    <Link href="/insights" role="menuitem" onClick={() => setUserOpen(false)} className="block rounded-lg px-2.5 py-2 text-sm text-[var(--app-ink)] hover:bg-[var(--app-hover)]">
                      Insights
                    </Link>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={signOut}
                      className="block w-full rounded-lg px-2.5 py-2 text-left text-sm text-[var(--app-critical)] hover:bg-[var(--app-critical-bg)]"
                    >
                      Log out
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </header>

        <SetupRail />

        <main className={`mx-auto w-full min-w-0 flex-1 px-4 pb-24 pt-5 sm:px-6 sm:pt-6 md:pb-6 ${maxWidthClassName}`}>{children}</main>
        <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--app-border)] bg-[var(--app-surface)] md:hidden" aria-label="Mobile">
          <ul className="grid grid-cols-5">
            {[
              { href: "/dashboard", label: "Home", icon: LayoutDashboard, active: pathname === "/dashboard" },
              { href: "/inventory", label: "Stock", icon: Boxes, active: pathname.startsWith("/inventory") },
              { href: "/sales", label: "Sales", icon: ShoppingCart, active: pathname.startsWith("/sales") },
              { href: "/accounting", label: "Books", icon: FileText, active: pathname.startsWith("/accounting") },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`flex h-14 flex-col items-center justify-center gap-0.5 text-[10px] font-medium ${
                      item.active ? "text-[var(--app-ink)]" : "text-[var(--app-faint)]"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                </li>
              );
            })}
            <li>
              <button
                type="button"
                onClick={() => setMobileOpen(true)}
                className="flex h-14 w-full flex-col items-center justify-center gap-0.5 text-[10px] font-medium text-[var(--app-faint)]"
              >
                <Ellipsis className="h-4 w-4" />
                More
              </button>
            </li>
          </ul>
        </nav>
      </div>
    </div>
  );
}
