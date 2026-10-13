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
  return <ScrollIntro frames={frames} />;
}

