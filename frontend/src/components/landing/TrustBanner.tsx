"use client";

import React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

interface TrustBannerProps {
  onJoinClick?: () => void;
}

export const TrustBanner: React.FC<TrustBannerProps> = ({ onJoinClick }) => {
  const avatars = [
    "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80&h=80&fit=crop&crop=faces",
    "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=80&h=80&fit=crop&crop=faces",
    "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=80&h=80&fit=crop&crop=faces",
    "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=80&h=80&fit=crop&crop=faces",
  ];

  return (
    <section className="pb-16 sm:pb-24 max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-12">
      <div className="rounded-3xl border border-slate-200/90 bg-white shadow-card-subtle p-6 sm:p-8 lg:p-10 transition-all">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* Left Title */}
          <div className="lg:col-span-4 space-y-1.5 border-b lg:border-b-0 lg:border-r border-slate-100 pb-6 lg:pb-0 lg:pr-8">
            <div className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">
              TRUSTED BY BUSINESSES WORLDWIDE
            </div>
            <h3 className="text-xl sm:text-2xl font-extrabold text-[#0F172A] tracking-tight leading-snug">
              Built for Growth. Trusted by Thousands.
            </h3>
          </div>

          {/* Center Metrics (4 statistics columns) */}
          <div className="lg:col-span-5 grid grid-cols-2 sm:grid-cols-4 gap-4 text-left border-b lg:border-b-0 lg:border-r border-slate-100 pb-6 lg:pb-0 lg:pr-6">
            <div>
              <div className="text-2xl sm:text-[28px] font-extrabold text-[#0F172A] tracking-tight">
                10K+
              </div>
              <div className="text-[12px] font-medium text-slate-500 mt-0.5">Businesses</div>
            </div>

            <div>
              <div className="text-2xl sm:text-[28px] font-extrabold text-[#0F172A] tracking-tight">
                99.9%
              </div>
              <div className="text-[12px] font-medium text-slate-500 mt-0.5">Uptime</div>
            </div>

            <div>
              <div className="text-2xl sm:text-[28px] font-extrabold text-[#0F172A] tracking-tight">
                50+
              </div>
              <div className="text-[12px] font-medium text-slate-500 mt-0.5">Countries</div>
            </div>

            <div>
              <div className="text-2xl sm:text-[28px] font-extrabold text-[#0F172A] tracking-tight">
                24/7
              </div>
              <div className="text-[12px] font-medium text-slate-500 mt-0.5">Support</div>
            </div>
          </div>

          {/* Right: Avatars + CTA */}
          <div className="lg:col-span-3 flex items-center justify-between lg:justify-end space-x-3.5">
            <div className="flex -space-x-2.5 overflow-hidden">
              {avatars.map((img, idx) => (
                <img
                  key={idx}
                  src={img}
                  alt="Customer"
                  className="inline-block h-8 w-8 rounded-full ring-2 ring-white object-cover shadow-xs"
                />
              ))}
            </div>

            <div className="text-left">
              <p className="text-[11.5px] font-medium text-slate-600 leading-tight">
                Join 10,000+ businesses already using KPM.
              </p>
            </div>

            <Link
              href="/signup"
              className="w-9 h-9 rounded-full border border-slate-200 hover:border-slate-300 hover:bg-slate-50 flex items-center justify-center text-slate-700 hover:text-black transition-all cursor-pointer flex-shrink-0 shadow-xs"
              title="Join KPM Community"
            >
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
};
