"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { KpmLogoImage } from "@/components/ui/Logo";

export default function VerifyEmailPage() {
  const [message, setMessage] = useState("Confirming your email…");
  const [ok, setOk] = useState(false);

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("token") || "";
    if (!token) {
      setMessage("This verification link is missing a token.");
      return;
    }
    void (async () => {
      try {
        const { verifyEmailToken } = await import("@/lib/api");
        await verifyEmailToken(token);
        setOk(true);
        setMessage("Email confirmed. You can keep using KPM.");
      } catch (err) {
        setMessage(err instanceof Error ? err.message : "Could not verify email");
      }
    })();
  }, []);

  return (
    <div className="min-h-screen bg-[#ECEFF2] px-4 py-10 flex items-center justify-center">
      <div className="w-full max-w-md rounded-[28px] border border-[var(--app-border)] bg-[var(--app-surface)] p-8 shadow-sm space-y-4">
        <Link href="/"><KpmLogoImage className="h-9 w-auto" /></Link>
        <h1 className="text-2xl font-extrabold text-[var(--app-ink)]">Email verification</h1>
        <p className={`text-sm ${ok ? "text-emerald-700" : "text-[var(--app-muted)]"}`}>{message}</p>
        <Link href="/dashboard" className="inline-flex rounded-full bg-[#0F172A] px-5 py-2.5 text-sm font-semibold text-white">Open dashboard</Link>
      </div>
    </div>
  );
}
