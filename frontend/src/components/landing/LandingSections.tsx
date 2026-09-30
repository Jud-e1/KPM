"use client";

import React, { useState } from "react";
import Link from "next/link";
import { KpmLogoImage } from "@/components/ui/Logo";
import { staggerClass, staggerStyle, useOnceInView } from "./ScrollReveal";
import { TiltCard } from "./TiltCard";
import {
  ArrowRight,
  Building2,
  Store,
  Warehouse,
  Check,
  BookOpen,
  FileText,
  LifeBuoy,
  PlayCircle,
  Share2,
  Globe,
  Mail,
} from "lucide-react";

const solutions = [
  {
    title: "Retail & eCommerce",
    description: "Sync stock across channels, auto-fulfill orders, and keep margins healthy.",
    icon: Store,
    href: "/inventory",
  },
  {
    title: "Wholesale & Distribution",
    description: "Manage suppliers, purchase orders, and B2B partner catalogs in one place.",
    icon: Warehouse,
    href: "/suppliers",
  },
  {
    title: "Finance teams",
    description: "Close books faster with live ledgers, reconciliation, and AI error checks.",
    icon: Building2,
    href: "/accounting",
  },
];

const plans = [
  {
    name: "Starter",
    price: "$0",
    period: "forever",
    blurb: "For solo operators testing KPM.",
    features: ["1 location", "Core inventory", "Basic accounting", "Email support"],
    cta: "Start free",
    href: "/signup",
    highlighted: false,
  },
  {
    name: "Growth",
    price: "$49",
    period: "/mo",
    blurb: "For growing teams that need automation.",
    features: ["Multi-location", "AI forecasting", "Auto reorder", "Priority support"],
    cta: "Start free trial",
    href: "/signup",
    highlighted: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "",
    blurb: "For complex ops and dedicated SLAs.",
    features: ["EDI / API", "SSO & roles", "Dedicated CSM", "99.99% SLA"],
    cta: "Talk to sales",
    href: "/signup",
    highlighted: false,
  },
];

type ResourceItem =
  | {
      title: string;
      description: string;
      icon: typeof PlayCircle;
      action: "demo";
    }
  | {
      title: string;
      description: string;
      icon: typeof PlayCircle;
      href: string;
    };

const resources: ResourceItem[] = [
  {
    title: "Product tour",
    description: "Walk through inventory, accounting, and AI insights.",
    icon: PlayCircle,
    action: "demo",
  },
  {
    title: "API documentation",
    description: "Explore FastAPI OpenAPI schemas for integrations.",
    icon: FileText,
    href: "http://localhost:8000/docs",
  },
  {
    title: "Help center",
    description: "Setup guides, FAQs, and best practices for KPM.",
    icon: BookOpen,
    href: "/dashboard",
  },
  {
    title: "Support",
    description: "Reach our team anytime — we respond around the clock.",
    icon: LifeBuoy,
    href: "/signup",
  },
];

interface LandingExtraSectionsProps {
  onOpenDemo: () => void;
}

export const SolutionsSection: React.FC = () => {
  const { ref, visible } = useOnceInView<HTMLDivElement>();
  return (
  <section id="solutions" className="py-16 sm:py-20 bg-[#F8FAFC] border-t border-[var(--app-border)] scroll-mt-20">
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-12">
      <div className="max-w-2xl mb-10">
        <div className="text-[11.5px] font-bold tracking-[0.14em] text-[var(--app-faint)] uppercase mb-3">
          Solutions
        </div>
        <h2 className="text-3xl sm:text-4xl font-extrabold text-[#0F172A] tracking-tight leading-tight">
          Built for how your business actually runs.
        </h2>
        <p className="text-[var(--app-muted)] mt-3 text-[15px] leading-relaxed">
          Whether you sell retail, wholesale, or manage finance ops — KPM adapts to your workflow.
        </p>
      </div>

      <div ref={ref} className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {solutions.map((item, index) => {
          const Icon = item.icon;
          return (
            <div key={item.title} className={staggerClass(visible)} style={staggerStyle(index)}>
            <TiltCard className="h-full">
            <Link
              href={item.href}
              className="group block h-full rounded-2xl border border-[var(--app-border)]/90 bg-[var(--app-surface)] p-6 hover:border-[var(--app-border-strong)] hover:shadow-card-subtle transition-all duration-200 ease-out"
            >
              <div className="w-11 h-11 rounded-xl bg-[var(--app-hover)] border border-[var(--app-border)] flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                <Icon className="w-5 h-5 text-[var(--app-ink)]" />
              </div>
              <h3 className="text-[16px] font-bold text-[#0F172A] mb-1.5">{item.title}</h3>
              <p className="text-[13.5px] text-[var(--app-muted)] leading-relaxed mb-4">{item.description}</p>
              <span className="inline-flex items-center gap-1 text-[13px] font-semibold text-[#0F172A]">
                Explore <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </span>
            </Link>
            </TiltCard>
            </div>
          );
        })}
      </div>
    </div>
  </section>
  );
};

export const PricingSection: React.FC = () => {
  const [billing, setBilling] = useState<"monthly" | "yearly">("monthly");
  const { ref, visible } = useOnceInView<HTMLDivElement>();

  return (
    <section id="pricing" className="py-16 sm:py-20 bg-[var(--app-surface)] border-t border-[var(--app-border)] scroll-mt-20">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-12">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6 mb-10">
          <div className="max-w-xl">
            <div className="text-[11.5px] font-bold tracking-[0.14em] text-[var(--app-faint)] uppercase mb-3">
              Pricing
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-[#0F172A] tracking-tight leading-tight">
              Simple plans that scale with you.
            </h2>
            <p className="text-[var(--app-muted)] mt-3 text-[15px] leading-relaxed">
              Start free. Upgrade when automation and AI start paying for themselves.
            </p>
          </div>

          <div className="inline-flex items-center rounded-full border border-[var(--app-border)] bg-[var(--app-hover)] p-1 self-start">
            {(["monthly", "yearly"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setBilling(mode)}
                className={`px-4 py-1.5 rounded-full text-[13px] font-semibold capitalize transition-colors duration-[250ms] ease cursor-pointer ${
                  billing === mode
                    ? "bg-[#0F172A] text-white shadow-sm"
                    : "text-[var(--app-muted)] hover:text-[var(--app-ink)]"
                }`}
              >
                {mode}
                {mode === "yearly" && (
                  <span className="ml-1.5 text-[10px] font-bold text-emerald-300">-20%</span>
                )}
              </button>
            ))}
          </div>
        </div>

        <div ref={ref} className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {plans.map((plan, index) => {
            const price =
              plan.price === "Custom"
                ? "Custom"
                : plan.price === "$0"
                  ? "$0"
                  : billing === "yearly"
                    ? `$${Math.round(Number(plan.price.replace("$", "")) * 0.8)}`
                    : plan.price;
            const period =
              plan.price === "Custom" ? "" : plan.price === "$0" ? "forever" : billing === "yearly" ? "/mo billed yearly" : "/mo";

            return (
              <div key={plan.name} className={staggerClass(visible)} style={staggerStyle(index)}>
              <TiltCard className="h-full">
              <div
                className={`h-full rounded-2xl border p-6 flex flex-col ${
                  plan.highlighted
                    ? "border-[#0F172A] bg-[#0F172A] text-white shadow-card-elevated scale-[1.02]"
                    : "border-[var(--app-border)] bg-[var(--app-surface)]"
                }`}
              >
                <div className="mb-4">
                  <div
                    className={`text-[13px] font-bold uppercase tracking-wide ${
                      plan.highlighted ? "text-slate-300" : "text-[var(--app-muted)]"
                    }`}
                  >
                    {plan.name}
                  </div>
                  <div className="mt-2 flex items-baseline gap-1">
                    <span className="text-4xl font-extrabold tracking-tight">{price}</span>
                    {period && (
                      <span className={`text-sm ${plan.highlighted ? "text-[var(--app-faint)]" : "text-[var(--app-muted)]"}`}>
                        {period}
                      </span>
                    )}
                  </div>
                  <p className={`mt-2 text-[13.5px] ${plan.highlighted ? "text-slate-300" : "text-[var(--app-muted)]"}`}>
                    {plan.blurb}
                  </p>
                </div>

                <ul className="space-y-2.5 flex-1 mb-6">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-[13.5px]">
                      <Check
                        className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
                          plan.highlighted ? "text-emerald-400" : "text-[var(--app-ink)]"
                        }`}
                      />
                      <span className={plan.highlighted ? "text-slate-200" : "text-[var(--app-ink)]"}>
                        {feature}
                      </span>
                    </li>
                  ))}
                </ul>

                {plan.name === "Growth" ? (
                  <button
                    type="button"
                    onClick={() => {
                      const interval = billing === "yearly" ? "year" : "month";
                      const token = window.localStorage.getItem("kpm_auth_token");
                      if (!token) {
                        window.location.href = `/signup?plan=growth&interval=${interval}`;
                        return;
                      }
                      void import("@/lib/api").then(async ({ startGrowthCheckout }) => {
                        try {
                          window.location.href = await startGrowthCheckout(interval);
                        } catch {
                          window.location.href = "/signup?plan=growth";
                        }
                      });
                    }}
                    className={`inline-flex items-center justify-center gap-2 rounded-full py-3 text-[14px] font-semibold transition-all duration-200 ease-out hover:scale-[1.02] ${
                      plan.highlighted
                        ? "bg-[var(--app-surface)] text-[#0F172A] hover:bg-[var(--app-hover)]"
                        : "bg-[#0F172A] text-white hover:bg-[#1E293B]"
                    }`}
                  >
                    {plan.cta}
                    <ArrowRight className="w-4 h-4" />
                  </button>
                ) : (
                <Link
                  href={plan.href}
                  className={`inline-flex items-center justify-center gap-2 rounded-full py-3 text-[14px] font-semibold transition-all duration-200 ease-out hover:scale-[1.02] ${
                    plan.highlighted
                      ? "bg-[var(--app-surface)] text-[#0F172A] hover:bg-[var(--app-hover)]"
                      : "bg-[#0F172A] text-white hover:bg-[#1E293B]"
                  }`}
                >
                  {plan.cta}
                  <ArrowRight className="w-4 h-4" />
                </Link>
                )}
              </div>
              </TiltCard>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export const ResourcesSection: React.FC<LandingExtraSectionsProps> = ({ onOpenDemo }) => {
  const { ref, visible } = useOnceInView<HTMLDivElement>();
  return (
  <section id="resources" className="py-16 sm:py-20 bg-[#F8FAFC] border-t border-[var(--app-border)] scroll-mt-20">
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-12">
      <div className="max-w-2xl mb-10">
        <div className="text-[11.5px] font-bold tracking-[0.14em] text-[var(--app-faint)] uppercase mb-3">
          Resources
        </div>
        <h2 className="text-3xl sm:text-4xl font-extrabold text-[#0F172A] tracking-tight leading-tight">
          Learn, integrate, and get help fast.
        </h2>
      </div>

      <div ref={ref} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {resources.map((item, index) => {
          const Icon = item.icon;
          const content = (
            <>
              <div className="w-10 h-10 rounded-xl bg-[var(--app-surface)] border border-[var(--app-border)] flex items-center justify-center mb-4">
                <Icon className="w-5 h-5 text-[var(--app-ink)]" />
              </div>
              <h3 className="text-[15px] font-bold text-[#0F172A] mb-1">{item.title}</h3>
              <p className="text-[13px] text-[var(--app-muted)] leading-relaxed">{item.description}</p>
            </>
          );

          if ("action" in item) {
            return (
              <div key={item.title} className={staggerClass(visible)} style={staggerStyle(index)}>
              <TiltCard className="h-full">
              <button
                type="button"
                onClick={onOpenDemo}
                className="h-full w-full text-left rounded-2xl border border-[var(--app-border)]/90 bg-[var(--app-surface)] p-5 hover:border-[var(--app-border-strong)] hover:shadow-card-subtle transition-all duration-200 ease-out cursor-pointer"
              >
                {content}
              </button>
              </TiltCard>
              </div>
            );
          }

          return (
            <div key={item.title} className={staggerClass(visible)} style={staggerStyle(index)}>
            <TiltCard className="h-full">
            <a
              href={item.href}
              target={item.href.startsWith("http") ? "_blank" : undefined}
              rel={item.href.startsWith("http") ? "noreferrer" : undefined}
              className="block h-full rounded-2xl border border-[var(--app-border)]/90 bg-[var(--app-surface)] p-5 hover:border-[var(--app-border-strong)] hover:shadow-card-subtle transition-all duration-200 ease-out"
            >
              {content}
            </a>
            </TiltCard>
            </div>
          );
        })}
      </div>
    </div>
  </section>
  );
};

const footerColumns = [
  {
    title: "Company",
    links: [
      { label: "Home", href: "#home" },
      { label: "About", href: "#about" },
      { label: "Pricing", href: "#pricing" },
      { label: "Blog", href: "#blog" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "Features", href: "#features" },
      { label: "Solutions", href: "#solutions" },
      { label: "API docs", href: "http://localhost:8000/docs" },
      { label: "Help center", href: "/dashboard" },
    ],
  },
  {
    title: "Support",
    links: [
      { label: "Login", href: "/signin" },
      { label: "Register", href: "/signup" },
      { label: "Contact", href: "#contact" },
      { label: "Product tour", href: "#resources" },
    ],
  },
];

export const LandingFooter: React.FC<LandingExtraSectionsProps> = ({ onOpenDemo }) => {
  const { ref, visible } = useOnceInView<HTMLDivElement>();
  return (
  <footer className="rounded-b-[24px] bg-[#0F172A] text-white">
    <div className="mx-auto grid max-w-[1400px] gap-10 px-4 py-12 sm:px-8 lg:grid-cols-12 lg:px-12">
      <div className="lg:col-span-4">
        <div className="inline-flex rounded-xl bg-[var(--app-surface)] px-3 py-2">
          <KpmLogoImage className="h-7 w-auto" />
        </div>
        <p className="mt-4 max-w-xs text-[13px] leading-relaxed text-slate-300">
          Smarter Inventory. Healthier Finances. Inventory, accounting, and AI insights in one workspace.
        </p>
      </div>

      <div ref={ref} className="grid grid-cols-2 gap-8 sm:grid-cols-3 lg:col-span-5">
        {footerColumns.map((column, index) => (
          <div key={column.title} className={staggerClass(visible)} style={staggerStyle(index)}>
            <div className="text-[13px] font-bold">{column.title}</div>
            <ul className="mt-3 space-y-2">
              {column.links.map((link) => (
                <li key={link.label}>
                  {link.label === "Product tour" ? (
                    <button type="button" onClick={onOpenDemo} className="text-[13px] text-slate-300 hover:text-white">
                      {link.label}
                    </button>
                  ) : (
                    <a
                      href={link.href}
                      target={link.href.startsWith("http") ? "_blank" : undefined}
                      rel={link.href.startsWith("http") ? "noreferrer" : undefined}
                      className="text-[13px] text-slate-300 hover:text-white"
                    >
                      {link.label}
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="lg:col-span-3">
        <div className="text-[13px] font-bold">Contact</div>
        <p className="mt-3 text-[13px] leading-relaxed text-slate-300">
          Reach the team from your account, or open the product tour for a walkthrough.
        </p>
        <div className="mt-4 flex gap-2">
          {[
            { label: "Share", href: "/signup", icon: Share2 },
            { label: "Website", href: "#contact", icon: Globe },
            { label: "Email", href: "#contact", icon: Mail },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <a
                key={item.label}
                href={item.href}
                aria-label={item.label}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/20 hover:bg-white/10 transition-transform duration-200 ease-out hover:scale-[1.03]"
              >
                <Icon className="h-4 w-4" />
              </a>
            );
          })}
        </div>
      </div>
    </div>
    <div className="border-t border-white/15 px-4 py-4 text-center text-[12px] text-[var(--app-faint)]">
      © {new Date().getFullYear()} KPM. All rights reserved.
    </div>
  </footer>
  );
};
