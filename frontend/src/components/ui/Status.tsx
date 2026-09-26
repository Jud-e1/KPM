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

const fill: Record<Tone, string> = {
  neutral: "bg-[var(--app-hover)]",
  positive: "bg-[var(--app-positive-bg)]",
  warning: "bg-[var(--app-warning-bg)]",
  critical: "bg-[var(--app-critical-bg)]",
};

export function Status({
  tone = "neutral",
  filled = false,
  children,
}: {
  tone?: Tone;
  filled?: boolean;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-medium ${text[tone]} ${
        filled ? `rounded-md px-2 py-0.5 ${fill[tone]}` : ""
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${dot[tone]}`} aria-hidden />
      {children}
    </span>
  );
}
