"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  X,
  Search,
  CheckCircle2,
  AlertCircle,
  Package,
  TrendingUp,
  Sparkles,
  Play,
  ArrowRight,
  ShieldCheck,
  Building,
  Lock,
  Mail,
  User,
  Eye,
  EyeOff,
  ExternalLink,
  ChevronRight,
  AlertTriangle,
} from "lucide-react";
import { createItem } from "@/lib/api";

// ---------------------------------------------------------------
// Shared validation helpers
// ---------------------------------------------------------------
const validateEmail = (email: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

const validatePassword = (pw: string) => pw.length >= 8;

const validateName = (name: string) => name.trim().length >= 2;

// ---------------------------------------------------------------
// 1. Search Command Palette Modal
// ---------------------------------------------------------------
interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SearchModal: React.FC<SearchModalProps> = ({ isOpen, onClose }) => {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const searchItems = [
    { title: "Inventory Overview", category: "Dashboard", desc: "Live stock levels and reorder thresholds" },
    { title: "Autonomous Accounting", category: "Finance", desc: "Double-entry ledger & bank reconciliation" },
    { title: "AI Demand Forecasting", category: "AI Layer", desc: "Predictive inventory forecasting model" },
    { title: "Supplier Webhooks & EDI", category: "Integrations", desc: "B2B partner sync and purchase orders" },
    { title: "Duplicate Invoice Detection", category: "Security", desc: "Anomaly and error detection rules" },
    { title: "Python FastAPI Documentation", category: "API Docs", desc: "OpenAPI endpoints and schemas at /docs" },
  ];

  const filtered = searchItems.filter(
    (item) =>
      query === "" ||
      item.title.toLowerCase().includes(query.toLowerCase()) ||
      item.category.toLowerCase().includes(query.toLowerCase()) ||
      item.desc.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery("");
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-xl rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
        <div className="flex items-center px-4 border-b border-slate-100">
          <Search className="w-5 h-5 text-slate-400 mr-3 flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search features, docs, inventory, ledger..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full py-4 text-sm text-slate-900 placeholder-slate-400 focus:outline-none"
          />
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-700 ml-2">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="max-h-80 overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">
              No matching resources found for &quot;{query}&quot;
            </div>
          ) : (
            filtered.map((item, idx) => (
              <div
                key={idx}
                onClick={onClose}
                className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 cursor-pointer transition-colors group"
              >
                <div>
                  <div className="text-sm font-semibold text-slate-900 group-hover:text-blue-600">
                    {item.title}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">{item.desc}</div>
                </div>
                <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-1 rounded-md ml-3 flex-shrink-0">
                  {item.category}
                </span>
              </div>
            ))
          )}
        </div>
        <div className="bg-slate-50 px-4 py-2 text-[11px] text-slate-500 flex justify-between border-t border-slate-100">
          <span>Press ESC to close</span>
          <span>Navigation • KPM Engine</span>
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------
// 2. Authentication Modal (Login / Signup) — full validation
// ---------------------------------------------------------------
interface AuthModalProps {
  isOpen: boolean;
  mode: "login" | "signup";
  onClose: () => void;
  onSwitchMode: (mode: "login" | "signup") => void;
}

type FieldErrors = {
  name?: string;
  company?: string;
  email?: string;
  password?: string;
  businessType?: string;
};

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, mode, onClose, onSwitchMode }) => {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [businessType, setBusinessType] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  // Reset on mode change
  useEffect(() => {
    setEmail(""); setPassword(""); setName(""); setCompany("");
    setBusinessType(""); setErrors({}); setTouched({});
    setSuccess(false); setLoading(false); setShowPassword(false);
  }, [mode, isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  if (!isOpen) return null;

  const validate = (): FieldErrors => {
    const errs: FieldErrors = {};
    if (mode === "signup") {
      if (!validateName(name)) errs.name = "Full name must be at least 2 characters.";
      if (!company.trim()) errs.company = "Business name is required.";
      if (!businessType) errs.businessType = "Please select a business type.";
    }
    if (!validateEmail(email)) errs.email = "Enter a valid work email address.";
    if (!validatePassword(password)) errs.password = "Password must be at least 8 characters.";
    return errs;
  };

  const handleBlur = (field: string) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    const errs = validate();
    setErrors(errs);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Mark all fields as touched
    const allTouched: Record<string, boolean> = { email: true, password: true };
    if (mode === "signup") {
      allTouched.name = true;
      allTouched.company = true;
      allTouched.businessType = true;
    }
    setTouched(allTouched);

    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        onClose();
        router.push("/dashboard");
      }, 1200);
    }, 700);
  };

  const handleDemoFill = () => {
    setEmail("alex.johnson@acmecorp.com");
    setPassword("SecurePass123");
    setName("Alex Johnson");
    setCompany("Acme Retail Corp");
    setBusinessType("retail");
    setErrors({});
    setTouched({});
  };

  const showError = (field: keyof FieldErrors) =>
    touched[field] && errors[field];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-md rounded-3xl bg-white shadow-2xl border border-slate-200 p-7 relative overflow-y-auto max-h-[90vh]">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-1 text-slate-400 hover:text-slate-700 rounded-full cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="mb-5">
          <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center text-white font-extrabold text-xs mb-3">
            KPM
          </div>
          <h3 className="text-xl font-extrabold text-slate-900 tracking-tight">
            {mode === "signup" ? "Create your KPM account" : "Welcome back to KPM"}
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            {mode === "signup"
              ? "Start your 14-day free trial. No credit card required."
              : "Access your real-time inventory and financial dashboard."}
          </p>
        </div>

        {success ? (
          <div className="py-10 text-center space-y-2">
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto animate-bounce" />
            <div className="text-base font-bold text-slate-900">
              {mode === "signup" ? "Account Initialized!" : "Authenticated Successfully!"}
            </div>
            <p className="text-xs text-slate-500">Redirecting to your workspace...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate className="space-y-3.5 text-xs">
            {/* Google OAuth Button */}
            <button
              type="button"
              onClick={() => {
                setLoading(true);
                setTimeout(() => {
                  setLoading(false);
                  setSuccess(true);
                  setTimeout(() => { setSuccess(false); onClose(); router.push("/dashboard"); }, 1200);
                }, 800);
              }}
              className="w-full flex items-center justify-center gap-2.5 py-2.5 rounded-full border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium text-sm transition-colors cursor-pointer"
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
              <span className="text-[11px] font-medium text-slate-400 flex-shrink-0">or continue with email</span>
              <div className="flex-1 h-px bg-slate-200" />
            </div>

            {/* Full Name — signup only */}
            {mode === "signup" && (
              <div>
                <label className="block font-semibold text-slate-700 mb-1.5">
                  Full Name <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    placeholder="Alex Johnson"
                    value={name}
                    onChange={(e) => { setName(e.target.value); if (touched.name) setErrors(validate()); }}
                    onBlur={() => handleBlur("name")}
                    className={`w-full pl-9 pr-3 py-2.5 rounded-xl border text-slate-900 placeholder-slate-400 focus:outline-none transition-colors ${
                      showError("name")
                        ? "border-rose-400 bg-rose-50/40 focus:border-rose-500"
                        : "border-slate-200 focus:border-slate-800"
                    }`}
                  />
                </div>
                {showError("name") && (
                  <p className="text-[11px] text-rose-500 mt-1 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> {errors.name}
                  </p>
                )}
              </div>
            )}

            {/* Business Email */}
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
                  onChange={(e) => { setEmail(e.target.value); if (touched.email) setErrors(validate()); }}
                  onBlur={() => handleBlur("email")}
                  className={`w-full pl-9 pr-3 py-2.5 rounded-xl border text-slate-900 placeholder-slate-400 focus:outline-none transition-colors ${
                    showError("email")
                      ? "border-rose-400 bg-rose-50/40 focus:border-rose-500"
                      : "border-slate-200 focus:border-slate-800"
                  }`}
                />
              </div>
              {showError("email") && (
                <p className="text-[11px] text-rose-500 mt-1 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> {errors.email}
                </p>
              )}
            </div>

            {/* Password with show/hide toggle */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1.5">
                Password <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  placeholder="Min. 8 characters"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); if (touched.password) setErrors(validate()); }}
                  onBlur={() => handleBlur("password")}
                  className={`w-full pl-9 pr-10 py-2.5 rounded-xl border text-slate-900 placeholder-slate-400 focus:outline-none transition-colors ${
                    showError("password")
                      ? "border-rose-400 bg-rose-50/40 focus:border-rose-500"
                      : "border-slate-200 focus:border-slate-800"
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
              {showError("password") ? (
                <p className="text-[11px] text-rose-500 mt-1 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> {errors.password}
                </p>
              ) : password.length > 0 && (
                <div className="mt-1.5 flex gap-1">
                  {[1,2,3,4].map((i) => (
                    <div
                      key={i}
                      className={`h-1 flex-1 rounded-full transition-all ${
                        password.length >= i * 3
                          ? password.length >= 12 ? "bg-emerald-500"
                            : password.length >= 8 ? "bg-amber-400"
                            : "bg-rose-400"
                          : "bg-slate-200"
                      }`}
                    />
                  ))}
                  <span className="text-[10px] text-slate-400 ml-1">
                    {password.length >= 12 ? "Strong" : password.length >= 8 ? "Good" : "Weak"}
                  </span>
                </div>
              )}
            </div>

            {/* Business Type — signup only */}
            {mode === "signup" && (
              <>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1.5">
                    Company / Business Name <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Building className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      placeholder="Acme Enterprises"
                      value={company}
                      onChange={(e) => { setCompany(e.target.value); if (touched.company) setErrors(validate()); }}
                      onBlur={() => handleBlur("company")}
                      className={`w-full pl-9 pr-3 py-2.5 rounded-xl border text-slate-900 placeholder-slate-400 focus:outline-none transition-colors ${
                        showError("company")
                          ? "border-rose-400 bg-rose-50/40 focus:border-rose-500"
                          : "border-slate-200 focus:border-slate-800"
                      }`}
                    />
                  </div>
                  {showError("company") && (
                    <p className="text-[11px] text-rose-500 mt-1 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> {errors.company}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1.5">
                    Business Type <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={businessType}
                    onChange={(e) => { setBusinessType(e.target.value); if (touched.businessType) setErrors(validate()); }}
                    onBlur={() => handleBlur("businessType")}
                    className={`w-full px-3 py-2.5 rounded-xl border text-slate-900 focus:outline-none transition-colors ${
                      showError("businessType")
                        ? "border-rose-400 bg-rose-50/40 focus:border-rose-500"
                        : businessType ? "border-slate-200 focus:border-slate-800" : "border-slate-200 text-slate-400 focus:border-slate-800"
                    }`}
                  >
                    <option value="" disabled>Select business type...</option>
                    <option value="retail">Retail & E-commerce</option>
                    <option value="wholesale">Wholesale & Distribution</option>
                    <option value="manufacturing">Manufacturing</option>
                    <option value="logistics">Logistics & Freight</option>
                    <option value="saas">SaaS / Technology</option>
                    <option value="other">Other</option>
                  </select>
                  {showError("businessType") && (
                    <p className="text-[11px] text-rose-500 mt-1 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> {errors.businessType}
                    </p>
                  )}
                </div>
              </>
            )}

            {/* Forgot password — login only */}
            {mode === "login" && (
              <div className="flex justify-end -mt-1">
                <button type="button" className="text-[11px] text-slate-500 hover:text-slate-800 font-medium cursor-pointer">
                  Forgot password?
                </button>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-full bg-[#0F172A] hover:bg-[#1E293B] text-white font-semibold text-sm shadow-md transition-all cursor-pointer mt-1 disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  Processing...
                </>
              ) : mode === "signup" ? (
                <>Create Account <ArrowRight className="w-4 h-4" /></>
              ) : (
                "Sign In →"
              )}
            </button>

            {/* Demo Fill Button */}
            <button
              type="button"
              onClick={handleDemoFill}
              className="w-full py-2 rounded-full border border-slate-200 hover:bg-slate-50 text-slate-600 font-medium text-xs transition-colors cursor-pointer"
            >
              ⚡ Fill with Demo Credentials
            </button>

            {/* Terms – signup only */}
            {mode === "signup" && (
              <p className="text-[10.5px] text-slate-400 text-center leading-relaxed">
                By creating an account, you agree to our{" "}
                <span className="underline cursor-pointer hover:text-slate-700">Terms of Service</span>{" "}
                and{" "}
                <span className="underline cursor-pointer hover:text-slate-700">Privacy Policy</span>.
              </p>
            )}
          </form>
        )}

        <div className="mt-5 pt-4 border-t border-slate-100 text-center text-xs text-slate-500">
          {mode === "signup" ? (
            <span>
              Already have an account?{" "}
              <button
                onClick={() => onSwitchMode("login")}
                className="font-bold text-slate-900 hover:underline cursor-pointer"
              >
                Log in
              </button>
            </span>
          ) : (
            <span>
              Don&apos;t have an account?{" "}
              <button
                onClick={() => onSwitchMode("signup")}
                className="font-bold text-slate-900 hover:underline cursor-pointer"
              >
                Start free trial
              </button>
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------
// 3. Watch Demo Video Modal
// ---------------------------------------------------------------
interface DemoVideoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DemoVideoModal: React.FC<DemoVideoModalProps> = ({ isOpen, onClose }) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-3xl rounded-3xl bg-slate-950 text-white shadow-2xl border border-slate-800 overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-slate-800">
          <div className="flex items-center space-x-2">
            <span className="w-3 h-3 rounded-full bg-rose-500" />
            <span className="text-sm font-bold text-slate-200">KPM Product Tour: AI-Powered Autonomous Ops</span>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-white cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Video / Interactive Player Simulation */}
        <div className="relative aspect-video bg-slate-900 flex flex-col items-center justify-center p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-white text-slate-950 flex items-center justify-center shadow-2xl cursor-pointer hover:scale-110 transition-transform mb-4">
            <Play className="w-6 h-6 fill-slate-950 text-slate-950 ml-1" />
          </div>
          <h4 className="text-lg font-bold text-white">Automated Reconciliation & Multi-Warehouse Sync</h4>
          <p className="text-xs text-slate-400 max-w-md mt-1">
            See how KPM detects invoice anomalies, triggers supplier auto-reorders, and settles double-entry ledgers in seconds.
          </p>

          <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-800/80 pt-3">
            <span>Chapter 1: Live Stock Tracking</span>
            <span>Chapter 2: Ledger Auto-Reconcile</span>
            <span>Chapter 3: Anomaly Safeguards</span>
          </div>
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------
// 4. Auto-Reorder Modal (Triggered by Cardboard Box Badge)
// ---------------------------------------------------------------
interface OrderModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const OrderModal: React.FC<OrderModalProps> = ({ isOpen, onClose }) => {
  const [quantity, setQuantity] = useState(50);
  const [supplier, setSupplier] = useState("Acme Logistics Ltd.");
  const [submitting, setSubmitting] = useState(false);
  const [ordered, setOrdered] = useState(false);
  const [qtyError, setQtyError] = useState("");

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  if (!isOpen) return null;

  const handleOrderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (quantity < 10 || quantity > 500) {
      setQtyError("Quantity must be between 10 and 500 units.");
      return;
    }
    setQtyError("");
    setSubmitting(true);
    try {
      await createItem({
        title: `Auto-Reorder: ${quantity} units from ${supplier}`,
        description: `Triggered by stock threshold rule. Supplier batch PO #KPM-${Math.floor(1000 + Math.random() * 9000)}`,
        category: "Inventory",
        status: "active",
      }).catch(() => null);
    } catch {
      // Graceful fallback
    } finally {
      setSubmitting(false);
      setOrdered(true);
      setTimeout(() => {
        setOrdered(false);
        onClose();
      }, 1800);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-md rounded-3xl bg-white shadow-2xl border border-slate-200 p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center space-x-3 mb-4">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
            <Package className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">Auto-Reorder System</h3>
            <p className="text-xs text-slate-500">Stock below safety threshold (15 units remaining)</p>
          </div>
        </div>

        {ordered ? (
          <div className="py-8 text-center space-y-2">
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
            <div className="text-sm font-bold text-slate-900">Purchase Order Dispatched!</div>
            <p className="text-xs text-slate-500">EDI 850 sent to {supplier}. Stock will arrive in 2 business days.</p>
          </div>
        ) : (
          <form onSubmit={handleOrderSubmit} className="space-y-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Item SKU</label>
              <input
                type="text"
                disabled
                value="LAPTOP-PRO-M3 (High Demand)"
                className="w-full px-3 py-2 rounded-xl bg-slate-100 border border-slate-200 text-slate-700 font-mono"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Supplier Partner</label>
              <select
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-slate-800 focus:outline-none focus:border-slate-800"
              >
                <option value="Acme Logistics Ltd.">Acme Logistics Ltd. (Tier 1 Preferred)</option>
                <option value="Global Tech Hardware Inc.">Global Tech Hardware Inc.</option>
                <option value="Apex Direct Distribution">Apex Direct Distribution</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Order Quantity (Units)</label>
              <input
                type="number"
                min="10"
                max="500"
                required
                value={quantity}
                onChange={(e) => {
                  setQuantity(Number(e.target.value));
                  setQtyError("");
                }}
                className={`w-full px-3 py-2 rounded-xl border text-slate-900 focus:outline-none transition-colors ${
                  qtyError ? "border-rose-400 bg-rose-50/30" : "border-slate-200 focus:border-slate-800"
                }`}
              />
              {qtyError && (
                <p className="text-[11px] text-rose-500 mt-1 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> {qtyError}
                </p>
              )}
            </div>

            <div className="p-3 rounded-xl bg-blue-50 border border-blue-100 text-[11.5px] text-blue-800">
              ⚡ <strong>AI Recommendation:</strong> Ordering 50 units covers 34 days of projected velocity at 26% higher seasonal velocity.
            </div>

            <div className="flex justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2 rounded-xl bg-[#0F172A] hover:bg-[#1E293B] text-white font-semibold transition-all cursor-pointer disabled:opacity-60"
              >
                {submitting ? "Sending PO..." : "Confirm & Send PO"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------
// 5. AI Forecast & Intelligence Modal
// ---------------------------------------------------------------
interface ForecastModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ForecastModal: React.FC<ForecastModalProps> = ({ isOpen, onClose }) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-lg rounded-3xl bg-white shadow-2xl border border-slate-200 p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center space-x-3 mb-4">
          <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">AI Demand Forecast Report</h3>
            <p className="text-xs text-slate-500">Machine learning projection for Q3 / Next 30 Days</p>
          </div>
        </div>

        <div className="space-y-4 text-xs">
          <div className="p-3.5 rounded-2xl bg-gradient-to-r from-blue-50 to-indigo-50 border border-indigo-100 flex items-center justify-between">
            <div>
              <div className="text-[11px] font-bold text-indigo-900">Projected Demand Surge</div>
              <div className="text-xl font-extrabold text-indigo-700 mt-0.5">+26.4%</div>
            </div>
            <div className="text-right">
              <div className="text-[11px] text-slate-500">Confidence Score</div>
              <div className="text-sm font-bold text-emerald-600">98.2% Accuracy</div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="font-semibold text-slate-800">Key AI Drivers:</div>
            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex items-start space-x-2">
              <span className="w-2 h-2 rounded-full bg-blue-500 mt-1 flex-shrink-0" />
              <span className="text-slate-600">
                Back-to-school enterprise procurement contracts starting in 14 days.
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex items-start space-x-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 mt-1 flex-shrink-0" />
              <span className="text-slate-600">
                Supplier lead time for lithium batteries increased from 3 days to 7 days.
              </span>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              onClick={onClose}
              className="px-5 py-2.5 rounded-full bg-[#0F172A] text-white font-semibold text-xs hover:bg-[#1E293B] cursor-pointer"
            >
              Close Forecast
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
