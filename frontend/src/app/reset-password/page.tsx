"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { KpmLogoImage } from "@/components/ui/Logo";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const token = new URLSearchParams(window.location.search).get("token") || "";
    setLoading(true);
    setError(null);
    try {
      const { confirmPasswordReset } = await import("@/lib/api");
      await confirmPasswordReset(token, password);
      router.push("/signin");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reset password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#ECEFF2] px-4 py-10 flex items-center justify-center">
      <form onSubmit={onSubmit} className="w-full max-w-md rounded-[28px] border border-[var(--app-border)] bg-[var(--app-surface)] p-8 shadow-sm space-y-4">
        <Link href="/"><KpmLogoImage className="h-9 w-auto" /></Link>
        <h1 className="text-2xl font-extrabold text-[var(--app-ink)]">Choose a new password</h1>
        {error && <p className="text-sm text-rose-700">{error}</p>}
        <input
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="At least 8 characters"
          className="w-full rounded-xl border border-[var(--app-border)] px-3 py-3 text-sm"
        />
        <button type="submit" disabled={loading} className="w-full rounded-full bg-[#0F172A] py-3 text-sm font-semibold text-white disabled:opacity-60">
          {loading ? "Saving…" : "Update password"}
        </button>
      </form>
    </div>
  );
}
