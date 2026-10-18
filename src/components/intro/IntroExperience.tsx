"use client";

import { useSyncExternalStore } from "react";
import { ScrollIntro } from "./ScrollIntro";
import { AchuMobileIntro } from "./AchuMobileIntro";
import type { IntroMetadata } from "./canvas-utils";

export interface IntroExperienceProps {
  frames: IntroMetadata;
}

const subscribe = (callback: () => void) => {
  if (typeof window === "undefined") return () => {};
  const mq = window.matchMedia("(max-width: 767px)");
  mq.addEventListener("change", callback);
  return () => mq.removeEventListener("change", callback);
};

const getSnapshot = () =>
  typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches;
const getServerSnapshot = () => false;

const emptySubscribe = () => () => {};

export function IntroExperience({ frames }: IntroExperienceProps) {
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);
  const isMobile = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  if (!mounted) {
    return <div className="intro-shell-placeholder" aria-hidden="true" />;
  }

  // Mobile: Render only AchuMobileIntro (zero desktop canvas loops, zero 240-frame WebP downloads)
  if (isMobile) {
    return <AchuMobileIntro />;
  }

  // Desktop / Laptop: Preserve the exact existing Peacock 3D scroll canvas intro untouched
  return (
    <>
      <ScrollIntro frames={frames} />
      <button
        type="button"
        className="intro-skip"
        aria-label="Skip animation — enter the boutique"
        onClick={() => {
          const store = document.getElementById("boutique");
          if (store) store.inert = false;
          const introEl = document.querySelector<HTMLElement>(".intro-scroll");
          if (introEl) {
            introEl.dataset.active = "false";
            introEl.dataset.phase = "store";
            window.scrollTo({
              top: store
                ? Math.ceil(store.getBoundingClientRect().top + window.scrollY)
                : introEl.getBoundingClientRect().top +
                  window.scrollY +
                  introEl.clientHeight,
              behavior: "instant",
            });
            introEl.dispatchEvent(new Event("intro:skip"));
            store?.focus({ preventScroll: true });
          }
        }}
      >
        Skip
      </button>
    </>
  );
}
