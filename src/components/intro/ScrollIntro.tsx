"use client";

import { useEffect, useRef } from "react";
import type { CSSProperties } from "react";
import { IntroFrameCache } from "./frame-cache";
import { WelcomeArtwork } from "./WelcomeArtwork";
import {
  clamp,
  drawBounds,
  frameUrl,
  frameSource,
  introMode,
  introProgress,
  introVerticalFocus,
  scrollFrame,
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
      lastScroll = 0,
      drawn = "",
      resized = true;

    const request = () => {
      if (!disposed && !raf) raf = requestAnimationFrame(render);
    };
    const synchronize = () => {
      const phases = introProgress(
        window.scrollY - start,
        frontDistance,
        distance,
      );
      frontProgress = motion.matches ? 0 : phases.front;
      progress = motion.matches ? 0 : phases.video;
      target = motion.matches
        ? frames.frameCount - 1
        : scrollFrame(progress, frames);
      cache?.setTarget(target, motion.matches);
      const fade = motion.matches
        ? 0
        : clamp(
            (progress - frames.scroll.fadeStart) /
              (1 - frames.scroll.fadeStart),
          );
      section.style.setProperty("--intro-opacity", String(1 - fade));
      section.dataset.active = String(
        motion.matches
          ? window.scrollY - start < section.offsetHeight
          : progress < 1,
      );
      section.dataset.phase = motion.matches
        ? "static"
        : frontProgress === 0
          ? "welcome"
          : frontProgress < 1
            ? "transition"
            : progress >= 1
              ? "store"
              : "video";
      front.inert = !motion.matches && frontProgress === 1;
      videoStage.inert = !motion.matches && frontProgress < 1;
      // Keep hidden ecommerce controls out of keyboard navigation until revealed.
      if (store)
        store.inert = !motion.matches && progress < frames.scroll.fadeStart;
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
      start = section.getBoundingClientRect().top + window.scrollY;
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
        cache = new IntroFrameCache(frames, mode, request);
      }
      resized = true;
      synchronize();
    };
    function render(now: number) {
      raf = 0;
      const dt = Math.min(32, now - (lastTick || now - 16.67));
      lastTick = now;
      const reveal = frontProgress * frontProgress * (3 - 2 * frontProgress);
      section.style.setProperty("--intro-front-opacity", String(1 - reveal));
      section.style.setProperty(
        "--intro-video-opacity",
        String(motion.matches || frontProgress > 0 ? 1 : 0),
      );
      // Brief frame interpolation follows native scroll; settle within 100ms
      // of the final scroll event, so no independent timeline keeps running.
      if (motion.matches || now - lastScroll > 100) current = target;
      else current += (target - current) * (1 - Math.pow(0.8, dt / 16.67));
      if (Math.abs(target - current) < 0.2) current = target;
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
          const bounds = drawBounds(width, height, rectangle);
          // The media frame has the footage's aspect ratio, not the padded
          // export's aspect ratio. Keep the surrounding scroll stage unchanged.
          media.style.setProperty(
            "--intro-media-aspect",
            String(rectangle.width / rectangle.height),
          );
          media.style.setProperty(
            "--intro-media-shift",
            `${((bounds.y - (height - bounds.height) / 2) / bounds.height) * 100}%`,
          );
          const ratio = Math.min(
            window.devicePixelRatio || 1,
            2,
            Math.sqrt(3_000_000 / (bounds.width * bounds.height)),
          );
          const pixelWidth = Math.round(bounds.width * ratio);
          const pixelHeight = Math.round(bounds.height * ratio);
          if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
            canvas.width = pixelWidth;
            canvas.height = pixelHeight;
          }
          context.setTransform(ratio, 0, 0, ratio, 0, 0);
          context.drawImage(
            frame.image,
            rectangle.x,
            rectangle.y,
            rectangle.width,
            rectangle.height,
            0,
            0,
            bounds.width,
            bounds.height,
          );
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
      lastScroll = performance.now();
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
  const firstMobile = frameSource(frames.mobile, 0);
  const lastMobile = frameSource(frames.mobile, last);
  const style = {
    "--intro-background": frames.background,
    "--intro-front-distance": "calc(45 * var(--intro-stable-vh))",
    "--intro-desktop-video-distance": `calc(${(frames.scroll.desktopScreens - 1) * 100} * var(--intro-stable-vh))`,
    "--intro-mobile-video-distance": `calc(${(frames.scroll.mobileScreens - 1) * 100} * var(--intro-stable-vh))`,
    "--intro-desktop-aspect": frames.desktop.width / frames.desktop.height,
    "--intro-mobile-aspect": firstMobile.width / firstMobile.height,
    "--intro-mobile-aspect-reduced": lastMobile.width / lastMobile.height,
    "--intro-focus-top-offset": `${(0.5 - introVerticalFocus.top) * 100}%`,
    "--intro-focus-bottom-offset": `${(0.5 - introVerticalFocus.bottom) * 100}%`,
    "--intro-mobile-poster-top": `${(-firstMobile.y / firstMobile.height) * 100}%`,
    "--intro-mobile-poster-height": `${(frames.mobile.height / firstMobile.height) * 100}%`,
    "--intro-mobile-poster-top-reduced": `${(-lastMobile.y / lastMobile.height) * 100}%`,
    "--intro-mobile-poster-height-reduced": `${(frames.mobile.height / lastMobile.height) * 100}%`,
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
