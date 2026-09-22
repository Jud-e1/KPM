"use client";

import React from "react";
import { ArrowRight, Play, Check } from "lucide-react";
import { DashboardMockup } from "./DashboardMockup";

interface HeroSectionProps {
  onOpenAuth: (mode: "login" | "signup") => void;
  onOpenDemo: () => void;
  onOrderNowClick: () => void;
  onViewForecastClick: () => void;
  onErrorDetectionClick: () => void;
  onB2BIntegrationClick: () => void;
}

export const HeroSection: React.FC<HeroSectionProps> = ({
  onOpenAuth,
  onOpenDemo,
  onOrderNowClick,
  onViewForecastClick,
  onErrorDetectionClick,
  onB2BIntegrationClick,
}) => {
  return (
    <section className="relative overflow-hidden pt-8 pb-16 lg:pt-14 lg:pb-24">
      {/* Background Soft Glow / Ambient Gradient matching the screenshot */}
      <div className="absolute top-0 right-0 w-[55%] h-[600px] bg-gradient-to-bl from-slate-200/40 via-blue-50/20 to-transparent -z-10 rounded-bl-[120px] pointer-events-none" />

      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
          {/* ======================================================= */}
          {/* LEFT COLUMN: Hero Copy & Value Proposition              */}
          {/* ======================================================= */}
          <div className="lg:col-span-6 space-y-6 sm:space-y-8 z-10">
            {/* Top Pill Tag */}
            <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full border border-slate-200 bg-white/80 backdrop-blur-sm shadow-xs">
              <span className="w-2 h-2 rounded-full bg-slate-600" />
              <span className="text-[12.5px] font-semibold text-slate-800 tracking-tight">
                B2B SaaS Platform
              </span>
            </div>

            {/* Main Headline - Pixel-Perfect Typography */}
            <h1 className="text-[42px] sm:text-[54px] lg:text-[60px] font-extrabold tracking-tight text-[#0F172A] leading-[1.08]">
              AI-Powered Inventory <br className="hidden sm:inline" />
              & Accounting for Modern <br className="hidden sm:inline" />
              Businesses
            </h1>

            {/* Subparagraph */}
            <p className="text-slate-600 text-base sm:text-[17px] leading-relaxed max-w-xl font-normal">
              KPM automates your inventory, reconciles your accounts, catches errors, and runs 24/7 with AI — so you can focus on growing your business.
            </p>

            {/* CTAs */}
            <div className="flex flex-wrap items-center gap-3.5 pt-1">
              {/* Primary CTA */}
              <button
                onClick={() => onOpenAuth("signup")}
                className="inline-flex items-center space-x-2.5 bg-[#0F172A] hover:bg-[#1E293B] text-white text-[14.5px] font-semibold px-7 py-3.5 rounded-full shadow-md hover:shadow-lg transition-all cursor-pointer group"
              >
                <span>Start Free Trial</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>

              {/* Secondary CTA: Watch Demo */}
              <button
                onClick={onOpenDemo}
                className="inline-flex items-center space-x-2.5 bg-white hover:bg-slate-50 text-[#0F172A] border border-slate-200/90 text-[14.5px] font-semibold px-6 py-3.5 rounded-full shadow-xs hover:shadow-sm transition-all cursor-pointer group"
              >
                <div className="w-4 h-4 flex items-center justify-center">
                  <Play className="w-3.5 h-3.5 fill-[#0F172A] text-[#0F172A]" />
                </div>
                <span>Watch Demo</span>
              </button>
            </div>

            {/* Micro Benefits / Trust Badges */}
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 pt-2 text-[13px] font-medium text-slate-600">
              <div className="flex items-center space-x-1.5">
                <div className="w-4 h-4 rounded-full bg-slate-700 flex items-center justify-center">
                  <Check className="w-2.5 h-2.5 text-white stroke-[3]" />
                </div>
                <span>No credit card required</span>
              </div>

              <div className="flex items-center space-x-1.5">
                <div className="w-4 h-4 rounded-full bg-slate-700 flex items-center justify-center">
                  <Check className="w-2.5 h-2.5 text-white stroke-[3]" />
                </div>
                <span>Quick setup</span>
              </div>

              <div className="flex items-center space-x-1.5">
                <div className="w-4 h-4 rounded-full bg-slate-700 flex items-center justify-center">
                  <Check className="w-2.5 h-2.5 text-white stroke-[3]" />
                </div>
                <span>Cancel anytime</span>
              </div>
            </div>
          </div>

          {/* ======================================================= */}
          {/* RIGHT COLUMN: Interactive 3D Mockup & Floating Badges   */}
          {/* ======================================================= */}
          <div className="lg:col-span-6 relative mt-6 lg:mt-0">
            <DashboardMockup
              onOrderNowClick={onOrderNowClick}
              onViewForecastClick={onViewForecastClick}
              onErrorDetectionClick={onErrorDetectionClick}
              onB2BIntegrationClick={onB2BIntegrationClick}
            />
          </div>
        </div>
      </div>
    </section>
  );
};
