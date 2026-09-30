"use client";

import React, { useState } from "react";
import Link from "next/link";
import { KpmLogoImage } from "@/components/ui/Logo";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const { requestPasswordReset } = await import("@/lib/api");
      await requestPasswordReset(email.trim());
      setMessage("If that email has an account, a reset link is on its way.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send reset email");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#ECEFF2] px-4 py-10 flex items-center justify-center">
      <form onSubmit={onSubmit} className="w-full max-w-md rounded-[28px] border border-[var(--app-border)] bg-[var(--app-surface)] p-8 shadow-sm space-y-4">
        <Link href="/"><KpmLogoImage className="h-9 w-auto" /></Link>
        <h1 className="text-2xl font-extrabold text-[var(--app-ink)]">Reset your password</h1>
        <p className="text-sm text-[var(--app-muted)]">We will email a link that expires in one hour.</p>
        {message && <p className="text-sm text-emerald-700">{message}</p>}
        {error && <p className="text-sm text-rose-700">{error}</p>}
        <input
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@company.com"
          className="w-full rounded-xl border border-[var(--app-border)] px-3 py-3 text-sm"
        />
        <button type="submit" disabled={loading} className="w-full rounded-full bg-[#0F172A] py-3 text-sm font-semibold text-white disabled:opacity-60">
          {loading ? "Sending…" : "Send reset link"}
        </button>
        <Link href="/signin" className="block text-center text-sm font-semibold text-[var(--app-ink)]">Back to sign in</Link>
      </form>
    </div>
  );
}
