"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Boxes,
  FileText,
  Sparkles,
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

  const handleSubmit = (e: React.FormEvent) => {
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
    setTimeout(() => {
      setLoading(false);
      setSubmitted(true);
      setTimeout(() => router.push("/dashboard"), 1000);
    }, 700);
  };

  const handleGoogleAuth = () => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setSubmitted(true);
      setTimeout(() => router.push("/dashboard"), 900);
    }, 600);
  };

  const features = [
    { icon: Boxes,    label: "Real-time\nInventory Tracking" },
    { icon: FileText, label: "Automated\nAccounting" },
    { icon: Link2,    label: "B2B Partner\nIntegrations" },
    { icon: Sparkles, label: "AI-Powered\nInsights" },
  ];

  return (
    <div className="min-h-screen bg-[#ECEFF2] py-4 sm:py-8 px-2 sm:px-6 lg:px-10 flex items-center justify-center font-sans antialiased text-[#0F172A]">
      <div className="w-full max-w-[1440px] bg-white rounded-[28px] sm:rounded-[36px] shadow-[0_20px_70px_-15px_rgba(15,23,42,0.08)] border border-slate-200/80 overflow-hidden grid grid-cols-1 lg:grid-cols-12 min-h-[780px]">

        {/* ============================================================ */}
        {/* LEFT: Branding + Feature Pills + Social proof                */}
        {/* ============================================================ */}
        <div className="lg:col-span-7 p-6 sm:p-10 lg:p-12 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-slate-100 bg-white relative overflow-hidden">

          {/* Top bar */}
          <div className="flex items-center justify-between pb-6">
            <Link href="/" className="flex items-center space-x-3 group">
              <div className="flex items-center space-x-2">
                <svg width="32" height="30" viewBox="0 0 32 30" fill="none" className="transform group-hover:scale-105 transition-transform">
                  <path d="M4 3H10V27H4V3Z" fill="#0F172A" />
                  <path d="M11 15L22 3H29L17 16L29 27H22L11 15Z" fill="#0F172A" />
                </svg>
                <div>
                  <span className="font-extrabold text-2xl tracking-tight text-[#0F172A] block leading-none">KPM</span>
                  <span className="text-[10px] font-medium text-slate-400 tracking-tight block mt-0.5">Inventory • Accounting • Growth</span>
                </div>
              </div>
            </Link>

            {/* Switch to Sign Up */}
            <div className="flex items-center space-x-2 text-xs sm:text-[13px]">
              <span className="text-slate-500 hidden sm:inline">Need an account?</span>
              <Link
                href="/signup"
                className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 text-xs font-semibold shadow-sm transition-all cursor-pointer"
              >
                <span>Sign Up</span>
                <ArrowRight className="w-3.5 h-3.5 text-slate-600" />
              </Link>
            </div>
          </div>

          {/* Hero copy */}
          <div className="space-y-4 my-2 z-10">
            <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full border border-indigo-100 bg-[#EEF2FF] text-indigo-700 text-xs font-semibold shadow-sm">
              <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
              <span>Welcome Back</span>
            </div>

            <h1 className="text-[34px] sm:text-[42px] lg:text-[46px] font-extrabold text-[#0F172A] tracking-tight leading-[1.1]">
              Sign In to Your <br />
              KPM Workspace
            </h1>

            <p className="text-slate-600 text-[14px] sm:text-[15px] leading-relaxed max-w-lg font-normal">
              Access your live inventory, auto-reconciled accounts, and AI-powered insights — all in one place.
            </p>

            {/* 4 Feature pills */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
              {features.map(({ icon: Icon, label }) => (
                <div key={label} className="flex items-center space-x-2.5 text-slate-700">
                  <div className="w-9 h-9 rounded-xl bg-[#F8FAFC] border border-slate-200/90 flex items-center justify-center flex-shrink-0 text-slate-800 shadow-sm">
                    <Icon className="w-4 h-4 stroke-[1.8]" />
                  </div>
                  <span className="text-[11.5px] font-semibold text-slate-700 leading-tight whitespace-pre-line">
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
            <div className="absolute bottom-4 left-4 flex items-center space-x-2 bg-white/95 backdrop-blur-sm rounded-xl px-3 py-2 shadow-lg border border-slate-200/80">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span className="text-[11px] font-semibold text-slate-800">All systems running</span>
            </div>
          </div>

          {/* Social proof */}
          <div className="flex items-center space-x-3 mt-5 pt-5 border-t border-slate-100">
            <div className="flex -space-x-2">
              {avatars.map((src, i) => (
                <img key={i} src={src} alt="" className="w-7 h-7 rounded-full ring-2 ring-white object-cover" />
              ))}
            </div>
            <p className="text-[12px] text-slate-500 font-medium">
              Trusted by <span className="font-bold text-slate-800">10,000+</span> businesses worldwide
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
              <h2 className="text-[22px] sm:text-[26px] font-extrabold text-[#0F172A] tracking-tight">
                Welcome back
              </h2>
              <p className="text-[13px] text-slate-500">
                Sign in to continue to your dashboard
              </p>
            </div>

            {submitted ? (
              <div className="py-10 text-center space-y-3">
                <CheckCircle2 className="w-14 h-14 text-emerald-500 mx-auto animate-bounce" />
                <div className="text-base font-bold text-slate-900">Authenticated!</div>
                <p className="text-xs text-slate-500">Redirecting to your workspace...</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Google */}
                <button
                  onClick={handleGoogleAuth}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2.5 py-2.5 rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-medium text-sm transition-colors cursor-pointer shadow-sm disabled:opacity-60"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                  Continue with Google
                </button>

                <div className="relative flex items-center gap-3">
                  <div className="flex-1 h-px bg-slate-200" />
                  <span className="text-[11px] font-medium text-slate-400 flex-shrink-0">or sign in with email</span>
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
                    <label className="block font-semibold text-slate-700 mb-1.5">
                      Business Email <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="email"
                        required
                        placeholder="alex@company.com"
                        value={email}
                        onChange={(e) => { setEmail(e.target.value); setErrorMsg(null); }}
                        onBlur={() => setTouched(t => ({ ...t, email: true }))}
                        className={`w-full pl-9 pr-3 py-2.5 rounded-xl border text-slate-900 placeholder-slate-400 focus:outline-none transition-colors ${
                          touched.email && !validateEmail(email)
                            ? "border-rose-400 bg-rose-50/30"
                            : "border-slate-200 focus:border-slate-800 bg-white"
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
                      <label className="block font-semibold text-slate-700">
                        Password <span className="text-rose-500">*</span>
                      </label>
                      <button
                        type="button"
                        className="text-[11px] text-slate-500 hover:text-slate-800 font-medium cursor-pointer"
                      >
                        Forgot password?
                      </button>
                    </div>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type={showPassword ? "text" : "password"}
                        required
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => { setPassword(e.target.value); setErrorMsg(null); }}
                        onBlur={() => setTouched(t => ({ ...t, password: true }))}
                        className={`w-full pl-9 pr-10 py-2.5 rounded-xl border text-slate-900 placeholder-slate-400 focus:outline-none transition-colors ${
                          touched.password && password.length > 0 && password.length < 6
                            ? "border-rose-400 bg-rose-50/30"
                            : "border-slate-200 focus:border-slate-800 bg-white"
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
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
                      className="w-4 h-4 rounded border-slate-300 accent-slate-900 cursor-pointer"
                    />
                    <label htmlFor="remember" className="text-[12px] text-slate-600 cursor-pointer select-none">
                      Remember me for 30 days
                    </label>
                  </div>

                  {/* Submit */}
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 rounded-full bg-[#0F172A] hover:bg-[#1E293B] text-white font-semibold text-sm shadow-md transition-all cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2 mt-1"
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
                <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400 pt-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Secured with AES-256 encryption • SOC 2 compliant</span>
                </div>
              </div>
            )}

            {/* Switch to signup */}
            <p className="text-center text-xs text-slate-500 pt-2 border-t border-slate-100">
              Don&apos;t have an account?{" "}
              <Link href="/signup" className="font-bold text-slate-900 hover:underline cursor-pointer">
                Start free trial
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
