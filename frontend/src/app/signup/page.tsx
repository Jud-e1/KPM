"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Boxes,
  FileText,
  LineChart,
  Link2,
  Lock,
  Mail,
  User,
  Building,
  Eye,
  EyeOff,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  ChevronDown,
  Search,
  Check,
  Package
} from "lucide-react";
import { GoogleSignInButton } from "@/components/GoogleSignInButton";
import { KpmLogoImage } from "@/components/ui/Logo";

export default function SignupPage() {
  const router = useRouter();
  const [authMode, setAuthMode] = useState<"signup" | "signin">("signup");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");

  useEffect(() => {
    const preset = new URLSearchParams(window.location.search).get("email");
    if (preset) setEmail(preset);
  }, []);
  const [password, setPassword] = useState("");
  const [businessType, setBusinessType] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [timeRange, setTimeRange] = useState<"7D" | "30D" | "90D">("30D");

  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const businessTypes = [
    "E-commerce & Online Retail",
    "Wholesale & Distribution",
    "Manufacturing & Assembly",
    "Logistics & Freight",
    "SaaS & Digital Products",
    "Professional Services",
    "Other B2B Enterprise",
  ];

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (authMode === "signup") {
      if (!fullName.trim()) {
        setErrorMsg("Please enter your full name.");
        return;
      }
      if (!businessType) {
        setErrorMsg("Please select your business type.");
        return;
      }
    }

    if (!email.includes("@") || !email.includes(".")) {
      setErrorMsg("Please enter a valid business email address.");
      return;
    }

    if (password.length < 8) {
      setErrorMsg("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);
    try {
      const { signupAccount, signinAccount } = await import("@/lib/api");
      const { authStore } = await import("@/lib/authStore");
      const params = new URLSearchParams(window.location.search);
      const result =
        authMode === "signup"
          ? await signupAccount({
              email: email.trim(),
              password,
              full_name: fullName.trim(),
              organization: fullName.trim(),
              business_type: businessType,
              invite_token: params.get("invite") || undefined,
            })
          : await signinAccount({ email: email.trim(), password });
      authStore.setSession(result.access_token, result.user);
      setSubmitted(true);
      const plan = params.get("plan");
      const interval = params.get("interval") || "month";
      const invite = params.get("invite");
      const next =
        authMode === "signin" && invite
          ? `/invite?token=${encodeURIComponent(invite)}`
          : plan === "growth"
            ? `/settings?checkout=growth&interval=${interval}`
            : "/dashboard";
      setTimeout(() => router.push(next), 700);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Authentication failed");
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
      setTimeout(() => router.push("/dashboard"), 600);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Google sign-in failed");
    } finally {
      setLoading(false);
    }
  };

  const avatars = [
    "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80&h=80&fit=crop&crop=faces",
    "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=80&h=80&fit=crop&crop=faces",
    "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=80&h=80&fit=crop&crop=faces",
    "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=80&h=80&fit=crop&crop=faces",
  ];

  return (
    <div className="min-h-screen bg-[#ECEFF2] py-4 sm:py-8 px-2 sm:px-6 lg:px-10 flex items-center justify-center font-sans antialiased text-[var(--app-ink)]">
      {/* Outer Giant Rounded Card Frame matching the screenshot */}
      <div className="w-full max-w-[1440px] bg-[var(--app-surface)] rounded-[28px] sm:rounded-[36px] shadow-[0_20px_70px_-15px_rgba(15,23,42,0.08)] border border-[var(--app-border)]/80 overflow-hidden grid grid-cols-1 lg:grid-cols-12 min-h-[780px]">
        
        {/* ========================================================= */}
        {/* LEFT COLUMN: Visual Branding, Features & Dashboard Collage */}
        {/* ========================================================= */}
        <div className="lg:col-span-7 p-6 sm:p-10 lg:p-12 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-[var(--app-border)] bg-[#FFFFFF] relative overflow-hidden">
          
          {/* Top Bar inside Left Section */}
          <div className="flex items-center justify-between pb-6">
            {/* KPM Logo with subtitle */}
            <Link href="/" className="group">
              <KpmLogoImage className="h-9 w-auto" />
              <span className="mt-1 block text-[10px] font-medium text-[var(--app-faint)] tracking-tight">
                Inventory • Accounting • Growth
              </span>
            </Link>

            {/* Already have an account? Sign In CTA */}
            <div className="flex items-center space-x-2 text-xs sm:text-[13px]">
              <span className="text-[var(--app-muted)] hidden sm:inline">
                {authMode === "signup" ? "Already have an account?" : "Need an account?"}
              </span>
              <button
                onClick={() => {
                  setAuthMode(authMode === "signup" ? "signin" : "signup");
                  setErrorMsg(null);
                }}
                className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-full border border-[var(--app-border)] bg-[var(--app-surface)] hover:bg-[var(--app-hover)] text-[var(--app-ink)] text-xs font-semibold shadow-2xs transition-all cursor-pointer"
              >
                <span>{authMode === "signup" ? "Sign In" : "Sign Up"}</span>
                <ArrowRight className="w-3.5 h-3.5 text-[var(--app-muted)]" />
              </button>
            </div>
          </div>

          {/* Hero Copy inside Left Section */}
          <div className="space-y-4 my-2 z-10">
            {/* Tag pill */}
            <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full border border-[var(--app-border)] bg-[var(--app-hover)] text-[var(--app-ink)] text-xs font-semibold">
              <span>Built for B2B operations</span>
            </div>

            {/* Headline */}
            <h1 className="text-[34px] sm:text-[42px] lg:text-[46px] font-extrabold text-[var(--app-ink)] tracking-tight leading-[1.1]">
              Automate Your Inventory <br />
              and Accounting
            </h1>

            {/* Subparagraph */}
            <p className="text-[var(--app-muted)] text-[14px] sm:text-[15px] leading-relaxed max-w-lg font-normal">
              KPM gives B2B businesses the power to track stock, reconcile accounts, and catch errors — all with AI. Work smarter, not harder.
            </p>

            {/* 4 Feature Badges Row matching the screenshot */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
              <div className="flex items-center space-x-2.5 text-[var(--app-ink)]">
                <div className="w-9 h-9 rounded-xl bg-[var(--app-hover)] border border-[var(--app-border)]/90 flex items-center justify-center flex-shrink-0 text-[var(--app-ink)] shadow-2xs">
                  <Boxes className="w-4 h-4 stroke-[1.8]" />
                </div>
                <span className="text-[11.5px] font-semibold text-[var(--app-ink)] leading-tight">
                  Real-time <br /> Inventory Tracking
                </span>
              </div>

              <div className="flex items-center space-x-2.5 text-[var(--app-ink)]">
                <div className="w-9 h-9 rounded-xl bg-[var(--app-hover)] border border-[var(--app-border)]/90 flex items-center justify-center flex-shrink-0 text-[var(--app-ink)] shadow-2xs">
                  <FileText className="w-4 h-4 stroke-[1.8]" />
                </div>
                <span className="text-[11.5px] font-semibold text-[var(--app-ink)] leading-tight">
                  Automated <br /> Accounting
                </span>
              </div>

              <div className="flex items-center space-x-2.5 text-[var(--app-ink)]">
                <div className="w-9 h-9 rounded-xl bg-[var(--app-hover)] border border-[var(--app-border)]/90 flex items-center justify-center flex-shrink-0 text-[var(--app-ink)] shadow-2xs">
                  <LineChart className="w-4 h-4 stroke-[1.8]" />
                </div>
                <span className="text-[11.5px] font-semibold text-[var(--app-ink)] leading-tight">
                  Business <br /> Insights
                </span>
              </div>

              <div className="flex items-center space-x-2.5 text-[var(--app-ink)]">
                <div className="w-9 h-9 rounded-xl bg-[var(--app-hover)] border border-[var(--app-border)]/90 flex items-center justify-center flex-shrink-0 text-[var(--app-ink)] shadow-2xs">
                  <Link2 className="w-4 h-4 stroke-[1.8]" />
                </div>
                <span className="text-[11.5px] font-semibold text-[var(--app-ink)] leading-tight">
                  B2B <br /> Integration
                </span>
              </div>
            </div>
          </div>

          {/* Visual Montage Area: Warehouse Photo + Floating Dashboard Mockup */}
          <div className="relative mt-6 mb-4 h-[320px] sm:h-[350px] w-full rounded-2xl overflow-visible flex items-center">
            
            {/* Left Circular Peek Vignette matching screenshot */}
            <div className="absolute -left-6 top-1/2 -translate-y-1/2 w-28 h-28 rounded-full overflow-hidden border-2 border-white shadow-md z-0 hidden sm:block">
              <img
                src="/images/warehouse.jpg"
                alt="Warehouse"
                className="w-full h-full object-cover object-left"
              />
            </div>

            {/* Right-Aligned Warehouse Background Image with Soft Curved Arch */}
            <div className="absolute right-0 top-0 bottom-0 w-[62%] sm:w-[58%] rounded-l-[40px] overflow-hidden border-l border-t border-b border-[var(--app-border)] shadow-inner">
              <img
                src="/images/warehouse.jpg"
                alt="Modern Warehouse with Inventory"
                className="w-full h-full object-cover object-center"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-white/70 via-transparent to-transparent" />
            </div>

            {/* Left/Foreground Floating Dashboard Mockup Card */}
            <div className="relative z-10 w-[88%] sm:w-[78%] bg-[var(--app-surface)]/95 backdrop-blur-md rounded-2xl border border-[var(--app-border)] shadow-[0_15px_40px_-10px_rgba(15,23,42,0.15)] p-3 text-[var(--app-ink)] ml-2 sm:ml-4">
              {/* Mockup Header */}
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-[var(--app-border)] text-[10px]">
                <KpmLogoImage className="h-4 w-auto" />
                <div className="bg-[var(--app-hover)] border border-[var(--app-border)]/60 rounded px-2 py-0.5 text-[9px] text-[var(--app-faint)] w-36 flex items-center gap-1">
                  <Search className="w-2.5 h-2.5" />
                  <span>Search anything...</span>
                </div>
                <div className="flex items-center space-x-1.5 text-[var(--app-faint)]">
                  <Lock className="w-2.5 h-2.5" />
                  <User className="w-2.5 h-2.5" />
                </div>
              </div>

              {/* Mockup Content Grid */}
              <div className="grid grid-cols-12 gap-2 text-[9px]">
                {/* Mini Sidebar */}
                <div className="col-span-3 space-y-1 text-[var(--app-muted)] font-medium pr-1 border-r border-[var(--app-border)]">
                  <div className="rounded bg-[var(--app-hover)] px-1.5 py-1 font-semibold text-[var(--app-ink)]">Dashboard</div>
                  <div className="px-1.5 py-0.5 hover:text-[var(--app-ink)]">Inventory</div>
                  <div className="px-1.5 py-0.5 hover:text-[var(--app-ink)]">Accounting</div>
                  <div className="px-1.5 py-0.5 hover:text-[var(--app-ink)]">Reports</div>
                  <div className="px-1.5 py-0.5 hover:text-[var(--app-ink)]">Settings</div>
                </div>

                {/* Main Mockup Column */}
                <div className="col-span-9 space-y-2">
                  <div className="font-bold text-[11px] text-[var(--app-ink)]">Dashboard</div>

                  {/* 4 Mini Stat Boxes */}
                  <div className="grid grid-cols-4 gap-1.5 text-left">
                    <div className="rounded border border-[var(--app-border)] bg-[var(--app-hover)] p-1">
                      <div className="text-[8px] text-[var(--app-faint)]">Stock value</div>
                      <div className="text-[10px] font-semibold text-[var(--app-ink)]">—</div>
                    </div>
                    <div className="rounded border border-[var(--app-border)] bg-[var(--app-hover)] p-1">
                      <div className="text-[8px] text-[var(--app-faint)]">Books</div>
                      <div className="text-[10px] font-semibold text-[var(--app-ink)]">—</div>
                    </div>
                    <div className="rounded border border-[var(--app-border)] bg-[var(--app-hover)] p-1">
                      <div className="text-[8px] text-[var(--app-faint)]">Orders</div>
                      <div className="text-[10px] font-semibold text-[var(--app-ink)]">—</div>
                    </div>
                    <div className="rounded border border-[var(--app-border)] bg-[var(--app-hover)] p-1">
                      <div className="text-[8px] text-[var(--app-faint)]">Alerts</div>
                      <div className="text-[10px] font-semibold text-[var(--app-ink)]">—</div>
                    </div>
                  </div>

                  {/* Chart + AI Insights Box */}
                  <div className="grid grid-cols-12 gap-1.5">
                    {/* Stock Movement Chart */}
                    <div className="col-span-7 p-1.5 rounded bg-[var(--app-hover)]/70 border border-[var(--app-border)]">
                      <div className="flex items-center justify-between text-[8px] text-[var(--app-muted)] mb-1">
                        <span className="font-bold text-[var(--app-ink)]">Stock Movement</span>
                        <div className="flex space-x-1">
                          {(["7D", "30D", "90D"] as const).map((t) => (
                            <button
                              key={t}
                              onClick={() => setTimeRange(t)}
                              className={`px-1 rounded text-[7px] font-semibold cursor-pointer ${
                                timeRange === t ? "bg-[var(--app-surface)] text-blue-600 shadow-2xs" : "text-[var(--app-faint)]"
                              }`}
                            >
                              {t}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="h-10 w-full relative">
                        <svg className="w-full h-full overflow-visible" viewBox="0 0 140 40">
                          <defs>
                            <linearGradient id="purpleGlow" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#818CF8" stopOpacity="0.3" />
                              <stop offset="100%" stopColor="#818CF8" stopOpacity="0.0" />
                            </linearGradient>
                          </defs>
                          <path
                            d="M 0 30 Q 25 15, 50 25 T 95 18 T 140 10 L 140 40 L 0 40 Z"
                            fill="url(#purpleGlow)"
                          />
                          <path
                            d="M 0 30 Q 25 15, 50 25 T 95 18 T 140 10"
                            fill="none"
                            stroke="#6366F1"
                            strokeWidth="1.5"
                          />
                        </svg>
                      </div>
                    </div>

                    {/* AI Insights Note */}
                    <div className="col-span-5 p-1.5 rounded bg-indigo-50/80 border border-indigo-100/80 flex flex-col justify-between text-[7.5px]">
                      <div>
                        <div className="font-bold text-indigo-900 flex items-center gap-0.5">
                          <LineChart className="w-2 h-2 text-[var(--app-muted)]" /> Insights
                        </div>
                        <p className="text-[var(--app-muted)] mt-0.5 leading-tight">
                          Potential stock shortage detected for 3 SKUs. Consider reordering within 5 days.
                        </p>
                      </div>
                      <div className="text-indigo-600 font-bold flex items-center gap-0.5 cursor-pointer mt-1 hover:underline">
                        <span>View Details</span> <ArrowRight className="w-2 h-2" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Overlapping Floating Badge matching screenshot: Reorder Suggestion */}
              <div className="absolute -bottom-3 -left-3 sm:-left-4 z-20 bg-[var(--app-surface)]/95 backdrop-blur-md rounded-xl p-2.5 shadow-floating-badge border border-[var(--app-border)] flex items-center space-x-2.5 max-w-[280px]">
                <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center flex-shrink-0 text-amber-600">
                  <Package className="w-3.5 h-3.5" />
                </div>
                <div className="text-left flex-1">
                  <div className="text-[10px] font-bold text-[var(--app-ink)] leading-tight">Reorder Suggestion</div>
                  <div className="text-[8.5px] text-[var(--app-muted)] leading-tight mt-0.5">
                    Product X is forecasted to run low in 5 days. Recommended quantity: 200.
                  </div>
                </div>
                <div className="w-5 h-5 rounded-full bg-[var(--app-hover)] flex items-center justify-center flex-shrink-0">
                  <ArrowRight className="w-2.5 h-2.5 text-[var(--app-ink)]" />
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Social Proof Row */}
          <div className="pt-2 flex items-center space-x-3">
            <div className="flex -space-x-2 overflow-hidden">
              {avatars.map((img, idx) => (
                <img
                  key={idx}
                  src={img}
                  alt="Avatar"
                  className="inline-block h-6 w-6 rounded-full ring-2 ring-white object-cover"
                />
              ))}
            </div>
            <p className="text-xs text-[var(--app-muted)]">
              Trusted by <span className="font-bold text-[var(--app-ink)]">10,000+</span> businesses worldwide
            </p>
          </div>
        </div>

        {/* ========================================================= */}
        {/* RIGHT COLUMN: The Signup & Onboarding Form               */}
        {/* ========================================================= */}
        <div className="lg:col-span-5 p-6 sm:p-10 lg:p-12 flex flex-col justify-center bg-[var(--app-surface)]">
          <div className="max-w-md w-full mx-auto space-y-6">
            
            {/* Form Header */}
            <div>
              <div className="inline-block px-3 py-1 rounded-lg bg-[var(--app-hover)] border border-[var(--app-border)]/60 text-xs font-semibold text-[var(--app-ink)] mb-3 shadow-2xs">
                {authMode === "signup" ? "Create Your Account" : "Welcome Back"}
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-[var(--app-ink)] tracking-tight">
                {authMode === "signup" ? "Get Started with KPM" : "Sign In to KPM"}
              </h2>
              <p className="text-xs sm:text-[13.5px] text-[var(--app-muted)] mt-1.5 leading-relaxed font-normal">
                {authMode === "signup"
                  ? "Join thousands of businesses already automating their inventory and accounting."
                  : "Enter your credentials to access your real-time dashboard."}
              </p>
            </div>

            {/* Success Submission State */}
            {submitted ? (
              <div className="py-10 text-center space-y-3 bg-[var(--app-surface)] rounded-2xl border border-emerald-100 p-6 shadow-sm animate-in zoom-in-95 duration-200">
                <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto animate-bounce" />
                <h3 className="text-lg font-bold text-[var(--app-ink)]">
                  {authMode === "signup" ? "Account Created Successfully!" : "Signed In Successfully!"}
                </h3>
                <p className="text-xs text-[var(--app-muted)] max-w-xs mx-auto">
                  Redirecting to your real-time KPM dashboard...
                </p>
                <div className="pt-2">
                  <Link
                    href="/dashboard"
                    className="inline-flex items-center space-x-2 px-6 py-2.5 bg-[var(--app-nav-active-bg)] hover:opacity-90 text-[var(--app-nav-active)] text-xs font-semibold rounded-full shadow-md transition-all"
                  >
                    <span>Open Dashboard</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            ) : (
              /* The Form */
              <form onSubmit={handleFormSubmit} className="space-y-4 text-xs">
                {/* Error Banner */}
                {errorMsg && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium animate-in fade-in duration-150">
                    {errorMsg}
                  </div>
                )}

                {/* Full Name Input (Only on signup) */}
                {authMode === "signup" && (
                  <div>
                    <label className="block font-semibold text-[var(--app-ink)] text-[13px] mb-1.5">Full Name</label>
                    <div className="relative">
                      <User className="w-4 h-4 text-[var(--app-faint)] absolute left-3.5 top-1/2 -translate-y-1/2 stroke-[1.8]" />
                      <input
                        type="text"
                        placeholder="Enter your full name"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        className="w-full pl-10 pr-3.5 py-3 bg-[var(--app-surface)] rounded-xl border border-[var(--app-border)] text-[var(--app-ink)] placeholder-slate-400 focus:outline-none focus:border-slate-800 focus:ring-1 focus:ring-slate-800 transition-all text-xs h-[48px]"
                      />
                    </div>
                  </div>
                )}

                {/* Business Email Input */}
                <div>
                  <label className="block font-semibold text-[var(--app-ink)] text-[13px] mb-1.5">Business Email</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-[var(--app-faint)] absolute left-3.5 top-1/2 -translate-y-1/2 stroke-[1.8]" />
                    <input
                      type="email"
                      placeholder="you@company.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-10 pr-3.5 py-3 bg-[var(--app-surface)] rounded-xl border border-[var(--app-border)] text-[var(--app-ink)] placeholder-slate-400 focus:outline-none focus:border-slate-800 focus:ring-1 focus:ring-slate-800 transition-all text-xs h-[48px]"
                    />
                  </div>
                </div>

                {/* Password Input with Visibility Toggle */}
                <div>
                  <label className="block font-semibold text-[var(--app-ink)] text-[13px] mb-1.5">Password</label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-[var(--app-faint)] absolute left-3.5 top-1/2 -translate-y-1/2 stroke-[1.8]" />
                    <input
                      type={showPassword ? "text" : "password"}
                      placeholder="Create a strong password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-10 pr-10 py-3 bg-[var(--app-surface)] rounded-xl border border-[var(--app-border)] text-[var(--app-ink)] placeholder-slate-400 focus:outline-none focus:border-slate-800 focus:ring-1 focus:ring-slate-800 transition-all text-xs h-[48px]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--app-faint)] hover:text-[var(--app-ink)] cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Business Type Dropdown (Only on signup) */}
                {authMode === "signup" && (
                  <div className="relative">
                    <label className="block font-semibold text-[var(--app-ink)] text-[13px] mb-1.5">Business Type</label>
                    <button
                      type="button"
                      onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                      className="w-full pl-10 pr-3.5 py-3 bg-[var(--app-surface)] rounded-xl border border-[var(--app-border)] text-left text-xs flex items-center justify-between focus:outline-none focus:border-slate-800 transition-all cursor-pointer h-[48px]"
                    >
                      <div className="flex items-center space-x-2">
                        <Building className="w-4 h-4 text-[var(--app-faint)] stroke-[1.8]" />
                        <span className={businessType ? "text-[var(--app-ink)] font-medium" : "text-[var(--app-faint)]"}>
                          {businessType || "Select your business type"}
                        </span>
                      </div>
                      <ChevronDown className="w-4 h-4 text-[var(--app-faint)]" />
                    </button>

                    {/* Dropdown Menu */}
                    {isDropdownOpen && (
                      <div className="absolute top-full left-0 right-0 mt-1 z-30 bg-[var(--app-surface)] rounded-xl border border-[var(--app-border)] shadow-xl py-1 max-h-48 overflow-y-auto animate-in fade-in duration-150">
                        {businessTypes.map((type) => (
                          <div
                            key={type}
                            onClick={() => {
                              setBusinessType(type);
                              setIsDropdownOpen(false);
                            }}
                            className="px-3.5 py-2.5 hover:bg-[var(--app-hover)] text-[var(--app-ink)] hover:text-[var(--app-ink)] text-xs cursor-pointer flex items-center justify-between"
                          >
                            <span>{type}</span>
                            {businessType === type && <Check className="w-3.5 h-3.5 text-blue-600" />}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Submit CTA Button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 rounded-xl bg-[var(--app-nav-active-bg)] hover:opacity-90 text-[var(--app-nav-active)] font-semibold text-xs sm:text-[13.5px] shadow-sm transition-all flex items-center justify-center space-x-2 cursor-pointer mt-2 disabled:opacity-50 h-[48px]"
                >
                  <span>{loading ? "Processing..." : authMode === "signup" ? "Create Account" : "Sign In"}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                {/* Or Divider */}
                <div className="relative flex items-center justify-center my-3">
                  <div className="border-t border-[var(--app-border)] w-full" />
                  <span className="bg-[var(--app-surface)] px-3 text-[11px] text-[var(--app-faint)] uppercase font-medium">
                    or
                  </span>
                  <div className="border-t border-[var(--app-border)] w-full" />
                </div>

                <GoogleSignInButton
                  disabled={loading}
                  onCredential={handleGoogleAuth}
                  onError={setErrorMsg}
                />

                {/* Terms and Privacy Text */}
                <p className="text-[10.5px] text-[var(--app-faint)] text-center leading-relaxed pt-2">
                  By creating an account, you agree to our{" "}
                  <a href="#" className="underline text-[var(--app-muted)] hover:text-[var(--app-ink)]">
                    Terms of Service
                  </a>{" "}
                  and{" "}
                  <a href="#" className="underline text-[var(--app-muted)] hover:text-[var(--app-ink)]">
                    Privacy Policy
                  </a>
                  .
                </p>

                {/* Security Badge */}
                <div className="flex items-center justify-center space-x-1.5 text-[11px] text-[var(--app-muted)] pt-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-[var(--app-muted)]" />
                  <span>Your data is protected and secure</span>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
