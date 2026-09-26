"use client";

import React from "react";
import Link from "next/link";
import { Play, Check } from "lucide-react";
import { HeroPortraitSlider } from "./HeroPortraitSlider";

interface HeroSectionProps {
  onOpenDemo: () => void;
  onOrderNowClick: () => void;
  onViewForecastClick: () => void;
  onErrorDetectionClick: () => void;
  onB2BIntegrationClick: () => void;
}

export const HeroSection: React.FC<HeroSectionProps> = ({
  onOpenDemo,
}) => {
  return (
    <section
      id="home"
      className="relative -mt-[72px] scroll-mt-20 overflow-hidden bg-[#0B1220] sm:-mt-20"
    >
      {/* Full-bleed cinematic portrait plane */}
      <div className="absolute inset-0">
        <HeroPortraitSlider fullBleed />
      </div>

      <div className="relative z-10 flex min-h-[min(92vh,880px)] items-end px-4 pb-16 pt-28 sm:px-8 sm:pb-20 lg:items-center lg:px-12 lg:pb-24 lg:pt-24">
        <div className="max-w-[1400px] mx-auto w-full">
          <div className="max-w-xl space-y-6">
            <p className="text-[28px] sm:text-[32px] font-extrabold tracking-tight text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.45)]">
              KPM
            </p>

            <h1 className="text-[36px] sm:text-[48px] lg:text-[52px] font-extrabold tracking-tight text-white leading-[1.05] drop-shadow-[0_2px_18px_rgba(0,0,0,0.5)]">
              AI-Powered Inventory and Accounting for{" "}
              <span className="relative inline-block">
                Businesses
                <svg
                  viewBox="0 0 180 14"
                  className="absolute -bottom-1 left-0 h-3 w-full text-white"
                  aria-hidden
                  preserveAspectRatio="none"
                >
                  <path
                    d="M2 9 C 28 2, 46 13, 78 7 S 140 2, 178 8"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                </svg>
              </span>
            </h1>

            <p className="text-white/85 text-[15px] sm:text-[16.5px] leading-relaxed max-w-[34rem] drop-shadow-[0_1px_10px_rgba(0,0,0,0.45)]">
              KPM automates your inventory, reconciles your accounts, catches errors, and runs 24/7
              with AI — so you can focus on growing your business.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-0.5">
              <Link
                href="/signup"
                className="inline-flex items-center bg-white hover:bg-white/90 text-[#0F172A] text-[14px] font-semibold px-6 py-3.5 rounded-full shadow-[0_8px_20px_-8px_rgba(15,23,42,0.45)] transition-all duration-200 ease-out hover:scale-[1.02]"
              >
                Get Started
              </Link>

              <button
                type="button"
                onClick={onOpenDemo}
                className="inline-flex items-center gap-2 text-[14px] font-semibold text-white px-2 py-3.5 hover:opacity-70 transition-all duration-200 ease-out hover:scale-[1.02] cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Watch Demo</span>
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 pt-1 text-[13px] font-medium text-white/80">
              {["No credit card required", "Quick setup", "Cancel anytime"].map((label) => (
                <div key={label} className="flex items-center gap-1.5">
                  <span className="w-[15px] h-[15px] rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                    <Check className="w-2.5 h-2.5 text-white stroke-[3]" />
                  </span>
                  <span>{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
