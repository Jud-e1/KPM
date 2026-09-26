"use client";

import React, { useEffect, useState } from "react";
import { Navbar } from "@/components/landing/Navbar";
import { HeroSection } from "@/components/landing/HeroSection";
import { FeaturesSection } from "@/components/landing/FeaturesSection";
import {
  SolutionsSection,
  PricingSection,
  ResourcesSection,
  LandingFooter,
} from "@/components/landing/LandingSections";
import { ScrollReveal } from "@/components/landing/ScrollReveal";
import {
  CommunitySection,
  FaqNewsletter,
  StatsBar,
} from "@/components/landing/LandingStory";
import {
  SearchModal,
  AuthModal,
  DemoVideoModal,
  OrderModal,
  ForecastModal,
} from "@/components/landing/Modals";

export default function LandingPage() {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [authModal, setAuthModal] = useState<{ isOpen: boolean; mode: "login" | "signup" }>({
    isOpen: false,
    mode: "signup",
  });
  const [isDemoOpen, setIsDemoOpen] = useState(false);
  const [isOrderOpen, setIsOrderOpen] = useState(false);
  const [isForecastOpen, setIsForecastOpen] = useState(false);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const handleCloseAuth = () => {
    setAuthModal((prev) => ({ ...prev, isOpen: false }));
  };

  const handleSwitchAuthMode = (mode: "login" | "signup") => {
    setAuthModal({ isOpen: true, mode });
  };

  return (
    <div className="min-h-screen bg-[#F4F7FB] p-3 text-[#0F172A] selection:bg-[#0F172A] selection:text-white sm:p-4">
      <div className="relative mx-auto min-h-[calc(100vh-1.5rem)] w-full overflow-hidden rounded-[24px] bg-[var(--app-surface)] shadow-[0_24px_60px_-28px_rgba(15,23,42,0.28)] sm:min-h-[calc(100vh-2rem)]">
        <Navbar onOpenSearch={() => setIsSearchOpen(true)} />

        <main>
          <HeroSection
            onOpenDemo={() => setIsDemoOpen(true)}
            onOrderNowClick={() => setIsOrderOpen(true)}
            onViewForecastClick={() => setIsForecastOpen(true)}
            onErrorDetectionClick={() => setIsForecastOpen(true)}
            onB2BIntegrationClick={() => setIsSearchOpen(true)}
          />

          <ScrollReveal>
            <StatsBar />
          </ScrollReveal>

          <div id="about">
            <ScrollReveal>
              <FeaturesSection />
            </ScrollReveal>
            <ScrollReveal>
              <SolutionsSection />
            </ScrollReveal>
          </div>

          <ScrollReveal>
            <CommunitySection />
          </ScrollReveal>

          <ScrollReveal>
            <PricingSection />
          </ScrollReveal>

          <div id="blog">
            <ScrollReveal>
              <ResourcesSection onOpenDemo={() => setIsDemoOpen(true)} />
            </ScrollReveal>
          </div>

          <ScrollReveal>
            <FaqNewsletter />
          </ScrollReveal>
        </main>

        <ScrollReveal>
          <LandingFooter onOpenDemo={() => setIsDemoOpen(true)} />
        </ScrollReveal>
      </div>

      <SearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />

      <AuthModal
        isOpen={authModal.isOpen}
        mode={authModal.mode}
        onClose={handleCloseAuth}
        onSwitchMode={handleSwitchAuthMode}
      />

      <DemoVideoModal isOpen={isDemoOpen} onClose={() => setIsDemoOpen(false)} />

      <OrderModal isOpen={isOrderOpen} onClose={() => setIsOrderOpen(false)} />

      <ForecastModal isOpen={isForecastOpen} onClose={() => setIsForecastOpen(false)} />
    </div>
  );
}
