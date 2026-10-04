"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, Flower2 } from "lucide-react";
import type { Product, Taxonomy } from "@/types";
import { imageUrl } from "@/lib/utils";
import { ProductCard } from "@/components/product/card";

interface Petal {
  x: number;
  y: number;
  z: number;
  size: number;
  rotation: number;
  rotSpeed: number;
  tilt: number;
  tiltSpeed: number;
  driftX: number;
  fallSpeed: number;
  swayFreq: number;
  swayAmp: number;
  swayPhase: number;
  aspect: number;
}

interface PetalSprite {
  image: HTMLCanvasElement;
  /** Side length in CSS pixels, including blur bleed. */
  box: number;
}

/** Baked depth-of-field petals, keyed by silhouette size, shading and blur.
 *
 * `ctx.filter = "blur()"` is not a cheap draw hint: every filtered call makes
 * Skia allocate a full offscreen surface sized to the current clip and run a
 * separable Gaussian pass over it, at the backing-store resolution. On a Retina
 * laptop the categories canvas is ~3.7 megapixels, so ~12 blurred petals per
 * frame meant tens of megapixels of blur every frame and the scroll handler
 * starved. Baking each silhouette once turns that into a 1:1 blit while keeping
 * the identical path, gradient and blur radius.
 *
 * The cache is bounded by construction: size = round(petal.size * depthScale)
 * lands in 6..37, and alpha/blur take three fixed combinations. */
const PETAL_SPRITES = new Map<string, PetalSprite>();

function petalSprite(
  size: number,
  alpha: number,
  blur: number,
  dpr: number,
): PetalSprite {
  const key = `${size}:${alpha}:${blur}:${dpr}`;
  const cached = PETAL_SPRITES.get(key);
  if (cached) return cached;

  // Leave room for the blur kernel so the baked edge is not clipped.
  const pad = blur ? Math.ceil(blur * 3) + 1 : 0;
  const box = Math.ceil(size * 2) + pad * 2;
  const image = document.createElement("canvas");
  image.width = Math.ceil(box * dpr);
  image.height = Math.ceil(box * dpr);
  const sprite = image.getContext("2d");
  if (!sprite) {
    const fallback = { image, box };
    PETAL_SPRITES.set(key, fallback);
    return fallback;
  }
  // Render at device resolution so the blit is 1:1 and stays crisp on Retina.
  sprite.scale(dpr, dpr);
  sprite.translate(box / 2, box / 2);
  if (blur) sprite.filter = `blur(${blur}px)`;

  // Elegant organic petal silhouette (delicate white mogra / jasmine petal)
  sprite.beginPath();
  sprite.moveTo(0, -size);
  sprite.bezierCurveTo(
    size * 0.8,
    -size * 0.65,
    size * 0.9,
    size * 0.45,
    0,
    size,
  );
  sprite.bezierCurveTo(
    -size * 0.9,
    size * 0.45,
    -size * 0.8,
    -size * 0.65,
    0,
    -size,
  );
  sprite.closePath();

  // Shading gradient: pure silky ivory with subtle warm champagne reflection
  const grad = sprite.createLinearGradient(0, -size, 0, size);
  grad.addColorStop(0, `rgba(255, 255, 255, ${alpha})`);
  grad.addColorStop(0.4, `rgba(253, 250, 242, ${alpha * 0.95})`);
  grad.addColorStop(0.85, `rgba(243, 235, 215, ${alpha * 0.85})`);
  grad.addColorStop(1, `rgba(228, 214, 185, ${alpha * 0.65})`);
  sprite.fillStyle = grad;
  sprite.fill();

  // Delicate subtle petal vein highlight
  sprite.beginPath();
  sprite.moveTo(0, -size * 0.75);
  sprite.quadraticCurveTo(size * 0.08, 0, 0, size * 0.65);
  sprite.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.55})`;
  sprite.lineWidth = 0.75;
  sprite.stroke();

  const baked = { image, box };
  PETAL_SPRITES.set(key, baked);
  return baked;
}

interface LuxuryHero3DBackgroundProps {
  categories?: Taxonomy[];
  arrivals?: Product[];
  lowStockThreshold?: number;
  showArrivals?: boolean;
  featured?: Taxonomy;
  featuredTitle?: string;
  featuredDescription?: string;
  featuredImage?: string;
  showFeatured?: boolean;
  bestSellers?: Product[];
  showBestSellers?: boolean;
  promoImage?: string;
  promoHeading?: string;
  promoSubtitle?: string;
  promoText?: string;
  promoUrl?: string;
  showPromo?: boolean;
  priority?: boolean;
  objectPosition?: string;
}

export function LuxuryHero3DBackground({
  categories = [],
  arrivals = [],
  lowStockThreshold = 3,
  showArrivals = true,
  featured,
  featuredTitle = "Made for memorable moments.",
  featuredDescription = "Explore our occasion edit.",
  featuredImage,
  showFeatured = true,
  bestSellers = [],
  showBestSellers = true,
  promoImage,
  promoHeading = "Your next occasion,\nyour own expression.",
  promoSubtitle = "Discover the collection and find a piece that feels like you.",
  promoText = "Discover the edit",
  promoUrl = "/collections",
  showPromo = false,
  priority = false,
  objectPosition = "center 36%",
}: LuxuryHero3DBackgroundProps = {}) {
  const containerRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const stage1Ref = useRef<HTMLDivElement>(null);
  const stage2Ref = useRef<HTMLDivElement>(null);
  const stage3Ref = useRef<HTMLDivElement>(null);
  const stage4Ref = useRef<HTMLDivElement>(null);
  const stage5Ref = useRef<HTMLDivElement>(null);
  const stage6Ref = useRef<HTMLDivElement>(null);
  const prefersReducedMotionRef = useRef(false);
  const mouseRef = useRef({ x: 0, y: 0, targetX: 0, targetY: 0 });

  useEffect(() => {
    // Check reduced motion
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    prefersReducedMotionRef.current = motionQuery.matches;
    const handleMotionChange = (e: MediaQueryListEvent) => {
      prefersReducedMotionRef.current = e.matches;
    };
    motionQuery.addEventListener("change", handleMotionChange);

    const mobileQuery = window.matchMedia("(max-width: 767px)");

    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let isVisible = true;
    let width = 0;
    let height = 0;
    let dpr = 1;
    // Infinity sentinel so the first parallax write always lands (NaN comparisons
    // are always false and would suppress it).
    let lastShiftX = Number.POSITIVE_INFINITY;
    let lastShiftY = Number.POSITIVE_INFINITY;

    // Petal initialization
    const getPetalCount = (w: number) => {
      if (w < 768) return 8; // Mobile: light footprint
      if (w < 1024) return 14; // Tablet
      return 16; // Desktop: silky smooth & light
    };

    let petals: Petal[] = [];

    const initPetals = () => {
      const count = getPetalCount(width);
      petals = Array.from({ length: count }, (_, i) => ({
        x: Math.random() * width,
        y: Math.random() * height,
        z: (Math.random() - 0.3) * 120, // -36 to 84 depth
        size: 9 + Math.random() * 11,
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.015,
        tilt: Math.random() * Math.PI,
        tiltSpeed: (Math.random() - 0.5) * 0.018,
        driftX: 0.15 + Math.random() * 0.35,
        fallSpeed: 0.35 + Math.random() * 0.45,
        swayFreq: 0.0012 + Math.random() * 0.001,
        swayAmp: 0.6 + Math.random() * 0.8,
        swayPhase: i * 0.4,
        aspect: 0.65 + Math.random() * 0.35,
      }));
    };

    // Container box in document coordinates cached on resize to eliminate
    // forced layout recalculations during scrolling.
    let box = { left: 0, top: 0, width: 1, height: 1 };
    let updateScrollProgress: () => void = () => {};

    const resize = () => {
      const isMobile = mobileQuery.matches;
      const stickyStage = container.querySelector<HTMLElement>(
        ".cinematic-sticky-stage",
      );
      const stageRect = stickyStage
        ? stickyStage.getBoundingClientRect()
        : container.getBoundingClientRect();
      width = stageRect.width || window.innerWidth;
      height = stageRect.height || window.innerHeight;
      // Cap DPR to conserve fill-rate on Retina and high-DPI mobile screens
      dpr = Math.min(window.devicePixelRatio || 1, isMobile ? 1.25 : 1.5);
      const rect = container.getBoundingClientRect();
      box = {
        left: rect.left + window.scrollX,
        top: rect.top + window.scrollY,
        width: rect.width,
        height: rect.height,
      };

      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      initPetals();
      updateScrollProgress();
    };

    resize();
    window.addEventListener("resize", resize);

    // Mouse parallax tracking (desktop only)
    const handleMouseMove = (e: MouseEvent) => {
      if (mobileQuery.matches) return; // Completely bypass on mobile
      const x = (e.clientX / window.innerWidth - 0.5) * 2;
      const y = (e.clientY / window.innerHeight - 0.5) * 2;
      mouseRef.current.targetX = Math.max(-1, Math.min(1, x));
      mouseRef.current.targetY = Math.max(-1, Math.min(1, y));
    };

    const handleMouseLeave = () => {
      mouseRef.current.targetX = 0;
      mouseRef.current.targetY = 0;
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    container.addEventListener("mouseleave", handleMouseLeave);

    // Dynamic loop control functions declared for observer and unmount
    let startAnimationLoop = () => {};
    let stopAnimationLoop = () => {};

    // Visibility observer to pause canvas loop and seeks when offscreen
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          isVisible = entry.isIntersecting;
          if (isVisible) {
            const rect = container.getBoundingClientRect();
            box = {
              left: rect.left + window.scrollX,
              top: rect.top + window.scrollY,
              width: rect.width,
              height: rect.height,
            };
            updateScrollProgress();
            startAnimationLoop();
          } else {
            stopAnimationLoop();
          }
        }
      },
      { rootMargin: "250px 0px" },
    );
    observer.observe(container);

    // -------------------------------------------------------------
    // Responsive Scroll-Controlled Cinematic Video Controller
    // -------------------------------------------------------------
    const video = videoRef.current;
    let currentSrc = "";
    let duration = 0;
    let isSeeking = false;
    let pendingTime: number | null = null;
    let lastSoughtFrame = -1;
    let lastSeekTime = 0;
    const SEEK_THROTTLE_MS = 33; // 30fps seek throttle, perfectly matching video's native 24fps
    let scheduledSeekRaf = 0;
    let currentProgress = 0;
    let targetProgress = 0;
    let hasInitialProgress = false;
    let isScrolling = false;
    let scrollStopTimer: ReturnType<typeof setTimeout> | null = null;
    let lastProgressDiff = 0;
    const frameDuration = 1 / 24;

    const getVideoSrc = (matchesMobile: boolean) =>
      matchesMobile
        ? "/videos/mobile-resolution.mp4"
        : "/videos/laptop-resolution.mp4";

    const executeSeek = (quantizedTime: number) => {
      if (!video) return;
      isSeeking = true;
      lastSeekTime = performance.now();
      try {
        video.currentTime = quantizedTime;
      } catch {
        isSeeking = false;
      }
    };

    const performSeek = (targetTime: number) => {
      if (!video || !duration || isNaN(duration)) return;
      const clamped = Math.max(0, Math.min(duration, targetTime));
      const frameIndex = Math.round(clamped / frameDuration);
      if (frameIndex === lastSoughtFrame) return;

      const quantizedTime = frameIndex * frameDuration;
      lastSoughtFrame = frameIndex;

      const now = performance.now();

      // Reset isSeeking if a previous seek timed out or browser completed seeking
      if (isSeeking && (!video.seeking || now - lastSeekTime > 120)) {
        isSeeking = false;
      }

      // If already seeking, hold newest time in pendingTime without flooding decoder
      if (isSeeking) {
        pendingTime = quantizedTime;
        return;
      }

      // 30fps seek throttle
      if (now - lastSeekTime < SEEK_THROTTLE_MS) {
        pendingTime = quantizedTime;
        if (!scheduledSeekRaf) {
          scheduledSeekRaf = requestAnimationFrame(() => {
            scheduledSeekRaf = 0;
            if (pendingTime !== null && !isSeeking) {
              const next = pendingTime;
              pendingTime = null;
              executeSeek(next);
            }
          });
        }
        return;
      }

      executeSeek(quantizedTime);
    };

    const handleSeeked = () => {
      isSeeking = false;
      if (pendingTime !== null) {
        const next = pendingTime;
        pendingTime = null;
        // Schedule next seek on next frame so the compositor has a clear window
        // to present the frame without decoder lock contention
        if (!scheduledSeekRaf) {
          scheduledSeekRaf = requestAnimationFrame(() => {
            scheduledSeekRaf = 0;
            performSeek(next);
          });
        }
      }
    };

    if (video) {
      video.muted = true;
      video.playsInline = true;
      video.addEventListener("seeked", handleSeeked);
    }

    interface StageState {
      op: string;
      ty: string;
      active: string;
      visible: boolean;
    }
    const stageStates = new WeakMap<HTMLElement, StageState>();

    const applyStageStyle = (
      el: HTMLElement | null,
      op: number,
      ty: number,
      active: boolean,
    ) => {
      if (!el) return;
      const opStr = op.toFixed(3);
      const tyStr = ty.toFixed(1);
      const activeStr = String(active);
      const isVisibleStage = op > 0.005 || active;

      const prev = stageStates.get(el);
      if (
        prev &&
        prev.op === opStr &&
        prev.ty === tyStr &&
        prev.active === activeStr &&
        prev.visible === isVisibleStage
      ) {
        return;
      }

      stageStates.set(el, {
        op: opStr,
        ty: tyStr,
        active: activeStr,
        visible: isVisibleStage,
      });

      if (prev?.op !== opStr) el.style.opacity = opStr;
      if (prev?.ty !== tyStr)
        el.style.transform = `translate3d(0, ${tyStr}px, 0)`;
      if (prev?.active !== activeStr) el.dataset.active = activeStr;
      if (prev?.visible !== isVisibleStage) {
        el.style.visibility = isVisibleStage ? "visible" : "hidden";
      }
    };

    const calcTransition = (
      p: number,
      inStart: number,
      inEnd: number,
      outStart: number,
      outEnd: number,
      isFirst = false,
      isLast = false,
    ) => {
      if (isFirst) {
        if (p <= outStart) return { op: 1, ty: 0, active: true };
        if (p <= outEnd) {
          const t = (p - outStart) / (outEnd - outStart);
          const ease = t * t * (3 - 2 * t);
          return { op: Math.max(0, 1 - ease), ty: -ease * 36, active: 1 - ease > 0.08 };
        }
        return { op: 0, ty: -36, active: false };
      }
      if (isLast) {
        if (p < inStart) return { op: 0, ty: 36, active: false };
        if (p <= inEnd) {
          const t = (p - inStart) / (inEnd - inStart);
          const ease = t * t * (3 - 2 * t);
          return { op: Math.min(1, ease), ty: (1 - ease) * 36, active: ease > 0.08 };
        }
        return { op: 1, ty: 0, active: true };
      }
      if (p < inStart) return { op: 0, ty: 36, active: false };
      if (p <= inEnd) {
        const t = (p - inStart) / (inEnd - inStart);
        const ease = t * t * (3 - 2 * t);
        return { op: Math.min(1, ease), ty: (1 - ease) * 36, active: ease > 0.08 };
      }
      if (p <= outStart) return { op: 1, ty: 0, active: true };
      if (p <= outEnd) {
        const t = (p - outStart) / (outEnd - outStart);
        const ease = t * t * (3 - 2 * t);
        return { op: Math.max(0, 1 - ease), ty: -ease * 36, active: 1 - ease > 0.08 };
      }
      return { op: 0, ty: -36, active: false };
    };

    const hasPromoStage = Boolean(showPromo && promoImage);

    const updateStages = (p: number) => {
      if (hasPromoStage) {
        const s1 = calcTransition(p, 0.0, 0.0, 0.09, 0.16, true, false);
        const s2 = calcTransition(p, 0.14, 0.2, 0.27, 0.33, false, false);
        const s3 = calcTransition(p, 0.31, 0.37, 0.44, 0.5, false, false);
        const s4 = calcTransition(p, 0.48, 0.54, 0.61, 0.67, false, false);
        const s5 = calcTransition(p, 0.65, 0.71, 0.78, 0.84, false, false);
        const s6 = calcTransition(p, 0.82, 0.89, 1.0, 1.0, false, true);

        applyStageStyle(stage1Ref.current, s1.op, s1.ty, s1.active);
        applyStageStyle(stage2Ref.current, s2.op, s2.ty, s2.active);
        applyStageStyle(stage3Ref.current, s3.op, s3.ty, s3.active);
        applyStageStyle(stage4Ref.current, s4.op, s4.ty, s4.active);
        applyStageStyle(stage5Ref.current, s5.op, s5.ty, s5.active);
        applyStageStyle(stage6Ref.current, s6.op, s6.ty, s6.active);
      } else {
        const s1 = calcTransition(p, 0.0, 0.0, 0.11, 0.18, true, false);
        const s2 = calcTransition(p, 0.16, 0.23, 0.31, 0.38, false, false);
        const s3 = calcTransition(p, 0.36, 0.43, 0.51, 0.58, false, false);
        const s4 = calcTransition(p, 0.56, 0.63, 0.71, 0.78, false, false);
        const s5 = calcTransition(p, 0.76, 0.83, 1.0, 1.0, false, true);

        applyStageStyle(stage1Ref.current, s1.op, s1.ty, s1.active);
        applyStageStyle(stage2Ref.current, s2.op, s2.ty, s2.active);
        applyStageStyle(stage3Ref.current, s3.op, s3.ty, s3.active);
        applyStageStyle(stage4Ref.current, s4.op, s4.ty, s4.active);
        applyStageStyle(stage5Ref.current, s5.op, s5.ty, s5.active);
      }
    };

    updateScrollProgress = () => {
      if (!isVisible) return;
      const scrollY = window.scrollY;
      const viewportHeight = window.innerHeight;
      const scrollDistance = Math.max(1, box.height - viewportHeight);

      // Fast bounds culling: if outside section and progress already at boundary, skip work
      if (scrollY < box.top - 150 && currentProgress === 0) return;
      if (scrollY > box.top + scrollDistance + 150 && currentProgress === 1) return;

      const p = Math.max(0, Math.min(1, (scrollY - box.top) / scrollDistance));

      if (
        mobileQuery.matches ||
        prefersReducedMotionRef.current ||
        !hasInitialProgress
      ) {
        hasInitialProgress = true;
        currentProgress = p;
        targetProgress = p;
        if (duration > 0) {
          performSeek(p * duration);
        }
        updateStages(p);
      } else {
        targetProgress = p;
      }
    };

    const loadVideoSource = (src: string, preserveProgress = false) => {
      if (!video || currentSrc === src) return;
      currentSrc = src;
      const savedProgress = preserveProgress ? currentProgress : null;

      const onLoadedMetadata = () => {
        video.removeEventListener("loadedmetadata", onLoadedMetadata);
        duration = video.duration || 0;
        updateScrollProgress();
        if (savedProgress !== null) {
          currentProgress = savedProgress;
          targetProgress = savedProgress;
        }
        if (duration > 0) {
          performSeek(currentProgress * duration);
        }
        video.style.opacity = "1";
      };

      video.addEventListener("loadedmetadata", onLoadedMetadata);
      video.src = src;
      video.load();

      if (video.readyState >= 1) {
        onLoadedMetadata();
      }
    };

    if (video) {
      loadVideoSource(getVideoSrc(mobileQuery.matches), false);
    }

    const handleMediaChange = (e: MediaQueryListEvent) => {
      const newSrc = getVideoSrc(e.matches);
      if (newSrc !== currentSrc) {
        loadVideoSource(newSrc, true);
      }
    };

    let scrollRafId = 0;
    const handleScroll = () => {
      isScrolling = true;
      if (scrollStopTimer) clearTimeout(scrollStopTimer);
      scrollStopTimer = setTimeout(() => {
        isScrolling = false;
        if (!mobileQuery.matches && currentProgress !== targetProgress) {
          currentProgress = targetProgress;
          updateStages(targetProgress);
          if (duration > 0) performSeek(targetProgress * duration);
        }
      }, 60);

      startAnimationLoop();

      if (scrollRafId) return;
      scrollRafId = requestAnimationFrame(() => {
        scrollRafId = 0;
        updateScrollProgress();
      });
    };

    mobileQuery.addEventListener("change", handleMediaChange);
    window.addEventListener("scroll", handleScroll, { passive: true });

    const startTime = performance.now();

    // Petal drawing helper
    const drawPetal = (
      p: Petal,
      pX: number,
      pY: number,
      parallaxScale: number,
    ) => {
      const depthScale = Math.max(0.4, (p.z + 100) / 100);
      const renderX = p.x + pX * parallaxScale * depthScale;
      const renderY = p.y + pY * parallaxScale * depthScale;

      // Depth of field: foreground and distant petals soften, mid ones stay sharp.
      let alpha = 0.88;
      let blur = 0;
      if (p.z > 50) {
        alpha = 0.72;
        blur = 1.5;
      } else if (p.z < -20) {
        alpha = 0.55;
        blur = 1.8;
      }

      // A petal's size and depth never change, so this resolves to a cached
      // sprite on every frame after the first.
      const sprite = petalSprite(
        Math.round(p.size * depthScale),
        alpha,
        blur,
        dpr,
      );

      ctx.save();
      ctx.translate(renderX, renderY);
      ctx.rotate(p.rotation);
      ctx.scale(Math.cos(p.tilt), p.aspect);
      ctx.drawImage(
        sprite.image,
        -sprite.box / 2,
        -sprite.box / 2,
        sprite.box,
        sprite.box,
      );
      ctx.restore();
    };

    // Main animation loop
    const render = (now: number) => {
      if (!isVisible) {
        animationFrameId = 0;
        return;
      }

      const isReducedMotion = prefersReducedMotionRef.current;
      const elapsed = isReducedMotion ? 0 : now - startTime;

      // On desktop, adaptive fast-catchup lerp. Prioritizes user scroll velocity and handles reversals instantaneously.
      if (!mobileQuery.matches && !isReducedMotion) {
        const diff = targetProgress - currentProgress;
        const absDiff = Math.abs(diff);
        if (absDiff > 0.0001) {
          const isReversal =
            (diff > 0 && lastProgressDiff < 0) ||
            (diff < 0 && lastProgressDiff > 0);
          lastProgressDiff = diff;
          // Reversals and large fast scrolls catch up aggressively (0.9), normal scrolls smooth over 2 frames (0.45)
          const factor =
            isReversal || absDiff > 0.04 ? 0.9 : absDiff > 0.015 ? 0.65 : 0.45;
          currentProgress += diff * factor;
          if (Math.abs(targetProgress - currentProgress) < 0.0003) {
            currentProgress = targetProgress;
          }
          if (duration > 0) {
            performSeek(currentProgress * duration);
          }
          updateStages(currentProgress);
        }
      }

      // Smooth mouse lerp
      const m = mouseRef.current;
      m.x += (m.targetX - m.x) * 0.045;
      m.y += (m.targetY - m.y) * 0.045;

      // Direct DOM transform for 60fps GPU acceleration without React re-renders.
      // Suppressed during active scrolling to prevent compositor texture contention.
      const shiftX = m.x * -12;
      const shiftY = m.y * -8;
      if (
        !isScrolling &&
        !mobileQuery.matches &&
        backdropRef.current &&
        (Math.abs(shiftX - lastShiftX) > 0.05 ||
          Math.abs(shiftY - lastShiftY) > 0.05)
      ) {
        lastShiftX = shiftX;
        lastShiftY = shiftY;
        backdropRef.current.style.transform = `translate3d(${shiftX}px, ${shiftY}px, 0) scale(1.05)`;
      }

      // Clear canvas
      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, height);

      // Update & Draw Floating White Flower Petals
      for (const p of petals) {
        if (!isReducedMotion) {
          p.y += p.fallSpeed;
          p.x += Math.sin(elapsed * p.swayFreq + p.swayPhase) * p.swayAmp;
          p.rotation += p.rotSpeed;
          p.tilt += p.tiltSpeed;

          // Wrap around seamlessly
          if (p.y > height + 25) {
            p.y = -25;
            p.x = Math.random() * width;
          }
          if (p.x > width + 25) p.x = -25;
          if (p.x < -25) p.x = width + 25;
        }

        drawPetal(p, m.x, m.y, 20);
      }

      ctx.restore();

      if (!isReducedMotion) {
        animationFrameId = requestAnimationFrame(render);
      } else {
        animationFrameId = 0;
      }
    };

    startAnimationLoop = () => {
      if (!animationFrameId && isVisible && !prefersReducedMotionRef.current) {
        animationFrameId = requestAnimationFrame(render);
      }
    };

    stopAnimationLoop = () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = 0;
      }
    };

    startAnimationLoop();

    return () => {
      stopAnimationLoop();
      if (scrollRafId) cancelAnimationFrame(scrollRafId);
      if (scheduledSeekRaf) cancelAnimationFrame(scheduledSeekRaf);
      if (scrollStopTimer) clearTimeout(scrollStopTimer);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", handleMouseMove);
      container.removeEventListener("mouseleave", handleMouseLeave);
      observer.disconnect();
      motionQuery.removeEventListener("change", handleMotionChange);
      mobileQuery.removeEventListener("change", handleMediaChange);
      window.removeEventListener("scroll", handleScroll);
      if (video) {
        video.removeEventListener("seeked", handleSeeked);
      }
    };
  }, []);

  return (
    <section
      ref={containerRef}
      className="cinematic-scroll-section"
      aria-label="Cinematic Boutique Showcase"
    >
      <div className="cinematic-sticky-stage">
        {/* Layer 1: Background Video + Atmospheric Gradient */}
        <div className="luxury-hero-3d-wrap">
          <div
            ref={backdropRef}
            className="luxury-hero-backdrop-img"
            style={{
              position: "absolute",
              inset: "-3%",
              width: "106%",
              height: "106%",
              transform: "scale(1.05)",
            }}
          >
            <video
              ref={videoRef}
              className="luxury-hero-video-element"
              muted
              playsInline
              preload="auto"
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "cover",
                objectPosition,
                pointerEvents: "none",
                opacity: 0,
                transition: "opacity 0.35s ease",
                transform: "translateZ(0)",
                willChange: "transform",
                backfaceVisibility: "hidden",
              }}
            />
            {/* Soft atmospheric gradient to guarantee 100% typography & card contrast */}
            <div className="luxury-hero-contrast-overlay" />
          </div>

          {/* Layer 2: Real-time 3D Canvas (Floating Mogra Petals with Depth-of-Field) */}
          <canvas ref={canvasRef} className="luxury-hero-canvas" />
        </div>

        {/* Layer 3: Interactive Foreground Content Stages */}
        <div className="cinematic-foreground-container">
          {/* Stage 1: Brand Invitation & Heading */}
          <div
            ref={stage1Ref}
            className="cinematic-stage cinematic-stage-1"
            data-active="true"
          >
            <div
              className="container"
              style={{ maxWidth: "1000px", textAlign: "center" }}
            >
              <p className="eyebrow">FIND YOUR EXPRESSION</p>
              <h2 className="cinematic-heading">
                A style for <em>every you.</em>
              </h2>
              <p className="cinematic-subheading">
                Discover a thoughtful edit of Indian wear. Designed for the
                everyday, the extraordinary, and everything in between.
              </p>
              <div
                className="button-row"
                style={{ justifyContent: "center", marginTop: "24px" }}
              >
                <Link className="button" href="/shop">
                  Explore all pieces <ArrowUpRight size={16} />
                </Link>
                <Link className="button outline" href="/shop?new=true">
                  New arrivals <ArrowRight size={15} />
                </Link>
              </div>
            </div>
          </div>

          {/* Stage 2: The Curated Category Cards */}
          <div
            ref={stage2Ref}
            className="cinematic-stage cinematic-stage-2"
          >
            <div className="container">
              <div className="section-heading" style={{ marginBottom: "20px" }}>
                <div>
                  <p className="eyebrow">CURATED COLLECTIONS</p>
                  <h2 style={{ fontSize: "clamp(30px, 4vw, 44px)" }}>
                    The Boutique <em>Categories.</em>
                  </h2>
                </div>
                <Link className="text-link" href="/shop">
                  Shop all categories <ArrowUpRight size={16} />
                </Link>
              </div>
              {categories && categories.length > 0 && (
                <div className="category-grid">
                  {categories.map((c) => (
                    <Link
                      href={`/category/${c.slug}`}
                      className="category-card"
                      key={c.id}
                    >
                      <div className="category-image">
                        <Image
                          src={imageUrl(c.image)}
                          alt={c.name}
                          fill
                          sizes="(max-width: 600px) 48vw, (max-width: 1200px) 25vw, 280px"
                        />
                        <span className="round-arrow">
                          <ArrowUpRight size={19} />
                        </span>
                      </div>
                      <h3>{c.name}</h3>
                      <p>{c.description}</p>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Stage 3: New Arrivals / Spotlight Pieces */}
          {showArrivals && (
            <div
              ref={stage3Ref}
              className="cinematic-stage cinematic-stage-3"
            >
              <div className="container">
                <div className="section-heading" style={{ marginBottom: "20px" }}>
                  <div>
                    <p className="eyebrow">FRESH FROM OUR EDIT</p>
                    <h2 style={{ fontSize: "clamp(30px, 4vw, 44px)" }}>
                      New & <em>noteworthy.</em>
                    </h2>
                  </div>
                  <Link className="text-link" href="/shop?new=true">
                    Explore all new arrivals <ArrowUpRight size={16} />
                  </Link>
                </div>
                {arrivals && arrivals.length > 0 && (
                  <div className="product-grid">
                    {arrivals.map((p) => (
                      <ProductCard
                        key={p.id}
                        product={p}
                        threshold={lowStockThreshold}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Stage 4: The Occasion Edit ("Made for memorable moments.") */}
          {showFeatured && featured && (
            <div
              ref={stage4Ref}
              className="cinematic-stage cinematic-stage-4"
            >
              <div className="container" style={{ maxWidth: "1080px" }}>
                <div className="cinematic-featured-card">
                  <div className="cinematic-featured-image">
                    <Image
                      src={imageUrl(featuredImage || featured.image)}
                      alt={featured.name || featuredTitle}
                      fill
                      sizes="(max-width: 767px) 100vw, (max-width: 1200px) 50vw, 540px"
                    />
                  </div>
                  <div className="cinematic-featured-content">
                    <p className="eyebrow light">THE OCCASION EDIT</p>
                    <h2>{featuredTitle}</h2>
                    <div className="gold-line" />
                    <p>{featuredDescription || featured.description}</p>
                    <Link
                      className="button gold-outline"
                      href={`/collections/${featured.slug}`}
                    >
                      Explore the collection <ArrowUpRight size={17} />
                    </Link>
                    <div className="featured-decoration" aria-hidden="true">
                      <Flower2 size={90} strokeWidth={0.5} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Stage 5: The Boutique Favourites (Best Sellers: "Pieces to fall for.") */}
          {showBestSellers && (
            <div
              ref={stage5Ref}
              className="cinematic-stage cinematic-stage-5"
            >
              <div className="container">
                <div className="section-heading" style={{ marginBottom: "20px" }}>
                  <div>
                    <p className="eyebrow">THE BOUTIQUE FAVOURITES</p>
                    <h2 style={{ fontSize: "clamp(30px, 4vw, 44px)" }}>
                      Pieces to <em>fall for.</em>
                    </h2>
                  </div>
                  <Link className="text-link" href="/shop?best=true">
                    Explore the edit <ArrowUpRight size={16} />
                  </Link>
                </div>
                {bestSellers && bestSellers.length > 0 ? (
                  <div className="product-grid">
                    {bestSellers.map((p) => (
                      <ProductCard
                        key={p.id}
                        product={p}
                        threshold={lowStockThreshold}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="empty-state">
                    Pieces will be added to favourites soon.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Stage 6: The Promo Edit ("A MOMENT TO MAKE YOUR OWN") */}
          {showPromo && promoImage && (
            <div
              ref={stage6Ref}
              className="cinematic-stage cinematic-stage-6"
            >
              <div className="container" style={{ maxWidth: "1000px" }}>
                <div className="cinematic-promo-card">
                  <Image
                    src={imageUrl(promoImage)}
                    alt={promoHeading}
                    fill
                    sizes="(max-width: 600px) 100vw, (max-width: 1200px) 90vw, 1000px"
                  />
                  <div className="hero-shade" />
                  <div className="cinematic-promo-content">
                    <p className="eyebrow light">A MOMENT TO MAKE YOUR OWN</p>
                    <h2>{promoHeading}</h2>
                    <p>{promoSubtitle}</p>
                    <Link className="button gold-outline" href={promoUrl}>
                      {promoText}
                      <ArrowUpRight size={16} />
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
