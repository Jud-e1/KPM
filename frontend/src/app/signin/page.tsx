"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Boxes,
  FileText,
  LineChart,
  Link2,
  Lock,
  Mail,
  Eye,
  EyeOff,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { GoogleSignInButton } from "@/components/GoogleSignInButton";
import { KpmLogoImage } from "@/components/ui/Logo";

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const validateEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

  const avatars = [
    "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80&h=80&fit=crop&crop=faces",
    "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=80&h=80&fit=crop&crop=faces",
    "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=80&h=80&fit=crop&crop=faces",
    "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=80&h=80&fit=crop&crop=faces",
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched({ email: true, password: true });
    setErrorMsg(null);

    if (!validateEmail(email)) {
      setErrorMsg("Please enter a valid email address.");
      return;
    }
    if (password.length < 6) {
      setErrorMsg("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    try {
      const { signinAccount } = await import("@/lib/api");
      const { authStore } = await import("@/lib/authStore");
      const result = await signinAccount({ email: email.trim(), password });
      authStore.setSession(result.access_token, result.user);
      setSubmitted(true);
      const params = new URLSearchParams(window.location.search);
      const next = params.get("next") || "/dashboard";
      setTimeout(() => router.push(next), 600);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = async (idToken: string) => {
    setErrorMsg(null);
    setLoading(true);
    try {
      const { googleAuth } = await import("@/lib/api");
      const { authStore } = await import("@/lib/authStore");
      const result = await googleAuth(idToken);
      authStore.setSession(result.access_token, result.user);
      setSubmitted(true);
      const params = new URLSearchParams(window.location.search);
      const next = params.get("next") || "/dashboard";
      setTimeout(() => router.push(next), 600);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Google sign-in failed");
    } finally {
      setLoading(false);
    }
  };

  const features = [
    { icon: Boxes,    label: "Real-time\nInventory Tracking" },
    { icon: FileText, label: "Automated\nAccounting" },
    { icon: Link2,    label: "B2B Partner\nIntegrations" },
    { icon: LineChart, label: "Business\nInsights" },
  ];

  return (
    <div className="min-h-screen bg-[#ECEFF2] py-4 sm:py-8 px-2 sm:px-6 lg:px-10 flex items-center justify-center font-sans antialiased text-[var(--app-ink)]">
      <div className="w-full max-w-[1440px] bg-[var(--app-surface)] rounded-[28px] sm:rounded-[36px] shadow-[0_20px_70px_-15px_rgba(15,23,42,0.08)] border border-[var(--app-border)]/80 overflow-hidden grid grid-cols-1 lg:grid-cols-12 min-h-[780px]">

        {/* ============================================================ */}
        {/* LEFT: Branding + Feature Pills + Social proof                */}
        {/* ============================================================ */}
        <div className="lg:col-span-7 p-6 sm:p-10 lg:p-12 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-[var(--app-border)] bg-[var(--app-surface)] relative overflow-hidden">

          {/* Top bar */}
          <div className="flex items-center justify-between pb-6">
            <Link href="/" className="group">
              <KpmLogoImage className="h-9 w-auto" />
              <span className="mt-1 block text-[10px] font-medium text-[var(--app-faint)] tracking-tight">Inventory • Accounting • Growth</span>
            </Link>

            {/* Switch to Sign Up */}
            <div className="flex items-center space-x-2 text-xs sm:text-[13px]">
              <span className="text-[var(--app-muted)] hidden sm:inline">Need an account?</span>
              <Link
                href="/signup"
                className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-full border border-[var(--app-border)] bg-[var(--app-surface)] hover:bg-[var(--app-hover)] text-[var(--app-ink)] text-xs font-semibold shadow-sm transition-all cursor-pointer"
              >
                <span>Sign Up</span>
                <ArrowRight className="w-3.5 h-3.5 text-[var(--app-muted)]" />
              </Link>
            </div>
          </div>

          {/* Hero copy */}
          <div className="space-y-4 my-2 z-10">
            <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full border border-[var(--app-border)] bg-[var(--app-hover)] text-[var(--app-ink)] text-xs font-semibold">
              <span>Welcome back</span>
            </div>

            <h1 className="text-[34px] sm:text-[42px] lg:text-[46px] font-extrabold text-[var(--app-ink)] tracking-tight leading-[1.1]">
              Sign In to Your <br />
              KPM Workspace
            </h1>

            <p className="text-[var(--app-muted)] text-[14px] sm:text-[15px] leading-relaxed max-w-lg font-normal">
              Access your live inventory, auto-reconciled accounts, and AI-powered insights — all in one place.
            </p>

            {/* 4 Feature pills */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
              {features.map(({ icon: Icon, label }) => (
                <div key={label} className="flex items-center space-x-2.5 text-[var(--app-ink)]">
                  <div className="w-9 h-9 rounded-xl bg-[var(--app-hover)] border border-[var(--app-border)]/90 flex items-center justify-center flex-shrink-0 text-[var(--app-ink)] shadow-sm">
                    <Icon className="w-4 h-4 stroke-[1.8]" />
                  </div>
                  <span className="text-[11.5px] font-semibold text-[var(--app-ink)] leading-tight whitespace-pre-line">
                    {label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Warehouse image collage */}
          <div className="relative h-48 sm:h-56 mt-4 rounded-2xl overflow-hidden">
            <img
              src="/images/warehouse.jpg"
              alt="KPM Warehouse Operations"
              className="w-full h-full object-cover object-center rounded-2xl"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 via-slate-900/10 to-transparent rounded-2xl" />
            {/* Floating system status badge */}
            <div className="absolute bottom-4 left-4 flex items-center space-x-2 bg-[var(--app-surface)]/95 backdrop-blur-sm rounded-xl px-3 py-2 shadow-lg border border-[var(--app-border)]/80">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span className="text-[11px] font-semibold text-[var(--app-ink)]">All systems running</span>
            </div>
          </div>

          {/* Social proof */}
          <div className="flex items-center space-x-3 mt-5 pt-5 border-t border-[var(--app-border)]">
            <div className="flex -space-x-2">
              {avatars.map((src, i) => (
                <img key={i} src={src} alt="" className="w-7 h-7 rounded-full ring-2 ring-white object-cover" />
              ))}
            </div>
            <p className="text-[12px] text-[var(--app-muted)] font-medium">
              Trusted by <span className="font-bold text-[var(--app-ink)]">10,000+</span> businesses worldwide
            </p>
          </div>
        </div>

        {/* ============================================================ */}
        {/* RIGHT: Sign-In Form                                          */}
        {/* ============================================================ */}
        <div className="lg:col-span-5 flex flex-col justify-center p-6 sm:p-10 lg:p-12 bg-[#FAFBFC]">
          <div className="w-full max-w-sm mx-auto space-y-6">

            {/* Header */}
            <div className="space-y-1">
              <h2 className="text-[22px] sm:text-[26px] font-extrabold text-[var(--app-ink)] tracking-tight">
                Welcome back
              </h2>
              <p className="text-[13px] text-[var(--app-muted)]">
                Sign in to continue to your dashboard
              </p>
            </div>

            {submitted ? (
              <div className="py-10 text-center space-y-3">
                <CheckCircle2 className="w-14 h-14 text-emerald-500 mx-auto animate-bounce" />
                <div className="text-base font-bold text-[var(--app-ink)]">Authenticated!</div>
                <p className="text-xs text-[var(--app-muted)]">Redirecting to your workspace...</p>
              </div>
            ) : (
              <div className="space-y-4">
                <GoogleSignInButton
                  disabled={loading}
                  onCredential={handleGoogleAuth}
                  onError={setErrorMsg}
                />

                <div className="relative flex items-center gap-3">
                  <div className="flex-1 h-px bg-slate-200" />
                  <span className="text-[11px] font-medium text-[var(--app-faint)] flex-shrink-0">or sign in with email</span>
                  <div className="flex-1 h-px bg-slate-200" />
                </div>

                {/* Error message */}
                {errorMsg && (
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                    {errorMsg}
                  </div>
                )}

                <form onSubmit={handleSubmit} noValidate className="space-y-4 text-xs">
                  {/* Email */}
                  <div>
                    <label className="block font-semibold text-[var(--app-ink)] mb-1.5">
                      Business Email <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-[var(--app-faint)] absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="email"
                        required
                        placeholder="alex@company.com"
                        value={email}
                        onChange={(e) => { setEmail(e.target.value); setErrorMsg(null); }}
                        onBlur={() => setTouched(t => ({ ...t, email: true }))}
                        className={`w-full pl-9 pr-3 py-2.5 rounded-xl border text-[var(--app-ink)] placeholder-slate-400 focus:outline-none transition-colors ${
                          touched.email && !validateEmail(email)
                            ? "border-rose-400 bg-rose-50/30"
                            : "border-[var(--app-border)] focus:border-slate-800 bg-[var(--app-surface)]"
                        }`}
                      />
                    </div>
                    {touched.email && !validateEmail(email) && email !== "" && (
                      <p className="text-[11px] text-rose-500 mt-1 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> Enter a valid email address
                      </p>
                    )}
                  </div>

                  {/* Password */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block font-semibold text-[var(--app-ink)]">
                        Password <span className="text-rose-500">*</span>
                      </label>
                      <Link
                        href="/forgot-password"
                        className="text-[11px] text-[var(--app-muted)] hover:text-[var(--app-ink)] font-medium"
                      >
                        Forgot password?
                      </Link>
                    </div>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-[var(--app-faint)] absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type={showPassword ? "text" : "password"}
                        required
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => { setPassword(e.target.value); setErrorMsg(null); }}
                        onBlur={() => setTouched(t => ({ ...t, password: true }))}
                        className={`w-full pl-9 pr-10 py-2.5 rounded-xl border text-[var(--app-ink)] placeholder-slate-400 focus:outline-none transition-colors ${
                          touched.password && password.length > 0 && password.length < 6
                            ? "border-rose-400 bg-rose-50/30"
                            : "border-[var(--app-border)] focus:border-slate-800 bg-[var(--app-surface)]"
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--app-faint)] hover:text-[var(--app-ink)] cursor-pointer"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {touched.password && password.length > 0 && password.length < 6 && (
                      <p className="text-[11px] text-rose-500 mt-1 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> Minimum 6 characters required
                      </p>
                    )}
                  </div>

                  {/* Remember me */}
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="remember"
                      className="w-4 h-4 rounded border-[var(--app-border-strong)] accent-slate-900 cursor-pointer"
                    />
                    <label htmlFor="remember" className="text-[12px] text-[var(--app-muted)] cursor-pointer select-none">
                      Remember me for 30 days
                    </label>
                  </div>

                  {/* Submit */}
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 rounded-full bg-[var(--app-nav-active-bg)] hover:opacity-90 text-[var(--app-nav-active)] font-semibold text-sm shadow-md transition-all cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2 mt-1"
                  >
                    {loading ? (
                      <>
                        <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                        </svg>
                        Signing in...
                      </>
                    ) : (
                      <>Sign In <ArrowRight className="w-4 h-4" /></>
                    )}
                  </button>
                </form>

                {/* Security badge */}
                <div className="flex items-center justify-center gap-1.5 text-[11px] text-[var(--app-faint)] pt-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Secured with AES-256 encryption • SOC 2 compliant</span>
                </div>
              </div>
            )}

            {/* Switch to signup */}
            <p className="text-center text-xs text-[var(--app-muted)] pt-2 border-t border-[var(--app-border)]">
              Don&apos;t have an account?{" "}
              <Link href="/signup" className="font-bold text-[var(--app-ink)] hover:underline cursor-pointer">
                Start free trial
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
