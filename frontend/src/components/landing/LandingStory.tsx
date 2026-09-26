"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, MessageCircle } from "lucide-react";
import { staggerClass, staggerStyle, useOnceInView } from "./ScrollReveal";

const faces = [
  "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=160&h=160&fit=crop&crop=faces",
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=160&h=160&fit=crop&crop=faces",
  "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=160&h=160&fit=crop&crop=faces",
  "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=160&h=160&fit=crop&crop=faces",
  "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=160&h=160&fit=crop&crop=faces",
];

const stats = [
  { value: "10K+", label: "Businesses" },
  { value: "99.9%", label: "Uptime" },
  { value: "50+", label: "Countries" },
  { value: "24/7", label: "Support" },
];

const faqs = [
  {
    q: "What does KPM actually run for my business?",
    a: "Inventory, sales orders, accounting, suppliers, and customers — plus AI insights that read the same live data.",
  },
  {
    q: "Can I start without a credit card?",
    a: "Yes. The Starter plan is free. Upgrade from the pricing section when you want forecasting and multi-location automation.",
  },
  {
    q: "How do I see a product walkthrough?",
    a: "Open the product tour from Resources, or use Watch Demo in the hero. You can also create an account and explore the live dashboard.",
  },
  {
    q: "Where do I get help or API access?",
    a: "The resources section links to the help center, support signup, and the API documentation.",
  },
];

export function Scribble({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 72 36" className={className} aria-hidden>
      <path
        d="M4 22 C 14 6, 22 30, 34 16 S 58 8, 68 20"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <path
        d="M18 28 C 28 22, 36 32, 48 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function StatsBar() {
  const { ref, visible } = useOnceInView<HTMLDivElement>();
  return (
    <section className="border-y border-[var(--app-border)] bg-[#F8FAFC]">
      <div ref={ref} className="mx-auto grid max-w-[1400px] grid-cols-2 gap-6 px-4 py-8 sm:px-8 sm:py-10 lg:grid-cols-4 lg:px-12">
        {stats.map((stat, index) => (
          <div key={stat.label} className={`text-center sm:text-left ${staggerClass(visible)}`} style={staggerStyle(index)}>
            <div className="text-[32px] font-extrabold tracking-tight text-[#0F172A] sm:text-[40px]">
              {stat.value}
            </div>
            <div className="mt-1 text-[13px] font-medium text-[var(--app-muted)]">{stat.label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function WorldMap({ className = "" }: { className?: string }) {
  const dots = [
    [12, 38], [18, 34], [24, 40], [30, 36], [16, 48], [22, 52], [28, 46],
    [42, 32], [48, 28], [54, 34], [60, 30], [46, 40], [52, 44], [58, 38],
    [70, 36], [76, 32], [82, 40], [88, 34], [74, 46], [80, 50], [86, 44],
    [38, 62], [46, 66], [54, 70], [62, 64], [70, 72], [78, 68],
  ];
  const pins = [
    { x: 22, y: 42, face: faces[3] },
    { x: 52, y: 34, face: faces[4] },
    { x: 78, y: 42, face: faces[0] },
  ];

  return (
    <div className={`relative ${className}`} aria-hidden>
      <svg viewBox="0 0 100 80" className="h-full w-full text-slate-300">
        {dots.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r="0.9" fill="currentColor" />
        ))}
      </svg>
      {pins.map((pin) => (
        <div
          key={pin.x}
          className="absolute -translate-x-1/2 -translate-y-full"
          style={{ left: `${pin.x}%`, top: `${pin.y}%` }}
        >
          <img
            src={pin.face}
            alt=""
            className="h-9 w-9 rounded-full object-cover ring-2 ring-white shadow-sm sm:h-11 sm:w-11"
          />
          <span className="mx-auto mt-0.5 block h-2 w-2 rotate-45 bg-[var(--app-surface)] shadow-sm" />
        </div>
      ))}
    </div>
  );
}

export function CommunitySection() {
  const { ref, visible } = useOnceInView<HTMLDivElement>();
  return (
    <section className="relative overflow-hidden px-4 py-16 sm:px-8 lg:px-12">
      <WorldMap className="pointer-events-none absolute inset-x-0 bottom-0 h-56 opacity-70 sm:h-72" />
      <div className="relative grid items-center gap-10 lg:grid-cols-2">
        <div className="max-w-md">
          <h2 className="text-[32px] font-extrabold tracking-tight text-[#0F172A] sm:text-4xl">
            Operators in one workspace.
          </h2>
          <p className="mt-3 text-[15px] leading-relaxed text-[var(--app-muted)]">
            Join 10,000+ businesses already using KPM to keep stock, suppliers, and the ledger in sync.
          </p>
          <Link
            href="/signup"
            className="mt-5 inline-flex items-center rounded-full bg-[#0F172A] px-5 py-2.5 text-[14px] font-semibold text-white hover:bg-[#1E293B] transition-all duration-200 ease-out hover:scale-[1.02]"
          >
            Create an account
          </Link>
        </div>

        <div ref={ref} className="relative mx-auto h-72 w-full max-w-md">
          <img src={faces[0]} alt="" style={staggerStyle(0)} className={`absolute left-[18%] top-6 h-24 w-24 rounded-full object-cover ring-4 ring-white shadow-md ${staggerClass(visible)}`} />
          <img src={faces[1]} alt="" style={staggerStyle(1)} className={`absolute left-[42%] top-0 h-28 w-28 rounded-full object-cover ring-4 ring-white shadow-md ${staggerClass(visible)}`} />
          <img src={faces[2]} alt="" style={staggerStyle(2)} className={`absolute right-[8%] top-10 h-20 w-20 rounded-full object-cover ring-4 ring-white shadow-md ${staggerClass(visible)}`} />
          <img src={faces[3]} alt="" style={staggerStyle(3)} className={`absolute bottom-6 left-[28%] h-16 w-16 rounded-full object-cover ring-4 ring-white shadow-md ${staggerClass(visible)}`} />
          <img src={faces[4]} alt="" style={staggerStyle(4)} className={`absolute bottom-8 right-[22%] h-20 w-20 rounded-full object-cover ring-4 ring-white shadow-md ${staggerClass(visible)}`} />
          <span style={staggerStyle(5)} className={`absolute left-4 top-16 inline-flex items-center gap-1 rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] px-2.5 py-1.5 text-[11px] font-semibold text-[var(--app-ink)] shadow-sm ${staggerClass(visible)}`}>
            <MessageCircle className="h-3.5 w-3.5" />
            In stock
          </span>
          <span style={staggerStyle(6)} className={`absolute right-2 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--app-border)] bg-[var(--app-surface)] text-[11px] font-bold text-[#0F172A] shadow-sm ${staggerClass(visible)}`}>
            in
          </span>
          <span style={staggerStyle(7)} className={`absolute bottom-2 left-6 inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--app-border)] bg-[var(--app-surface)] text-[11px] font-bold text-[#0F172A] shadow-sm ${staggerClass(visible)}`}>
            f
          </span>
        </div>
      </div>
    </section>
  );
}

export function FaqNewsletter() {
  const router = useRouter();
  const [open, setOpen] = useState(0);
  const { ref, visible } = useOnceInView<HTMLDivElement>();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!email.includes("@") || !email.includes(".")) {
      setError("Enter a valid email address.");
      return;
    }
    setError("");
    router.push(`/signup?email=${encodeURIComponent(email.trim())}`);
  };

  return (
    <section id="contact" className="scroll-mt-24 border-t border-[var(--app-border)] px-4 py-16 sm:px-8 lg:px-12">
      <div className="grid gap-12 lg:grid-cols-2">
        <div>
          <Scribble className="mb-3 h-8 w-16 text-[#0F172A]" />
          <h2 className="text-[32px] font-extrabold tracking-tight text-[#0F172A] sm:text-4xl">
            Get product notes.
          </h2>
          <p className="mt-3 max-w-md text-[15px] leading-relaxed text-[var(--app-muted)]">
            Leave your email and we will take you to account setup with it filled in.
          </p>
          <form onSubmit={submit} className="mt-6 flex flex-col gap-3 sm:flex-row">
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Work email"
              aria-label="Email address"
              className="h-12 w-full rounded-full border border-[var(--app-border)] bg-[var(--app-surface)] px-5 text-[14px] text-[#0F172A] outline-none focus:border-slate-400"
            />
            <button
              type="submit"
              className="h-12 shrink-0 rounded-full bg-[#0F172A] px-6 text-[14px] font-semibold text-white hover:bg-[#1E293B] transition-all duration-200 ease-out hover:scale-[1.02]"
            >
              Submit
            </button>
          </form>
          {error && <p className="mt-2 text-[13px] text-rose-700">{error}</p>}
        </div>

        <div>
          <p className="mb-4 text-[15px] font-semibold text-[#0F172A]">Questions teams ask first.</p>
          <div ref={ref} className="divide-y divide-slate-200 border-y border-[var(--app-border)]">
            {faqs.map((item, index) => {
              const isOpen = open === index;
              return (
                <div key={item.q} className={staggerClass(visible)} style={staggerStyle(index)}>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-4 py-4 text-left"
                    aria-expanded={isOpen}
                    onClick={() => setOpen(isOpen ? -1 : index)}
                  >
                    <span className="text-[15px] font-semibold text-[#0F172A]">{item.q}</span>
                    <ChevronDown className={`h-4 w-4 shrink-0 transition-transform duration-200 ease-out ${isOpen ? "rotate-180" : ""}`} />
                  </button>
                  {isOpen && <p className="pb-4 text-[14px] leading-relaxed text-[var(--app-muted)]">{item.a}</p>}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
