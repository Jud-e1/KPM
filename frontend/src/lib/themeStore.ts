"use client";

export type ThemePreference = "system" | "light" | "dark";

const THEME_KEY = "kpm_theme";

type Listener = (theme: ThemePreference, resolved: "light" | "dark") => void;

/** Product UI is light-only (classic white canvas). */
function applyDom() {
  if (typeof document === "undefined") return;
  document.documentElement.classList.remove("dark");
  document.documentElement.dataset.theme = "light";
}

class ThemeStore {
  private theme: ThemePreference = "light";
  private listeners = new Set<Listener>();

  constructor() {
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(THEME_KEY, "light");
      } catch {
        /* ignore */
      }
      applyDom();
    }
  }

  public getTheme(): ThemePreference {
    return "light";
  }

  public getResolved(): "light" | "dark" {
    return "light";
  }

  public setTheme(_theme: ThemePreference) {
    this.theme = "light";
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(THEME_KEY, "light");
      } catch {
        /* ignore */
      }
    }
    applyDom();
    this.emit();
  }

  public subscribe(listener: Listener) {
    this.listeners.add(listener);
    listener("light", "light");
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit() {
    this.listeners.forEach((listener) => listener("light", "light"));
  }
}

export const themeStore = new ThemeStore();
