"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { KpmLogoImage } from "@/components/ui/Logo";

export default function InvitePage() {
  const router = useRouter();
  const [message, setMessage] = useState("Checking your invite…");

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("token") || "";
    if (!token) {
      setMessage("This invite link is missing a token.");
      return;
    }
    const session = window.localStorage.getItem("kpm_auth_token");
    if (!session) {
      router.replace(`/signup?invite=${encodeURIComponent(token)}`);
      return;
    }
    void (async () => {
      try {
        const { acceptTeamInvite } = await import("@/lib/api");
        await acceptTeamInvite(token);
        setMessage("You joined the workspace.");
        window.setTimeout(() => router.push("/dashboard"), 600);
      } catch (err) {
        setMessage(err instanceof Error ? err.message : "Could not accept invite");
      }
    })();
  }, [router]);

  return (
    <div className="min-h-screen bg-[#ECEFF2] px-4 py-10 flex items-center justify-center">
      <div className="w-full max-w-md rounded-[28px] border border-[var(--app-border)] bg-[var(--app-surface)] p-8 shadow-sm space-y-4">
        <Link href="/"><KpmLogoImage className="h-9 w-auto" /></Link>
        <h1 className="text-2xl font-extrabold text-[var(--app-ink)]">Team invite</h1>
        <p className="text-sm text-[var(--app-muted)]">{message}</p>
      </div>
    </div>
  );
}
