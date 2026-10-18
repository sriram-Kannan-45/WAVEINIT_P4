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
