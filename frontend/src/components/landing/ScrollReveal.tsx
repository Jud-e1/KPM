"use client";

import React, { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function bindReveal(targets: Element[], trigger: HTMLElement, stagger: number) {
  if (prefersReducedMotion() || targets.length === 0) return;

  const rect = trigger.getBoundingClientRect();
  const alreadyInView = rect.top < window.innerHeight * 0.85 && rect.bottom > 32;
  if (alreadyInView) return;

  gsap.from(targets, {
    y: stagger > 0 ? 20 : 28,
    autoAlpha: 0,
    duration: 0.75,
    ease: "power2.out",
    stagger,
    scrollTrigger: {
      trigger,
      start: "top 85%",
      once: true,
    },
  });
}

export function useOnceInView<T extends HTMLElement>() {
  const ref = useRef<T>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root || prefersReducedMotion()) return;

    gsap.registerPlugin(ScrollTrigger);
    const ctx = gsap.context(() => {
      const items = Array.from(root.querySelectorAll(":scope > .reveal-item"));
      if (items.length > 0) {
        bindReveal(items, root, 0.08);
      } else {
        bindReveal([root], root, 0);
      }
    }, root);

    ScrollTrigger.refresh();
    return () => ctx.revert();
  }, []);

  return { ref, visible: true };
}

export function staggerClass(_visible?: boolean) {
  return "reveal-item";
}

export function staggerStyle(_index: number): React.CSSProperties {
  return {};
}

export function ScrollReveal({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const { ref } = useOnceInView<HTMLDivElement>();

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
