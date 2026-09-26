import React from "react";

export function DataTable({
  children,
  caption,
}: {
  children: React.ReactNode;
  caption?: string;
}) {
  return (
    <div className="overflow-x-auto rounded-[var(--app-radius)] border border-[var(--app-border)] bg-[var(--app-surface)] shadow-[var(--app-shadow-xs)]">
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
      <tr className="sticky top-0 z-10 border-b border-[var(--app-border)] bg-[var(--app-surface)] text-xs font-medium text-[var(--app-muted)]">
        {children}
      </tr>
    </thead>
  );
}

export function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <th className={`px-3 py-2.5 font-medium ${className}`}>{children}</th>;
}

export function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-3 align-middle text-[var(--app-ink)] ${className}`}>{children}</td>;
}
