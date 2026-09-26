"use client";

import React, { useEffect } from "react";
import { themeStore } from "@/lib/themeStore";

/** Keeps the document theme class in sync with themeStore after hydration. */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    return themeStore.subscribe(() => {
      /* DOM already updated inside themeStore; subscription keeps React trees in sync if needed */
    });
  }, []);

  return <>{children}</>;
}
