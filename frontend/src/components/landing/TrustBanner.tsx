"use client";

import React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

export const TrustBanner: React.FC = () => {
  const avatars = [
    "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80&h=80&fit=crop&crop=faces",
    "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=80&h=80&fit=crop&crop=faces",
    "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=80&h=80&fit=crop&crop=faces",
    "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=80&h=80&fit=crop&crop=faces",
  ];

  const stats = [
    { value: "10K+", label: "Businesses" },
    { value: "99.9%", label: "Uptime" },
    { value: "50+", label: "Countries" },
    { value: "24/7", label: "Support" },
  ];

  return (
    <section className="pb-16 sm:pb-20 bg-[var(--app-surface)]">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-12">
        {/* Light gray horizontal bar matching the screenshot */}
        <div className="rounded-[24px] sm:rounded-[28px] bg-[#F1F3F5] px-6 py-7 sm:px-8 sm:py-8 lg:px-10 lg:py-9">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-7 lg:gap-6 items-center">
            <div className="lg:col-span-4 space-y-1.5">
              <p className="text-[10.5px] font-bold tracking-[0.16em] text-[var(--app-faint)] uppercase">
                Trusted by Businesses Worldwide
              </p>
              <h3 className="text-[20px] sm:text-[22px] font-extrabold text-[#0F172A] tracking-tight leading-snug">
                Built for Growth. Trusted by Thousands.
              </h3>
            </div>

            <div className="lg:col-span-5 grid grid-cols-2 sm:grid-cols-4 gap-5 sm:gap-4">
              {stats.map((stat) => (
                <div key={stat.label}>
                  <div className="text-[26px] sm:text-[28px] font-extrabold text-[#0F172A] tracking-tight tabular-nums leading-none">
                    {stat.value}
                  </div>
                  <div className="text-[12px] font-medium text-[var(--app-muted)] mt-1.5">{stat.label}</div>
                </div>
              ))}
            </div>

            <div className="lg:col-span-3 flex items-center gap-3 lg:justify-end">
              <div className="flex -space-x-2.5">
                {avatars.map((img, idx) => (
                  <img
                    key={idx}
                    src={img}
                    alt=""
                    className="h-8 w-8 rounded-full ring-[2.5px] ring-[#F1F3F5] object-cover"
                  />
                ))}
              </div>

              <p className="text-[12px] font-medium text-[var(--app-muted)] leading-snug max-w-[130px]">
                Join 10,000+ businesses already using KPM.
              </p>

              <Link
                href="/signup"
                className="w-9 h-9 rounded-full border border-[var(--app-border-strong)]/80 bg-[var(--app-surface)] hover:bg-[var(--app-hover)] flex items-center justify-center text-[var(--app-ink)] transition-all flex-shrink-0 hover:translate-x-0.5"
                aria-label="Join KPM"
              >
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
