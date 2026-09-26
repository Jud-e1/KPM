"use client";

import React, { useEffect, useRef } from "react";
import VanillaTilt from "vanilla-tilt";

type TiltCardProps = {
  children: React.ReactNode;
  className?: string;
  max?: number;
};

export function TiltCard({ children, className = "", max = 6 }: TiltCardProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (window.matchMedia("(pointer: coarse)").matches) return;

    VanillaTilt.init(el, {
      max,
      speed: 400,
      glare: false,
      gyroscope: false,
      reset: true,
      scale: 1.02,
      perspective: 900,
    });

    return () => {
      (el as unknown as { vanillaTilt?: { destroy: () => void } }).vanillaTilt?.destroy();
    };
  }, [max]);

  return (
    <div ref={ref} className={className} style={{ transformStyle: "preserve-3d" }}>
      {children}
    </div>
  );
}
