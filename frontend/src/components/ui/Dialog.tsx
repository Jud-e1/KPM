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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 app-fade-in">
      <button
        type="button"
        aria-label="Close dialog"
        className="absolute inset-0 bg-[var(--app-overlay)] backdrop-blur-[2px]"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="kpm-dialog-title"
        tabIndex={-1}
        className="relative w-full max-w-md rounded-[var(--app-radius)] border border-[var(--app-glass-border)] bg-[var(--app-glass)] p-5 shadow-[var(--app-shadow-pop)] outline-none backdrop-blur-[var(--app-blur)] app-slide-in"
      >
        <div className="flex items-start justify-between gap-4">
          <h2 id="kpm-dialog-title" className="text-base font-semibold tracking-[-0.02em] text-[var(--app-ink)]">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-[var(--app-radius-control)] p-1 text-[var(--app-muted)] transition-colors duration-160 hover:bg-[var(--app-hover)] hover:text-[var(--app-ink)]"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-4 text-sm leading-relaxed text-[var(--app-ink)]">{children}</div>
      </div>
    </div>
  );
}
