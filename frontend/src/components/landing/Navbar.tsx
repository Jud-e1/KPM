"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Search, Menu, X } from "lucide-react";
import { KpmLogoImage } from "@/components/ui/Logo";

interface NavbarProps {
  onOpenSearch: () => void;
}

const navLinks = [
  { name: "Home", href: "#home" },
  { name: "About", href: "#about" },
  { name: "Pricing", href: "#pricing" },
  { name: "Contact", href: "#contact" },
  { name: "Blog", href: "#blog" },
];

export const Navbar: React.FC<NavbarProps> = ({ onOpenSearch }) => {
  const [activeLink, setActiveLink] = useState("Home");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 50);
      const sections = navLinks.map((l) => l.href.replace("#", ""));
      for (let i = sections.length - 1; i >= 0; i--) {
        const el = document.getElementById(sections[i]);
        if (el && el.getBoundingClientRect().top <= 120) {
          setActiveLink(navLinks[i].name);
          break;
        }
      }
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, link: (typeof navLinks)[0]) => {
    e.preventDefault();
    setActiveLink(link.name);
    setMobileMenuOpen(false);
    const id = link.href.replace("#", "");
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    } else if (id === "home") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  return (
    <header
      className={`sticky top-0 z-40 w-full border-b transition-[background-color,box-shadow,backdrop-filter,border-color,color] duration-300 ease-out ${
        scrolled
          ? "border-[var(--app-border)]/70 bg-white/95 text-[#0F172A] shadow-[0_8px_24px_-16px_rgba(15,23,42,0.28)] backdrop-blur-md"
          : "border-transparent bg-transparent text-white shadow-none backdrop-blur-none"
      }`}
    >
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-12 h-[72px] sm:h-20 flex items-center justify-between">
        <div className="flex items-center space-x-3 sm:space-x-4 min-w-0">
          <Link href="/" className="flex items-center flex-shrink-0">
            <KpmLogoImage className={`h-9 w-auto transition-all ${scrolled ? "" : "brightness-0 invert"}`} />
          </Link>

          <div className="hidden md:flex items-center space-x-3 min-w-0">
            <span className={`font-light text-lg ${scrolled ? "text-slate-300" : "text-white/35"}`}>|</span>
            <span
              className={`text-xs sm:text-[13px] font-normal tracking-tight truncate ${
                scrolled ? "text-[var(--app-muted)]" : "text-white/70"
              }`}
            >
              Smarter Inventory. Healthier Finances.
            </span>
          </div>
        </div>

        <nav className="hidden lg:flex items-center space-x-8 xl:space-x-9">
          {navLinks.map((link) => {
            const isActive = activeLink === link.name;
            return (
              <a
                key={link.name}
                href={link.href}
                onClick={(e) => handleNavClick(e, link)}
                className={`relative text-[14px] font-medium transition-colors duration-[250ms] ease py-2 ${
                  scrolled
                    ? isActive
                      ? "text-[#0F172A] font-semibold"
                      : "text-[var(--app-muted)] hover:text-[#0F172A]"
                    : isActive
                      ? "text-white font-semibold"
                      : "text-white/75 hover:text-white"
                }`}
              >
                {link.name}
                <span
                  className={`absolute bottom-0 left-0 right-0 h-[2px] rounded-full transition-opacity ${
                    scrolled ? "bg-[#0F172A]" : "bg-[var(--app-surface)]"
                  } ${isActive ? "opacity-100" : "opacity-0"}`}
                />
              </a>
            );
          })}
        </nav>

        <div className="flex items-center space-x-2 sm:space-x-4">
          <button
            type="button"
            onClick={onOpenSearch}
            className={`p-2 rounded-full transition-all duration-200 ease-out hover:scale-[1.03] cursor-pointer ${
              scrolled
                ? "text-[var(--app-muted)] hover:text-[#0F172A] hover:bg-[var(--app-hover)]"
                : "text-white/80 hover:text-white hover:bg-white/10"
            }`}
            title="Search (⌘K)"
            aria-label="Open search"
          >
            <Search className="w-[18px] h-[18px] stroke-[2.2]" />
          </button>

          <Link
            href="/signin"
            className={`hidden sm:inline text-[14px] font-medium px-2 py-1.5 transition-colors ${
              scrolled ? "text-[var(--app-ink)] hover:text-[#0F172A]" : "text-white/85 hover:text-white"
            }`}
          >
            Login
          </Link>

          <Link
            href="/signup"
            className={`inline-flex items-center rounded-full px-3.5 sm:px-5 py-2 text-[12.5px] sm:text-[13.5px] font-semibold transition-all duration-200 ease-out hover:scale-[1.02] ${
              scrolled
                ? "border border-[#0F172A] text-[#0F172A] hover:bg-[var(--app-hover)]"
                : "border border-white/80 bg-[var(--app-surface)] text-[#0F172A] hover:bg-white/90"
            }`}
          >
            Register
          </Link>

          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className={`lg:hidden p-2 rounded-lg ${
              scrolled ? "text-[var(--app-ink)] hover:text-black" : "text-white hover:text-white/80"
            }`}
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="lg:hidden bg-[var(--app-surface)] border-b border-[var(--app-border)] px-6 py-4 space-y-1 text-[#0F172A]">
          {navLinks.map((link) => (
            <a
              key={link.name}
              href={link.href}
              onClick={(e) => handleNavClick(e, link)}
              className={`block text-base font-medium py-2.5 ${
                activeLink === link.name ? "text-black font-bold" : "text-[var(--app-muted)]"
              }`}
            >
              {link.name}
            </a>
          ))}
          <div className="pt-3 border-t border-[var(--app-border)] flex flex-col gap-2">
            <Link
              href="/signin"
              onClick={() => setMobileMenuOpen(false)}
              className="w-full text-center py-2.5 text-sm font-medium text-[var(--app-ink)] bg-[var(--app-hover)] rounded-xl"
            >
              Login
            </Link>
            <Link
              href="/signup"
              onClick={() => setMobileMenuOpen(false)}
              className="w-full text-center py-2.5 text-sm font-semibold text-[#0F172A] border border-[#0F172A] rounded-full"
            >
              Register
            </Link>
          </div>
        </div>
      )}
    </header>
  );
};
