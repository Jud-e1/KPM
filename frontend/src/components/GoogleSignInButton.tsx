"use client";

import React, { useEffect, useState } from "react";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
          }) => void;
          prompt: () => void;
          renderButton: (
            parent: HTMLElement,
            options: Record<string, string | number | boolean>
          ) => void;
        };
      };
    };
  }
}

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";

let gisScriptPromise: Promise<void> | null = null;

function loadGisScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.google?.accounts?.id) return Promise.resolve();
  if (gisScriptPromise) return gisScriptPromise;
  gisScriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-kpm-gis="1"]');
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Failed to load Google Identity")));
      return;
    }
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.dataset.kpmGis = "1";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Google Identity"));
    document.head.appendChild(script);
  });
  return gisScriptPromise;
}

type GoogleSignInButtonProps = {
  onCredential: (idToken: string) => Promise<void> | void;
  onError?: (message: string) => void;
  disabled?: boolean;
  label?: string;
};

export function isGoogleSignInConfigured() {
  return Boolean(GOOGLE_CLIENT_ID);
}

export function GoogleSignInButton({
  onCredential,
  onError,
  disabled,
  label = "Continue with Google",
}: GoogleSignInButtonProps) {
  const [busy, setBusy] = useState(false);
  const configured = isGoogleSignInConfigured();

  useEffect(() => {
    if (!configured) return;
    void loadGisScript().catch(() => undefined);
  }, [configured]);

  if (!configured) {
    return (
      <p className="text-[11px] text-[var(--app-faint)] text-center">
        Google sign-in is available when <code className="text-[10px]">NEXT_PUBLIC_GOOGLE_CLIENT_ID</code> is set.
      </p>
    );
  }

  const handleClick = async () => {
    if (disabled || busy) return;
    setBusy(true);
    try {
      await loadGisScript();
      if (!window.google?.accounts?.id) {
        throw new Error("Google Identity Services failed to load");
      }
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: async (response) => {
          try {
            if (!response.credential) {
              onError?.("Google did not return a credential");
              return;
            }
            await onCredential(response.credential);
          } catch (err) {
            onError?.(err instanceof Error ? err.message : "Google sign-in failed");
          } finally {
            setBusy(false);
          }
        },
      });
      window.google.accounts.id.prompt();
    } catch (err) {
      onError?.(err instanceof Error ? err.message : "Google sign-in failed");
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={() => void handleClick()}
      disabled={disabled || busy}
      className="w-full flex items-center justify-center gap-2.5 py-2.5 rounded-full border border-[var(--app-border)] bg-[var(--app-surface)] hover:bg-[var(--app-hover)] text-[var(--app-ink)] font-medium text-sm transition-colors cursor-pointer shadow-sm disabled:opacity-60"
    >
      <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden>
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
      </svg>
      {busy ? "Connecting…" : label}
    </button>
  );
}
