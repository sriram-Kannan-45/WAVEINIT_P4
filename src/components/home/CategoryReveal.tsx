"use client";

import { useEffect, useRef } from "react";

interface CategoryRevealProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Wraps a category grid and applies a staggered luxury page-turn entrance
 * to each direct child card as they scroll into the viewport.
 *
 * The initial `.reveal-card` class hides each card with a subtle 3-D tilt.
 * When the card intersects the viewport, `.is-visible` is added with a
 * staggered delay — creating the cinematic "pages turning" catalogue feel.
 */
export function CategoryReveal({ children, className }: CategoryRevealProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const grid = ref.current;
    if (!grid) return;

    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (motion.matches) {
      grid
        .querySelectorAll<HTMLElement>(".reveal-card")
        .forEach((el) => el.classList.add("is-visible"));
      return;
    }

    const cards = Array.from(grid.querySelectorAll<HTMLElement>(".reveal-card"));
    if (cards.length === 0) return;

    const html = document.documentElement;
    const alreadyAnimated =
      html.getAttribute("data-store-animate") === "in" ||
      html.getAttribute("data-store-animate") === "done";
    if (alreadyAnimated) {
      cards.forEach((el) => el.classList.remove("reveal-card"));
      return;
    }

    const STAGGER_MS = 110;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const card = entry.target as HTMLElement;
          const index = cards.indexOf(card);
          setTimeout(() => {
            card.classList.add("is-visible");
          }, index * STAGGER_MS);
          observer.unobserve(card);
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );

    cards.forEach((card) => observer.observe(card));

    const mutObs = new MutationObserver(() => {
      if (
        html.getAttribute("data-store-animate") === "in" ||
        html.getAttribute("data-store-animate") === "done"
      ) {
        cards.forEach((el) => el.classList.remove("reveal-card"));
        observer.disconnect();
        mutObs.disconnect();
      }
    });
    mutObs.observe(html, { attributes: true, attributeFilter: ["data-store-animate"] });

    return () => {
      observer.disconnect();
      mutObs.disconnect();
    };
  }, []);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
