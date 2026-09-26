import Link from "next/link";
import React from "react";

type Variant = "primary" | "secondary" | "ghost" | "destructive";
type Size = "sm" | "md";

const variants: Record<Variant, string> = {
  primary:
    "bg-[var(--app-nav-active-bg)] text-[var(--app-nav-active)] shadow-[var(--app-shadow-xs)] hover:opacity-90",
  secondary:
    "bg-[var(--app-surface)] text-[var(--app-ink)] border border-[var(--app-border-strong)] hover:bg-[var(--app-hover)]",
  ghost: "bg-transparent text-[var(--app-ink)] hover:bg-[var(--app-hover)]",
  destructive:
    "bg-[var(--app-surface)] text-[var(--app-critical)] border border-[var(--app-critical-border)] hover:bg-[var(--app-critical-bg)]",
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
    "transition-[transform,opacity,background-color,box-shadow,border-color] duration-160 ease-out",
    "hover:scale-[1.01] active:scale-[0.98]",
    "disabled:opacity-50 disabled:pointer-events-none disabled:hover:scale-100",
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
