"use client";

import React, { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { authStore } from "@/lib/authStore";
import { bindDomainStores } from "@/lib/domainCaches";
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
        bindDomainStores(user.id);
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
