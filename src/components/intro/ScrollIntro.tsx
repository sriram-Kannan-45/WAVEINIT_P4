"use client";

import { useEffect, useRef } from "react";
import type { CSSProperties } from "react";
import { IntroFrameCache } from "./frame-cache";
import { WelcomeArtwork } from "./WelcomeArtwork";
import {
  clamp,
  cropPosition,
  drawBounds,
  frameUrl,
  frameSource,
  introMode,
  introProgress,
  portraitFit,
  portraitLogoWidth,
  scrollFrame,
  transparentColor,
  type IntroMetadata,
} from "./canvas-utils";

function triggerStoreAnimation() {
  if (typeof document === "undefined") return;
  const state = document.documentElement.getAttribute("data-store-animate");
  if (state === "in" || state === "done") return;
  document.documentElement.setAttribute("data-store-animate", "in");
  window.setTimeout(() => {
    document.documentElement.setAttribute("data-store-animate", "done");
  }, 1800);
}

export function ScrollIntro({ frames }: { frames: IntroMetadata }) {
  const sectionRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const section = sectionRef.current!,
      canvas = canvasRef.current!;
    const media = section.querySelector<HTMLElement>(".intro-media")!;
    const front = section.querySelector<HTMLElement>(".intro-front")!;
    const videoStage =
      section.querySelector<HTMLElement>(".intro-video-stage")!;
    const possibleContext = canvas.getContext("2d", { alpha: false });
    if (!possibleContext) return;
    const context: CanvasRenderingContext2D = possibleContext;
    const store = document.getElementById("boutique");
    const home = section.closest<HTMLElement>(".home-experience")!;
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    const dynamicViewport = CSS.supports("height", "1dvh");
    const smallViewport = CSS.supports("height", "1svh");
    const touch = matchMedia("(pointer: coarse)");
    let fallbackWidth = 0,
      fallbackPortrait = false,
      fallbackHeight = 0;
    let cache: IntroFrameCache, previous: IntroFrameCache | undefined;
    let raf = 0,
      disposed = false,
      current = 0,
      target = 0,
      targetProgress = 0,
      displayedProgress = 0,
      targetFront = 0,
      currentFront = 0;
    let width = 0,
      height = 0,
      start = 0,
      distance = 1,
      frontDistance = 1;
    let lastTick = 0,
      drawn = "",
      resized = true;
    let lastFadeStr = "",
      lastActiveStr = "",
      lastPhaseStr = "",
      lastRevealStr = "",
      lastVideoOpStr = "";
    let lastCropXStr = "",
      lastCropShareStr = "",
      lastPosterWStr = "",
      lastPosterHStr = "",
      lastPosterLStr = "",
      lastPosterTStr = "";

    const request = () => {
      if (!disposed && !raf) raf = requestAnimationFrame(render);
    };
    const synchronize = () => {
      const scrollY = Math.max(0, window.scrollY);
      const introEnd = start + distance + frontDistance;
      // Fast bypass: if user has already scrolled past the intro, skip all work
      if (
        displayedProgress >= 1 &&
        scrollY > introEnd + 50 &&
        section.dataset.active === "false"
      ) {
        return;
      }
      const phases = introProgress(
        scrollY - start,
        frontDistance,
        distance,
      );
      targetFront = motion.matches ? 0 : phases.front;
      targetProgress = motion.matches ? 0 : phases.video;
      target = motion.matches
        ? frames.frameCount - 1
        : scrollFrame(targetProgress, frames);

      request();
    };
    const geometry = () => {
      const visibleHeight = window.visualViewport?.height || window.innerHeight;
      if (!dynamicViewport)
        home.style.setProperty(
          "--intro-visible-vh",
          `${visibleHeight / 100}px`,
        );
      if (!smallViewport) {
        const viewportWidth = document.documentElement.clientWidth;
        const portrait = matchMedia("(orientation: portrait)").matches;
        // On older touch browsers, changing address bars must resize the
        // visible stage without shortening the already allocated scrub range.
        if (
          !fallbackHeight ||
          !touch.matches ||
          viewportWidth !== fallbackWidth ||
          portrait !== fallbackPortrait
        )
          fallbackHeight = visibleHeight;
        fallbackWidth = viewportWidth;
        fallbackPortrait = portrait;
        home.style.setProperty(
          "--intro-stable-vh",
          `${fallbackHeight / 100}px`,
        );
      }
      width = videoStage.clientWidth;
      height = videoStage.clientHeight;
      start = section.getBoundingClientRect().top + Math.max(0, window.scrollY);
      // svh controls physical scroll distance; dvh controls only the visible
      // stage. Address-bar changes must not advance either scroll timeline.
      frontDistance = Math.max(
        1,
        section.querySelector<HTMLElement>(".intro-front-range")!.clientHeight,
      );
      distance = Math.max(
        1,
        section.querySelector<HTMLElement>(".intro-video-range")!.clientHeight,
      );
      const mode = introMode(width, height);
      if (!cache || cache.mode !== mode) {
        previous?.dispose();
        previous = cache;
        cache = new IntroFrameCache(frames, mode, request, motion.matches);
      }
      resized = true;
      synchronize();
    };
    function render(now: number) {
      raf = 0;
      if (disposed) return;

      const scrollY = Math.max(0, window.scrollY);
      const introEnd = start + distance + frontDistance;
      if (displayedProgress >= 1 && scrollY > introEnd + 50 && section.dataset.active === "false") {
        current = target;
        currentFront = targetFront;
        return;
      }

      const dt = Math.min(32, Math.max(1, now - (lastTick || now - 16.67)));
      lastTick = now;

      // 1. Smooth front reveal progress
      const frontDiff = targetFront - currentFront;
      if (motion.matches || Math.abs(frontDiff) < 0.005) {
        currentFront = targetFront;
      } else {
        const frontRate = 1 - Math.exp(-dt / 90);
        currentFront += frontDiff * frontRate;
      }

      const reveal = currentFront * currentFront * (3 - 2 * currentFront);
      const revealStr = (1 - reveal).toFixed(3);
      if (lastRevealStr !== revealStr) {
        lastRevealStr = revealStr;
        section.style.setProperty("--intro-front-opacity", revealStr);
      }
      const videoOpStr = String(motion.matches || currentFront > 0 ? 1 : 0);
      if (lastVideoOpStr !== videoOpStr) {
        lastVideoOpStr = videoOpStr;
        section.style.setProperty("--intro-video-opacity", videoOpStr);
      }

      // 2. Smooth video frame progress
      const diff = target - current;
      const absDiff = Math.abs(diff);

      if (motion.matches || absDiff < 0.02) {
        current = target;
      } else {
        // Time-based exponential smoothing (framerate-independent)
        const tau = 65; // ms: cinematic response without excessive lag
        const expFactor = 1 - Math.exp(-dt / tau);
        let step = diff * expFactor;

        // Dynamic speed limit prevents multi-frame skipping during rapid scroll/swipes/held keys
        // Normal scroll/swipes/held keys stay at smooth cinematic cadence (~32-64 fps, <=1 frame/tick)
        // Large scrubs/instant jumps scale up to 720 fps so automated tests & instant scrubs catch up cleanly
        const minSpeed = 32;
        const maxSpeed = 720;
        const dynamicSpeed =
          absDiff <= 30
            ? minSpeed + (absDiff / 30) * 32
            : 64 + Math.min(maxSpeed - 64, ((absDiff - 30) / 50) * (maxSpeed - 64));
        const maxStep = (dynamicSpeed * dt) / 1000;

        if (Math.abs(step) > maxStep) {
          step = Math.sign(step) * maxStep;
        }

        current += step;

        if (Math.abs(target - current) < 0.08) {
          current = target;
        }
      }

      displayedProgress = motion.matches ? 0 : current / Math.max(1, frames.frameCount - 1);

      // Tell frame cache to prioritize frames around the displayed frame in direction of target
      const activeDirection = Math.sign(target - current);
      cache?.setTarget(Math.round(current), motion.matches, activeDirection);

      const isPastIntro = motion.matches
        ? scrollY - start >= section.offsetHeight
        : (displayedProgress >= 1 && targetProgress >= 1) ||
          scrollY - start >= frontDistance + distance;
      const activeStr = String(
        motion.matches
          ? scrollY - start < section.offsetHeight
          : !isPastIntro,
      );
      if (lastActiveStr !== activeStr) {
        lastActiveStr = activeStr;
        section.dataset.active = activeStr;
      }

      const fadeStart = frames.scroll.fadeStart;
      const fade = motion.matches
        ? 0
        : clamp((targetProgress - fadeStart) / (1 - fadeStart));
      const fadeStr = (1 - fade).toFixed(3);
      if (lastFadeStr !== fadeStr) {
        lastFadeStr = fadeStr;
        section.style.setProperty("--intro-opacity", fadeStr);
        const scale = (1 + fade * 0.08).toFixed(3);
        const blur = (fade * 3).toFixed(2);
        const brightness = (1 + fade * 0.15).toFixed(3);
        section.style.setProperty("--intro-logo-scale", scale);
        section.style.setProperty(
          "--intro-logo-filter",
          fade > 0 ? `brightness(${brightness}) blur(${blur}px)` : "none",
        );
        section.style.setProperty(
          "--intro-pointer-events",
          fade >= 1 ? "none" : "auto",
        );
      }

      const phaseStr = motion.matches
        ? "static"
        : currentFront === 0
          ? "welcome"
          : currentFront < 1
            ? "transition"
            : displayedProgress >= 1
              ? "store"
              : "video";
      if (lastPhaseStr !== phaseStr) {
        lastPhaseStr = phaseStr;
        section.dataset.phase = phaseStr;
        if (phaseStr === "store") {
          triggerStoreAnimation();
        }
      }

      if (displayedProgress >= 0.98) {
        triggerStoreAnimation();
      } else if (displayedProgress < 0.94) {
        if (typeof document !== "undefined") {
          document.documentElement.removeAttribute("data-store-animate");
        }
      }

      const frontInert = !motion.matches && currentFront === 1;
      if (front.inert !== frontInert) front.inert = frontInert;
      const stageInert = !motion.matches && currentFront < 1;
      if (videoStage.inert !== stageInert) videoStage.inert = stageInert;
      // Keep hidden ecommerce controls out of keyboard navigation until revealed.
      if (store) {
        const storeInert = !motion.matches && targetProgress < frames.scroll.fadeStart && displayedProgress < frames.scroll.fadeStart;
        if (store.inert !== storeInert) store.inert = storeInert;
      }
      let source = cache;
      let frame = cache.nearest(Math.round(current));
      if (previous && (!frame || frame.index !== Math.round(target))) {
        source = previous;
        frame = previous.nearest(Math.round(current));
      }
      if (target === 0 && frame?.index !== 0) frame = undefined;
      if (frame) {
        const key = `${source.mode}:${frame.index}`;
        if (resized || key !== drawn) {
          const rectangle = frameSource(frames[source.mode], frame.index);
          const position =
            width <= height
              ? cropPosition(frame.index, frames.frameCount)
              : 0.5;
          const bounds = drawBounds(
            width,
            height,
            rectangle,
            position,
            frame.index,
            frames.frameCount,
          );
          // Poster and canvas share fit/cover geometry, including resize
          // and the initial left-edge entrance. No synthetic background layer.
          const cropXStr = `${position * 100}%`;
          if (lastCropXStr !== cropXStr) {
            lastCropXStr = cropXStr;
            media.style.setProperty("--intro-crop-x", cropXStr);
          }
          const cropShareStr = String(position);
          if (lastCropShareStr !== cropShareStr) {
            lastCropShareStr = cropShareStr;
            media.style.setProperty("--intro-crop-share", cropShareStr);
          }
          if (portraitFit(width, height)) {
            const pwStr = `${bounds.width}px`;
            if (lastPosterWStr !== pwStr) {
              lastPosterWStr = pwStr;
              media.style.setProperty("--intro-poster-width", pwStr);
            }
            const phStr = `${bounds.height}px`;
            if (lastPosterHStr !== phStr) {
              lastPosterHStr = phStr;
              media.style.setProperty("--intro-poster-height", phStr);
            }
            const plStr = `${bounds.x}px`;
            if (lastPosterLStr !== plStr) {
              lastPosterLStr = plStr;
              media.style.setProperty("--intro-poster-left", plStr);
            }
            const ptStr = `${bounds.y}px`;
            if (lastPosterTStr !== ptStr) {
              lastPosterTStr = ptStr;
              media.style.setProperty("--intro-poster-top", ptStr);
            }
          }
          const dpr = window.devicePixelRatio || 1;
          const ratio = Math.min(dpr, 2);
          const pixelWidth = Math.round(width * ratio);
          const pixelHeight = Math.round(height * ratio);
          if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
            canvas.width = pixelWidth;
            canvas.height = pixelHeight;
          }
          context.setTransform(
            pixelWidth / width,
            0,
            0,
            pixelHeight / height,
            0,
            0,
          );
          context.imageSmoothingEnabled = true;
          context.imageSmoothingQuality = "medium";
          context.fillStyle = frames.background;
          context.fillRect(0, 0, width, height);
          context.drawImage(
            frame.image,
            rectangle.x,
            rectangle.y,
            rectangle.width,
            rectangle.height,
            bounds.x,
            bounds.y,
            bounds.width,
            bounds.height,
          );
          if (portraitFit(width, height)) {
            const fadeH = Math.min(40, bounds.height * 0.1);
            const transparentBg = transparentColor(frames.background);

            // Bottom edge blend
            const bottomY = bounds.y + bounds.height;
            const botGrad = context.createLinearGradient(
              0,
              bottomY - fadeH,
              0,
              bottomY,
            );
            botGrad.addColorStop(0, transparentBg);
            botGrad.addColorStop(1, frames.background);
            context.fillStyle = botGrad;
            context.fillRect(0, bottomY - fadeH, width, fadeH + 1);

            if (bounds.y > 0) {
              // Top edge blend
              const topGrad = context.createLinearGradient(
                0,
                bounds.y,
                0,
                bounds.y + fadeH,
              );
              topGrad.addColorStop(0, frames.background);
              topGrad.addColorStop(1, transparentBg);
              context.fillStyle = topGrad;
              context.fillRect(0, bounds.y - 1, width, fadeH + 1);
            }
          }
          drawn = key;
          resized = false;
          section.dataset.ready = "true";
          section.dataset.frame = String(frame.index);
          section.dataset.mode = source.mode;
        }
        if (source === cache && previous) {
          previous.dispose();
          previous = undefined;
        }
      }
      if (current !== target) request();
    }
    const scroll = () => {
      const introEnd = start + frontDistance + distance;
      // Skip only when scrolled well beyond intro boundary and intro is already deactivated
      if (window.scrollY > introEnd + 250 && section.dataset.active === "false") return;
      synchronize();
    };
    const restore = () => {
      geometry();
      current = target;
      currentFront = targetFront;
      displayedProgress = targetProgress;
      request();
    };
    const visibility = () => {
      if (!document.hidden) restore();
    };
    const observer = new ResizeObserver(geometry);
    observer.observe(section);
    observer.observe(section.querySelector(".intro-sticky")!);
    observer.observe(videoStage);

    const intersectionObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            synchronize();
            request();
          }
        }
      },
      { rootMargin: "300px 0px" },
    );
    intersectionObserver.observe(section);

    let storeObserver: IntersectionObserver | undefined;
    if (store && typeof IntersectionObserver !== "undefined") {
      storeObserver = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              triggerStoreAnimation();
            }
          }
        },
        { threshold: 0.05 },
      );
      storeObserver.observe(store);
    }

    geometry();
    current = target;
    currentFront = targetFront;
    displayedProgress = targetProgress;
    window.addEventListener("scroll", scroll, { passive: true });
    window.addEventListener("resize", geometry, { passive: true });
    window.addEventListener("pageshow", restore);
    window.visualViewport?.addEventListener("resize", geometry, {
      passive: true,
    });
    document.addEventListener("visibilitychange", visibility);
    motion.addEventListener("change", restore);
    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      observer.disconnect();
      intersectionObserver.disconnect();
      storeObserver?.disconnect();
      window.removeEventListener("scroll", scroll);
      window.removeEventListener("resize", geometry);
      window.removeEventListener("pageshow", restore);
      window.visualViewport?.removeEventListener("resize", geometry);
      document.removeEventListener("visibilitychange", visibility);
      motion.removeEventListener("change", restore);
      cache?.dispose();
      previous?.dispose();
      if (store) store.inert = false;
      front.inert = false;
      videoStage.inert = false;
      if (!dynamicViewport) home.style.removeProperty("--intro-visible-vh");
      if (!smallViewport) home.style.removeProperty("--intro-stable-vh");
    };
  }, [frames]);

  const last = frames.frameCount - 1;
  const style = {
    "--intro-background": frames.background,
    // Portrait logo framing, expressed in container units so the server-rendered
    // poster matches the canvas before any script runs. Same formula as
    // drawBounds(): min(viewportWidth, viewportHeight) / portraitLogoWidth.
    "--intro-phone-image-width": `min(${(frames.mobile.width / portraitLogoWidth) * 100}cqw, ${(frames.mobile.width / frames.mobile.height) * 100}cqh)`,
    "--intro-phone-image-height": `min(${(frames.mobile.height / portraitLogoWidth) * 100}cqw, 100cqh)`,
    "--intro-crop-share": "0",
    "--intro-front-distance": "calc(45 * var(--intro-stable-vh))",
    "--intro-desktop-video-distance": `calc(${(frames.scroll.desktopScreens - 1) * 100} * var(--intro-stable-vh))`,
    "--intro-mobile-video-distance": `calc(${(frames.scroll.mobileScreens - 1) * 100} * var(--intro-stable-vh))`,
  } as CSSProperties;
  return (
    <section
      ref={sectionRef}
      className="intro-scroll"
      aria-label="Achu Designer Boutique peacock transformation. Scroll to discover the boutique."
      style={style}
    >
      <div className="intro-front-range" aria-hidden="true" />
      <div className="intro-video-range" aria-hidden="true" />
      <span id="peacock" className="intro-video-anchor" aria-hidden="true" />
      <div className="intro-sticky">
        <section className="intro-front" aria-label="Scroll to Continue">
          <WelcomeArtwork />
        </section>
        <div className="intro-video-stage">
          <div className="intro-media">
            <picture className="intro-poster">
              <source
                media="(prefers-reduced-motion: reduce) and (max-aspect-ratio: 1/1)"
                srcSet={frameUrl(frames, "mobile", last)}
              />
              <source
                media="(prefers-reduced-motion: reduce)"
                srcSet={frameUrl(frames, "desktop", last)}
              />
              <source
                media="(max-aspect-ratio: 1/1)"
                srcSet={frameUrl(frames, "mobile", 0)}
              />
              {/* Raw picture sources match the extracted canvas frames; no image optimizer or delayed hydration. */}
              <img
                src={frameUrl(frames, "desktop", 0)}
                width={frames.desktop.width}
                height={frames.desktop.height}
                alt=""
                fetchPriority="high"
                loading="eager"
              />
            </picture>
            <canvas ref={canvasRef} aria-hidden="true" />
          </div>
        </div>
      </div>
      <noscript>
        <style>{`.intro-scroll{height:auto!important}.intro-sticky{position:relative;height:auto;display:block;overflow:visible;opacity:1!important}.intro-front,.intro-video-stage{position:relative;height:calc(100 * var(--intro-visible-vh));opacity:1!important}.intro-front-range,.intro-video-range{display:none}.intro-video-anchor{top:calc(100 * var(--intro-visible-vh))}.intro-store{margin-top:0!important}.home-experience .floating-whatsapp{position:absolute;visibility:visible!important}`}</style>
      </noscript>
    </section>
  );
}
