"use client";

import { useEffect, useRef, type ComponentPropsWithoutRef } from "react";

/** One viewport-driven queue owns card entrances, including after skipping the
 * intro. Unseen rows keep their entrance until they actually enter the view. */
export function CategoryReveal({
  children,
  ...props
}: ComponentPropsWithoutRef<"div">) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const grid = ref.current;
    if (!grid) return;
    const cards = Array.from(
      grid.querySelectorAll<HTMLElement>(".reveal-card"),
    );
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    const intro = document.querySelector<HTMLElement>(".intro-scroll");
    const visible = new Set<HTMLElement>();
    const revealed = new Set<HTMLElement>();
    let timer = 0;
    const storeReady = () =>
      motion.matches ||
      (!intro && !document.documentElement.hasAttribute("data-mobile-intro")) ||
      (intro ? intro.dataset.active === "false" : true);
    const reveal = (card: HTMLElement) => {
      revealed.add(card);
      card.classList.add("is-visible");
      card.removeAttribute("data-reveal-pending");
    };
    const drain = () => {
      timer = 0;
      if (!storeReady()) return;
      const next = cards.find(
        (card) => visible.has(card) && !revealed.has(card),
      );
      if (!next) return;
      reveal(next);
      timer = window.setTimeout(drain, 160);
    };
    const wake = () => {
      if (!timer) drain();
    };
    const preference = () => {
      if (!motion.matches) return;
      clearTimeout(timer);
      timer = 0;
      cards.forEach(reveal);
    };
    cards.forEach((card) => {
      if (motion.matches) reveal(card);
      else card.setAttribute("data-reveal-pending", "");
    });
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const card = entry.target as HTMLElement;
          if (entry.isIntersecting) visible.add(card);
          else visible.delete(card);
        }
        wake();
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" },
    );
    cards.forEach((card) => observer.observe(card));
    // The store can intersect underneath the opaque pinned intro. Wait for
    // release instead of consuming card entrances while they are covered.
    const introObserver = new MutationObserver(wake);
    if (intro) {
      introObserver.observe(intro, {
        attributes: true,
        attributeFilter: ["data-active"],
      });
    }
    introObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-mobile-intro", "data-store-animate"],
    });
    const focus = (event: FocusEvent) => {
      if (!(event.target instanceof Element)) return;
      const card = event.target.closest<HTMLElement>(".reveal-card");
      if (card) reveal(card);
    };
    grid.addEventListener("focusin", focus);
    motion.addEventListener("change", preference);
    return () => {
      clearTimeout(timer);
      observer.disconnect();
      introObserver.disconnect();
      grid.removeEventListener("focusin", focus);
      motion.removeEventListener("change", preference);
      cards.forEach((card) => {
        card.removeAttribute("data-reveal-pending");
        card.classList.remove("is-visible");
      });
    };
  }, []);

  return (
    <div ref={ref} {...props}>
      {children}
    </div>
  );
}
