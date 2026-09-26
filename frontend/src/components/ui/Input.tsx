import React from "react";

export const fieldClass =
  "w-full h-9 rounded-[var(--app-radius-control)] border border-[var(--app-border-strong)] bg-[var(--app-surface)] px-3 text-sm text-[var(--app-ink)] placeholder:text-[var(--app-faint)] outline-none transition-[border-color,box-shadow] duration-160 ease-out focus:border-[var(--app-accent)] focus:shadow-[var(--app-focus-ring)]";

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
