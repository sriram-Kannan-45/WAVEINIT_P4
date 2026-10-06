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
      progress = 0;
    let frontProgress = 0;
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
        progress >= 1 &&
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
      frontProgress = motion.matches ? 0 : phases.front;
      progress = motion.matches ? 0 : phases.video;
      target = motion.matches
        ? frames.frameCount - 1
        : scrollFrame(progress, frames);
      cache?.setTarget(target, motion.matches);
      const isPastIntro = scrollY - start >= frontDistance + distance + (height || 800);
      const activeStr = String(
        motion.matches
          ? scrollY - start < section.offsetHeight
          : !isPastIntro,
      );
      if (lastActiveStr !== activeStr) {
        lastActiveStr = activeStr;
        section.dataset.active = activeStr;
      }
      if (lastFadeStr !== "1") {
        lastFadeStr = "1";
        section.style.setProperty("--intro-opacity", "1");
      }
      const phaseStr = motion.matches
        ? "static"
        : frontProgress === 0
          ? "welcome"
          : frontProgress < 1
            ? "transition"
            : progress >= 1
              ? "store"
              : "video";
      if (lastPhaseStr !== phaseStr) {
        lastPhaseStr = phaseStr;
        section.dataset.phase = phaseStr;
      }
      const frontInert = !motion.matches && frontProgress === 1;
      if (front.inert !== frontInert) front.inert = frontInert;
      const stageInert = !motion.matches && frontProgress < 1;
      if (videoStage.inert !== stageInert) videoStage.inert = stageInert;
      // Keep hidden ecommerce controls out of keyboard navigation until revealed.
      if (store) {
        const storeInert = !motion.matches && progress < 1;
        if (store.inert !== storeInert) store.inert = storeInert;
      }
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
      if (progress >= 1 && section.dataset.active === "false") {
        current = target;
        return;
      }
      const dt = Math.min(32, now - (lastTick || now - 16.67));
      lastTick = now;
      const reveal = frontProgress * frontProgress * (3 - 2 * frontProgress);
      const revealStr = (1 - reveal).toFixed(3);
      if (lastRevealStr !== revealStr) {
        lastRevealStr = revealStr;
        section.style.setProperty("--intro-front-opacity", revealStr);
      }
      const videoOpStr = String(motion.matches || frontProgress > 0 ? 1 : 0);
      if (lastVideoOpStr !== videoOpStr) {
        lastVideoOpStr = videoOpStr;
        section.style.setProperty("--intro-video-opacity", videoOpStr);
      }
      // Responsive continuous follow without abrupt jump or lag
      const diff = target - current;
      const absDiff = Math.abs(diff);
      if (motion.matches || absDiff < 0.05) {
        current = target;
      } else {
        const followRate = Math.min(1, 1 - Math.exp(-dt / 70));
        current += diff * followRate;
        if (Math.abs(target - current) < 0.04) current = target;
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

    geometry();
    current = target;
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
          <a
            className="intro-skip"
            href="#boutique"
            onClick={() => {
              const store = document.getElementById("boutique");
              if (store) store.inert = false;
            }}
          >
            Skip animation — enter the boutique
          </a>
        </div>
      </div>
      <noscript>
        <style>{`.intro-scroll{height:auto!important}.intro-sticky{position:relative;height:auto;display:block;overflow:visible;opacity:1!important}.intro-front,.intro-video-stage{position:relative;height:calc(100 * var(--intro-visible-vh));opacity:1!important}.intro-front-range,.intro-video-range{display:none}.intro-video-anchor{top:calc(100 * var(--intro-visible-vh))}.intro-store{margin-top:0!important}.home-experience .floating-whatsapp{position:absolute;visibility:visible!important}`}</style>
      </noscript>
    </section>
  );
}
