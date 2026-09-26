"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Package,
  Calculator,
  BarChart3,
  Zap,
  Link2,
  Bell,
  ArrowRight,
} from "lucide-react";
import { Scribble, WorldMap } from "./LandingStory";
import { staggerClass, staggerStyle, useOnceInView } from "./ScrollReveal";
import { TiltCard } from "./TiltCard";

interface FeaturesSectionProps {
  onSelectFeature?: (featureId: string) => void;
}

const features = [
  {
    id: "inventory",
    title: "Automated Inventory Engine",
    description:
      "Real-time stock tracking, auto-reordering, supplier sync, and multi-location management.",
    icon: Package,
    href: "/inventory",
    details:
      "Multi-warehouse sync, dynamic safety stock, automated POs, and supplier webhooks.",
  },
  {
    id: "accounting",
    title: "Autonomous Accounting Layer",
    description:
      "Live account balances, auto-reconciliation, ledger sync, and financial reporting.",
    icon: Calculator,
    href: "/accounting",
    details:
      "Double-entry automation, bank feed matching, invoice reconciliation, and tax helpers.",
  },
  {
    id: "insights",
    title: "Insights & forecasting",
    description:
      "Demand forecasts, anomaly detection, and natural-language questions on your data.",
    icon: BarChart3,
    href: "/insights",
    details:
      "Forecast series, inventory signals, transaction flags, and assistant answers from live workspace data.",
  },
  {
    id: "automation",
    title: "Background Automation Engine",
    description: "Runs jobs 24/7 without a user present (cron/event-driven agents).",
    icon: Zap,
    href: "/dashboard",
    details:
      "Always-on agents for purchase orders, stock status updates, and end-of-day balances.",
  },
  {
    id: "b2b",
    title: "B2B Integration Layer",
    description: "APIs/EDI for supplier-to-business and business-to-business transactions.",
    icon: Link2,
    href: "/suppliers",
    details: "REST endpoints, EDI 850/855/810 support, and supplier portal access.",
  },
  {
    id: "notifications",
    title: "Notifications & Insights Dashboard",
    description: "Balances, mistakes flagged, predictive alerts, and more.",
    icon: Bell,
    href: "/dashboard",
    details: "Custom alert rules, email/Slack notifications, and executive summaries.",
  },
];

export const FeaturesSection: React.FC<FeaturesSectionProps> = ({ onSelectFeature }) => {
  const [activeFeature, setActiveFeature] = useState<string | null>(null);
  const { ref: gridRef, visible } = useOnceInView<HTMLDivElement>();

  return (
    <section id="features" className="relative overflow-hidden py-16 sm:py-20 bg-[var(--app-surface)] scroll-mt-20">
      <WorldMap className="pointer-events-none absolute inset-x-0 bottom-0 h-64 opacity-60" />
      <div className="relative max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-12">
        <div className="max-w-xl mb-10 space-y-3">
          <Scribble className="h-8 w-16 text-[#0F172A]" />
          <h2 className="text-[32px] sm:text-[36px] font-extrabold text-[#0F172A] tracking-tight leading-[1.15]">
            Everything You Need.
            <br />
            All in One Platform.
          </h2>
          <p className="text-[var(--app-muted)] text-[15px] leading-relaxed">
            From stock tracking to financial reconciliation, KPM brings your operations together
            with AI and automation.
          </p>
        </div>

        <div id="feature-grid" className="scroll-mt-28">
            <div ref={gridRef} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-11">
              {features.map((feature, index) => {
                const Icon = feature.icon;
                const isSelected = activeFeature === feature.id;
                return (
                  <div key={feature.id} className={staggerClass(visible)} style={staggerStyle(index)}>
                  <TiltCard className="h-full" max={4}>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveFeature(isSelected ? null : feature.id);
                      onSelectFeature?.(feature.id);
                    }}
                    className="group flex h-full w-full flex-col items-start text-left space-y-3 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-slate-300 rounded-xl"
                  >
                    <div className="w-11 h-11 rounded-[14px] bg-[#F8FAFC] border border-[var(--app-border)]/90 flex items-center justify-center text-[#0F172A] group-hover:border-[var(--app-border-strong)] group-hover:shadow-sm transition-all">
                      <Icon className="w-[18px] h-[18px] stroke-[1.75]" />
                    </div>

                    <h3 className="text-[15px] font-bold text-[#0F172A] tracking-tight leading-snug">
                      {feature.title}
                    </h3>

                    <p className="text-[var(--app-muted)] text-[13px] leading-relaxed">{feature.description}</p>

                    {isSelected && (
                      <div className="w-full p-3 rounded-xl bg-[var(--app-hover)] border border-[var(--app-border)] text-[12px] text-[var(--app-ink)]">
                        <div className="font-semibold text-[var(--app-ink)] mb-1">Key capabilities</div>
                        <p className="mb-2">{feature.details}</p>
                        <Link
                          href={feature.href}
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1 text-[12px] font-bold text-[#0F172A] hover:underline"
                        >
                          Open in app <ArrowRight className="w-3 h-3" />
                        </Link>
                      </div>
                    )}
                  </button>
                  </TiltCard>
                  </div>
                );
              })}
            </div>
          </div>
      </div>
    </section>
  );
};
