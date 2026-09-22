"use client";

import React, { useState } from "react";
import { Navbar } from "@/components/landing/Navbar";
import { HeroSection } from "@/components/landing/HeroSection";
import { FeaturesSection } from "@/components/landing/FeaturesSection";
import { TrustBanner } from "@/components/landing/TrustBanner";
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

  const handleOpenAuth = (mode: "login" | "signup") => {
    setAuthModal({ isOpen: true, mode });
  };

  const handleCloseAuth = () => {
    setAuthModal({ ...authModal, isOpen: false });
  };

  const handleSwitchAuthMode = (mode: "login" | "signup") => {
    setAuthModal({ isOpen: true, mode });
  };

  return (
    <div className="min-h-screen bg-[#FBFDFE] text-[#0F172A] flex flex-col selection:bg-[#0F172A] selection:text-white">
      {/* 1. Navigation Bar */}
      <Navbar
        onOpenSearch={() => setIsSearchOpen(true)}
        onOpenAuth={handleOpenAuth}
      />

      {/* Main Landing Page Content */}
      <main className="flex-1 space-y-4 sm:space-y-8">
        {/* 2. Hero Section with 3D Dashboard Mockup & Floating Badges */}
        <HeroSection
          onOpenAuth={handleOpenAuth}
          onOpenDemo={() => setIsDemoOpen(true)}
          onOrderNowClick={() => setIsOrderOpen(true)}
          onViewForecastClick={() => setIsForecastOpen(true)}
          onErrorDetectionClick={() => setIsForecastOpen(true)}
          onB2BIntegrationClick={() => setIsSearchOpen(true)}
        />

        {/* 3. Powerful Features 6-Card Grid */}
        <FeaturesSection
          onSelectFeature={() => setIsSearchOpen(true)}
        />

        {/* 4. Trusted by Businesses Worldwide Banner */}
        <TrustBanner
          onJoinClick={() => handleOpenAuth("signup")}
        />
      </main>

      {/* ======================================================= */}
      {/* Interactive Modals & Command Dialogs                    */}
      {/* ======================================================= */}
      <SearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
      />

      <AuthModal
        isOpen={authModal.isOpen}
        mode={authModal.mode}
        onClose={handleCloseAuth}
        onSwitchMode={handleSwitchAuthMode}
      />

      <DemoVideoModal
        isOpen={isDemoOpen}
        onClose={() => setIsDemoOpen(false)}
      />

      <OrderModal
        isOpen={isOrderOpen}
        onClose={() => setIsOrderOpen(false)}
      />

      <ForecastModal
        isOpen={isForecastOpen}
        onClose={() => setIsForecastOpen(false)}
      />
    </div>
  );
}
