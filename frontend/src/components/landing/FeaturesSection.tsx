"use client";

import React, { useState } from "react";
import {
  Package,
  Calculator,
  Brain,
  Zap,
  Link2,
  Bell,
  ArrowRight,
  CheckCircle2,
  Sparkles
} from "lucide-react";

interface FeaturesSectionProps {
  onSelectFeature?: (feature: any) => void;
}

export const FeaturesSection: React.FC<FeaturesSectionProps> = ({ onSelectFeature }) => {
  const [activeFeature, setActiveFeature] = useState<string | null>(null);

  const features = [
    {
      id: "inventory",
      title: "Automated Inventory Engine",
      description:
        "Real-time stock tracking, auto-reordering, supplier sync, and multi-location management.",
      icon: Package,
      details:
        "Multi-warehouse synchronization, dynamic safety stock calculation, automated purchase orders, and supplier API webhooks.",
    },
    {
      id: "accounting",
      title: "Autonomous Accounting Layer",
      description:
        "Live account balances, auto-reconciliation, ledger sync, and financial reporting.",
      icon: Calculator,
      details:
        "Double-entry ledger automation, automatic bank feed matching, invoice reconciliation, and tax calculation.",
    },
    {
      id: "ai-intelligence",
      title: "AI/ML Intelligence Layer",
      description:
        "Demand forecasting, anomaly detection, fraud detection, and natural-language insights.",
      icon: Brain,
      details:
        "Time-series predictive demand models, seasonal trend detection, invoice duplicate flagging, and automated root-cause analysis.",
    },
    {
      id: "automation",
      title: "Background Automation Engine",
      description:
        "Runs jobs 24/7 without a user present (cron/event-driven agents).",
      icon: Zap,
      details:
        "Continuous background agents processing purchase orders, updating stock statuses, and settling end-of-day balances.",
    },
    {
      id: "b2b",
      title: "B2B Integration Layer",
      description:
        "APIs/EDI for supplier-to-business and business-to-business transactions.",
      icon: Link2,
      details:
        "Standardized REST & GraphQL endpoints, EDI 850/855/810 transaction support, and supplier portal access.",
    },
    {
      id: "notifications",
      title: "Notifications & Insights Dashboard",
      description:
        "Balances, mistakes flagged, predictive alerts, and more.",
      icon: Bell,
      details:
        "Customizable alert rules, instant Slack/Email/SMS notifications, and executive summaries.",
    },
  ];

  return (
    <section id="features" className="py-16 sm:py-20 border-t border-slate-100 bg-white">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16">
          {/* ======================================================= */}
          {/* LEFT: Section Headline & Introduction                   */}
          {/* ======================================================= */}
          <div className="lg:col-span-4 space-y-4">
            <div className="text-[11.5px] font-bold tracking-wider text-slate-500 uppercase">
              POWERFUL FEATURES
            </div>

            <h2 className="text-3xl sm:text-4xl font-extrabold text-[#0F172A] tracking-tight leading-[1.15]">
              Everything You Need. <br />
              All in One Platform.
            </h2>

            <p className="text-slate-600 text-[15px] sm:text-base leading-relaxed font-normal pt-1">
              From stock tracking to financial reconciliation, KPM brings your operations together with AI and automation.
            </p>

            <div className="pt-2">
              <a
                href="#features"
                onClick={(e) => {
                  e.preventDefault();
                  document.getElementById("features")?.scrollIntoView({ behavior: "smooth" });
                }}
                className="inline-flex items-center space-x-1.5 text-sm font-bold text-[#0F172A] hover:text-indigo-600 transition-colors group cursor-pointer"
              >
                <span>Explore all features</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </a>
            </div>
          </div>

          {/* ======================================================= */}
          {/* RIGHT: 6 Feature Cards (3 columns x 2 rows)            */}
          {/* ======================================================= */}
          <div className="lg:col-span-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-x-8 gap-y-10">
              {features.map((feature) => {
                const Icon = feature.icon;
                const isSelected = activeFeature === feature.id;
                return (
                  <div
                    key={feature.id}
                    onClick={() => {
                      setActiveFeature(isSelected ? null : feature.id);
                      if (onSelectFeature) onSelectFeature(feature);
                    }}
                    className="group flex flex-col space-y-3 cursor-pointer p-2 -m-2 rounded-2xl hover:bg-slate-50/80 transition-colors"
                  >
                    {/* Icon container matching the screenshot */}
                    <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-center text-slate-800 shadow-xs group-hover:scale-105 group-hover:border-slate-300 transition-all">
                      <Icon className="w-5 h-5 stroke-[1.8]" />
                    </div>

                    {/* Title */}
                    <h3 className="text-[15.5px] font-bold text-[#0F172A] tracking-tight group-hover:text-blue-600 transition-colors leading-snug">
                      {feature.title}
                    </h3>

                    {/* Description */}
                    <p className="text-slate-600 text-[13px] leading-relaxed font-normal">
                      {feature.description}
                    </p>

                    {/* Expandable details when clicked */}
                    {isSelected && (
                      <div className="mt-2 p-3 rounded-xl bg-blue-50/60 border border-blue-100 text-[12px] text-slate-700 animate-in fade-in duration-200">
                        <div className="flex items-center space-x-1 font-semibold text-blue-700 mb-1">
                          <Sparkles className="w-3 h-3" />
                          <span>Key Capabilities:</span>
                        </div>
                        {feature.details}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
