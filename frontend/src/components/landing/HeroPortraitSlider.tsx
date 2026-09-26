"use client";

import React, { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import type { HeroSlide } from "./HeroCanvas";

const HeroCanvas = dynamic(() => import("./HeroCanvas").then((mod) => mod.HeroCanvas), {
  ssr: false,
});

const SLIDES: readonly HeroSlide[] = [
  {
    src: "/landing/portraits/hero-tennis.jpg",
    alt: "Tennis player serving on a blue court",
  },
  {
    src: "/landing/portraits/hero-studio.jpg",
    alt: "Portrait in a white cap and orange jacket against a red backdrop",
  },
  {
    src: "/landing/portraits/hero-court.jpg",
    alt: "Portrait holding a teal basketball on a painted court",
  },
  {
    src: "/landing/portraits/hero-street.jpg",
    alt: "Streetwear portrait stepping toward the camera on a city street",
  },
];

const HOLD_MS = 4200;

type HeroPortraitSliderProps = {
  /** Fill the parent frame edge-to-edge (hero plane). */
  fullBleed?: boolean;
  className?: string;
};

export function HeroPortraitSlider({ fullBleed = false, className = "" }: HeroPortraitSliderProps) {
  const [index, setIndex] = useState(0);
  const [allowMotion, setAllowMotion] = useState(false);
  const [webglFailed, setWebglFailed] = useState(false);
  const [sceneReady, setSceneReady] = useState(false);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setAllowMotion(!mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    for (const slide of SLIDES) {
      const img = new window.Image();
      img.src = slide.src;
    }
  }, []);

  useEffect(() => {
    if (paused) return undefined;
    const timer = window.setTimeout(() => {
      setIndex((current) => (current + 1) % SLIDES.length);
    }, HOLD_MS);
    return () => window.clearTimeout(timer);
  }, [index, paused]);

  const goTo = (target: number) => {
    const safe = ((target % SLIDES.length) + SLIDES.length) % SLIDES.length;
    setIndex(safe);
  };

  const current = SLIDES[index];
  const showCanvas = allowMotion && !webglFailed;

  return (
    <div
      className={`hero-portrait-slider relative ${fullBleed ? "h-full w-full" : "mx-auto w-full max-w-[560px]"} ${className}`}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setPaused(false);
        }
      }}
    >
      <div
        className={`relative overflow-hidden bg-[#0B1220] ${
          fullBleed
            ? "h-full w-full rounded-none"
            : "aspect-[4/5] rounded-[28px] shadow-[0_28px_50px_-24px_rgba(15,23,42,0.45)] ring-1 ring-black/5"
        }`}
        role="img"
        aria-roledescription="carousel"
        aria-label={current.alt}
      >
        <img
          src={current.src}
          alt=""
          aria-hidden
          draggable={false}
          className={`absolute inset-0 h-full w-full object-cover object-center transition-opacity duration-700 ${
            showCanvas && sceneReady ? "opacity-0" : "opacity-100"
          }`}
        />

        {showCanvas && (
          <HeroCanvas
            slides={SLIDES}
            activeIndex={index}
            onReady={() => setSceneReady(true)}
            onFail={() => setWebglFailed(true)}
          />
        )}

        <div
          className={`pointer-events-none absolute inset-0 z-10 ${
            fullBleed
              ? "bg-gradient-to-r from-black/60 via-black/25 to-transparent"
              : "bg-gradient-to-t from-black/20 via-transparent to-black/10"
          }`}
          aria-hidden
        />
      </div>

      <div
        className={`flex items-center gap-2 ${
          fullBleed
            ? "absolute bottom-6 left-1/2 z-30 -translate-x-1/2 lg:left-auto lg:right-8 lg:translate-x-0"
            : "mt-4 justify-center"
        }`}
      >
        {SLIDES.map((slide, slideIndex) => (
          <button
            key={slide.src}
            type="button"
            aria-label={`Show portrait ${slideIndex + 1}`}
            aria-current={slideIndex === index ? "true" : undefined}
            onClick={() => goTo(slideIndex)}
            className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer ${
              slideIndex === index
                ? fullBleed
                  ? "w-6 bg-white"
                  : "w-6 bg-[var(--app-ink)]"
                : fullBleed
                  ? "w-1.5 bg-white/45 hover:bg-white/70"
                  : "w-1.5 bg-[var(--app-border-strong)] hover:bg-[var(--app-muted)]"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
