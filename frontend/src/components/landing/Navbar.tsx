"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, ArrowRight, Menu, X } from "lucide-react";

interface NavbarProps {
  onOpenSearch: () => void;
  onOpenAuth: (mode: "login" | "signup") => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onOpenSearch, onOpenAuth }) => {
  const [activeLink, setActiveLink] = useState("Home");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navLinks = [
    { name: "Home", href: "/" },
    { name: "Features", href: "#features" },
    { name: "Solutions", href: "#features" },
    { name: "Pricing", href: "#features" },
    { name: "Resources", href: "#features" },
  ];

  return (
    <header className="sticky top-0 z-40 w-full bg-white/95 backdrop-blur-md border-b border-slate-100 transition-all">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-12 h-20 flex items-center justify-between">
        {/* Left: Brand Logo & Slogan */}
        <div className="flex items-center space-x-3 sm:space-x-4">
          <Link href="/" className="flex items-center space-x-2.5 group">
            {/* Exact Stylized Geometric KPM Logo Mark */}
            <div className="flex items-center gap-1">
              <svg
                width="30"
                height="28"
                viewBox="0 0 32 30"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="transform group-hover:scale-105 transition-transform"
              >
                <path
                  d="M4 3H10V27H4V3Z"
                  fill="#0F172A"
                />
                <path
                  d="M11 15L22 3H29L17 16L29 27H22L11 15Z"
                  fill="#0F172A"
                />
              </svg>
              <span className="font-extrabold text-2xl tracking-tight text-[#0F172A]">
                KPM
              </span>
            </div>
          </Link>

          {/* Separator and Tagline */}
          <div className="hidden md:flex items-center space-x-3">
            <span className="text-slate-300 font-light text-lg">|</span>
            <span className="text-xs sm:text-[13px] text-slate-500 font-normal tracking-tight">
              Smarter Inventory, Healthier Finances.
            </span>
          </div>
        </div>

        {/* Center: Navigation Links */}
        <nav className="hidden lg:flex items-center space-x-9">
          {navLinks.map((link) => {
            const isActive = activeLink === link.name;
            return (
              <a
                key={link.name}
                href={link.href}
                onClick={(e) => {
                  if (link.href.startsWith("#")) {
                    setActiveLink(link.name);
                  }
                }}
                className={`relative text-[14px] font-medium transition-colors py-2 ${
                  isActive
                    ? "text-[#0F172A] font-semibold"
                    : "text-slate-600 hover:text-[#0F172A]"
                }`}
              >
                {link.name}
                {isActive && (
                  <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#0F172A] rounded-full" />
                )}
              </a>
            );
          })}
        </nav>

        {/* Right: Actions */}
        <div className="flex items-center space-x-3 sm:space-x-5">
          {/* Search Trigger */}
          <button
            onClick={onOpenSearch}
            className="p-2 text-slate-600 hover:text-[#0F172A] hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
            title="Search (⌘K)"
          >
            <Search className="w-[18px] h-[18px] stroke-[2.2]" />
          </button>

          {/* Log in — goes to /signin */}
          <Link
            href="/signin"
            className="text-[14px] font-medium text-slate-700 hover:text-[#0F172A] px-2 py-1.5 transition-colors cursor-pointer"
          >
            Log in
          </Link>

          {/* Get Started Free — goes to /signup */}
          <Link
            href="/signup"
            className="inline-flex items-center space-x-2 bg-[#0F172A] hover:bg-[#1E293B] text-white text-[13.5px] font-semibold px-5 py-2.5 rounded-full shadow-sm hover:shadow transition-all cursor-pointer group"
          >
            <span>Get Started Free</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </Link>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-2 text-slate-700 hover:text-black rounded-lg"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-white border-b border-slate-200 px-6 py-4 space-y-3 animate-in slide-in-from-top-2">
          {navLinks.map((link) => (
            <a
              key={link.name}
              href={link.href}
              onClick={() => {
                setActiveLink(link.name);
                setMobileMenuOpen(false);
              }}
              className={`block text-base font-medium py-2 ${
                activeLink === link.name ? "text-black font-bold" : "text-slate-600"
              }`}
            >
              {link.name}
            </a>
          ))}
          <div className="pt-3 border-t border-slate-100 flex flex-col gap-2">
            <Link
              href="/signin"
              onClick={() => setMobileMenuOpen(false)}
              className="w-full text-center py-2 text-sm font-medium text-slate-700 bg-slate-50 rounded-xl"
            >
              Log in
            </Link>
            <Link
              href="/signup"
              onClick={() => setMobileMenuOpen(false)}
              className="w-full text-center py-2.5 text-sm font-semibold text-white bg-[#0F172A] rounded-full"
            >
              Get Started Free
            </Link>
          </div>
        </div>
      )}
    </header>
  );
};
