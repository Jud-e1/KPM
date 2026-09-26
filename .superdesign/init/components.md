# Shared UI Components

Framework: Next.js 16 + React 19 + Tailwind CSS 4. Custom primitives under `frontend/src/components/ui/`. Icons: lucide-react.

## Button
- Path: `frontend/src/components/ui/Button.tsx`
- Description: Primary/secondary/ghost/destructive button; supports href via Next Link

```tsx
import Link from "next/link";
import React from "react";

type Variant = "primary" | "secondary" | "ghost" | "destructive";
type Size = "sm" | "md";

const variants: Record<Variant, string> = {
  primary: "bg-[var(--app-ink)] text-white hover:bg-[#2c3138]",
  secondary:
    "bg-white text-[var(--app-ink)] border border-[var(--app-border-strong)] hover:bg-[var(--app-hover)]",
  ghost: "bg-transparent text-[var(--app-ink)] hover:bg-[var(--app-hover)]",
  destructive:
    "bg-white text-[var(--app-critical)] border border-[var(--app-critical-border)] hover:bg-[var(--app-critical-bg)]",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-[13px]",
  md: "h-9 px-3.5 text-sm",
};

type Common = {
  variant?: Variant;
  size?: Size;
  className?: string;
  children: React.ReactNode;
};

type ButtonAsButton = Common &
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    href?: undefined;
  };

type ButtonAsLink = Common &
  Omit<React.ComponentProps<typeof Link>, "className" | "children"> & {
    href: string;
  };

function classes(variant: Variant, size: Size, className?: string) {
  return [
    "inline-flex items-center justify-center gap-2 rounded-[var(--app-radius-control)] font-medium",
    "transition-colors duration-150 disabled:opacity-50 disabled:pointer-events-none",
    variants[variant],
    sizes[size],
    className || "",
  ].join(" ");
}

function stripVisual<T extends Common>(props: T) {
  const rest = { ...props };
  delete rest.variant;
  delete rest.size;
  delete rest.className;
  delete rest.children;
  return rest;
}

export function Button(props: ButtonAsButton | ButtonAsLink) {
  const cls = classes(props.variant ?? "primary", props.size ?? "md", props.className);
  if (typeof props.href === "string") {
    const linkProps = stripVisual(props);
    return (
      <Link className={cls} {...linkProps}>
        {props.children}
      </Link>
    );
  }
  const buttonProps = stripVisual(props);
  return (
    <button className={cls} {...buttonProps}>
      {props.children}
    </button>
  );
}
```

## Input
- Path: `frontend/src/components/ui/Input.tsx`
- Description: Labeled text field with hint/error

```tsx
import React from "react";

export const fieldClass =
  "w-full h-9 rounded-[var(--app-radius-control)] border border-[var(--app-border-strong)] bg-white px-3 text-sm text-[var(--app-ink)] placeholder:text-[var(--app-faint)] outline-none transition-colors duration-150 focus:border-[var(--app-ink)]";

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  hint?: string;
  error?: string;
};

export function Input({ label, hint, error, id, className, ...props }: InputProps) {
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);
  return (
    <label className="block" htmlFor={inputId}>
      {label ? (
        <span className="mb-1.5 block text-[13px] font-medium text-[var(--app-ink)]">{label}</span>
      ) : null}
      <input
        id={inputId}
        className={`${fieldClass} ${error ? "border-[var(--app-critical)]" : ""} ${className || ""}`}
        aria-invalid={error ? true : undefined}
        {...props}
      />
      {error ? <span className="mt-1.5 block text-xs text-[var(--app-critical)]">{error}</span> : null}
      {!error && hint ? <span className="mt-1.5 block text-xs text-[var(--app-muted)]">{hint}</span> : null}
    </label>
  );
}
```

## Dialog
- Path: `frontend/src/components/ui/Dialog.tsx`
- Description: Modal dialog with overlay and Escape close

```tsx
"use client";

import React, { useEffect, useRef } from "react";
import { X } from "lucide-react";

export function Dialog({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCloseRef.current();
    };
    window.addEventListener("keydown", onKey);
    panelRef.current?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <button type="button" aria-label="Close dialog" className="absolute inset-0 bg-[#121417]/40" onClick={onClose} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="kpm-dialog-title"
        tabIndex={-1}
        className="relative w-full max-w-md rounded-[var(--app-radius)] border border-[var(--app-border)] bg-white p-5 shadow-[var(--app-shadow-pop)] outline-none"
      >
        <div className="flex items-start justify-between gap-4">
          <h2 id="kpm-dialog-title" className="text-base font-semibold text-[var(--app-ink)]">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-[var(--app-radius-control)] p-1 text-[var(--app-muted)] hover:bg-[var(--app-hover)] hover:text-[var(--app-ink)]"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-4 text-sm text-[var(--app-ink)]">{children}</div>
      </div>
    </div>
  );
}
```

## PageHeader
- Path: `frontend/src/components/ui/PageHeader.tsx`
- Description: Page title + description + actions; also SectionHeading

```tsx
import React from "react";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-[22px] font-semibold tracking-tight text-[var(--app-ink)] leading-tight">{title}</h1>
        {description ? <p className="mt-1 text-sm text-[var(--app-muted)] leading-normal">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div> : null}
    </div>
  );
}

export function SectionHeading({
  title,
  meta,
  action,
}: {
  title: string;
  meta?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-2.5 flex items-baseline justify-between gap-3">
      <h2 className="text-sm font-semibold text-[var(--app-ink)]">{title}</h2>
      <div className="flex items-center gap-3 text-xs text-[var(--app-muted)]">
        {meta}
        {action}
      </div>
    </div>
  );
}
```

## MetricStrip
- Path: `frontend/src/components/ui/MetricStrip.tsx`
- Description: 2/4-col KPI strip with optional links

```tsx
import Link from "next/link";

export type MetricItem = {
  label: string;
  value: string;
  hint?: string;
  href?: string;
};

export function MetricStrip({ items }: { items: MetricItem[] }) {
  return (
    <section className="grid grid-cols-2 lg:grid-cols-4 overflow-hidden rounded-[var(--app-radius)] border border-[var(--app-border)] bg-white divide-x divide-y lg:divide-y-0 divide-[var(--app-border)]">
      {items.map((item) => {
        const body = (
          <>
            <div className="text-xs font-medium text-[var(--app-muted)]">{item.label}</div>
            <div className="mt-1 text-[22px] font-semibold tabular-nums tracking-tight text-[var(--app-ink)] leading-none">
              {item.value}
            </div>
            {item.hint ? <div className="mt-1.5 text-xs text-[var(--app-muted)]">{item.hint}</div> : null}
          </>
        );
        return item.href ? (
          <Link
            key={item.label}
            href={item.href}
            className="block px-4 py-3.5 hover:bg-[var(--app-hover)] transition-colors duration-150"
          >
            {body}
          </Link>
        ) : (
          <div key={item.label} className="px-4 py-3.5">
            {body}
          </div>
        );
      })}
    </section>
  );
}
```

## DataTable
- Path: `frontend/src/components/ui/DataTable.tsx`
- Description: Bordered table wrapper with THead/Th/Td

```tsx
import React from "react";

export function DataTable({
  children,
  caption,
}: {
  children: React.ReactNode;
  caption?: string;
}) {
  return (
    <div className="overflow-x-auto rounded-[var(--app-radius)] border border-[var(--app-border)] bg-white">
      <table className="w-full min-w-[640px] border-collapse text-left text-[13px]">
        {caption ? <caption className="sr-only">{caption}</caption> : null}
        {children}
      </table>
    </div>
  );
}

export function THead({ children }: { children: React.ReactNode }) {
  return (
    <thead>
      <tr className="border-b border-[var(--app-border)] text-xs font-medium text-[var(--app-muted)]">{children}</tr>
    </thead>
  );
}

export function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <th className={`px-3 py-2.5 font-medium ${className}`}>{children}</th>;
}

export function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-3 align-middle text-[var(--app-ink)] ${className}`}>{children}</td>;
}
```

## Status
- Path: `frontend/src/components/ui/Status.tsx`
- Description: Tone-colored status with dot

```tsx
import type { ReactNode } from "react";

type Tone = "neutral" | "positive" | "warning" | "critical";

const text: Record<Tone, string> = {
  neutral: "text-[var(--app-muted)]",
  positive: "text-[var(--app-positive)]",
  warning: "text-[var(--app-warning)]",
  critical: "text-[var(--app-critical)]",
};

const dot: Record<Tone, string> = {
  neutral: "bg-[var(--app-faint)]",
  positive: "bg-[var(--app-positive)]",
  warning: "bg-[var(--app-warning)]",
  critical: "bg-[var(--app-critical)]",
};

export function Status({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${text[tone]}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dot[tone]}`} aria-hidden />
      {children}
    </span>
  );
}
```

## Skeleton
- Path: `frontend/src/components/ui/Skeleton.tsx`
- Description: Loading skeleton and TableSkeleton

```tsx
export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-[var(--app-radius-control)] bg-[var(--app-hover)] ${className}`} />;
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="rounded-[var(--app-radius)] border border-[var(--app-border)] bg-white p-3 space-y-2" aria-hidden>
      <Skeleton className="h-8 w-full" />
      {Array.from({ length: rows }).map((_, index) => (
        <Skeleton key={index} className="h-10 w-full" />
      ))}
    </div>
  );
}
```

## Logo
- Path: `frontend/src/components/ui/Logo.tsx`
- Description: KpmLogo / KpmLogoImage using /brand/kpm-logo.png

```tsx
import Link from "next/link";

type LogoImageProps = {
  className?: string;
  alt?: string;
};

export function KpmLogoImage({ className = "h-8 w-auto", alt = "KPM" }: LogoImageProps) {
  return <img src="/brand/kpm-logo.png" alt={alt} className={`object-contain ${className}`} />;
}

export function KpmLogo({
  href = "/dashboard",
  className = "h-8 w-auto",
}: {
  href?: string;
  className?: string;
}) {
  return (
    <Link href={href} className="inline-flex items-center rounded-md">
      <KpmLogoImage className={className} />
    </Link>
  );
}
```

## EmptyState
- Path: `frontend/src/components/EmptyState.tsx`
- Description: Empty workspace CTA + SyncBanner

```tsx
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
    <div className="flex flex-col items-start gap-1 rounded-[var(--app-radius)] border border-dashed border-[var(--app-border-strong)] bg-white px-4 py-8">
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
    <div className="mb-4 flex items-center gap-2 rounded-[var(--app-radius)] border border-[var(--app-border)] bg-white px-3 py-2.5 text-sm text-[var(--app-muted)]">
      <Loader2 className="h-4 w-4 animate-spin shrink-0" />
      <span>Syncing latest data…</span>
    </div>
  );
}
```

