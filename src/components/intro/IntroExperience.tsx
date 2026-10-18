"use client";

import { ScrollIntro } from "./ScrollIntro";
import type { IntroMetadata } from "./canvas-utils";

export interface IntroExperienceProps {
  frames: IntroMetadata;
}

export function IntroExperience({ frames }: IntroExperienceProps) {
  return (
    <>
      <ScrollIntro frames={frames} />
      <button
        type="button"
        className="intro-skip mobile-intro-skip-btn"
        aria-label="Skip animation — enter the boutique"
        onClick={() => {
          const store = document.getElementById("boutique");
          if (store) store.inert = false;
          if (typeof document !== "undefined") {
            document.documentElement.setAttribute("data-store-animate", "in");
          }
          const introEl = document.querySelector<HTMLElement>(".intro-scroll");
          if (introEl) {
            introEl.dataset.active = "false";
            introEl.dataset.phase = "store";
            const top = introEl.getBoundingClientRect().top + window.scrollY;
            window.scrollTo({
              top: top + introEl.clientHeight + 50,
              behavior: "instant",
            });
          }
        }}
      >
        Skip
      </button>
    </>
  );
}

