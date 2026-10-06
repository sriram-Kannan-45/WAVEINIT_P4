"use client";

import { useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { Product, Taxonomy } from "@/types";

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
  box: number;
}

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
  sprite.scale(dpr, dpr);
  sprite.translate(box / 2, box / 2);
  if (blur) sprite.filter = `blur(${blur}px)`;

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

  const grad = sprite.createLinearGradient(0, -size, 0, size);
  grad.addColorStop(0, `rgba(255, 255, 255, ${alpha})`);
  grad.addColorStop(0.4, `rgba(253, 250, 242, ${alpha * 0.95})`);
  grad.addColorStop(0.85, `rgba(243, 235, 215, ${alpha * 0.85})`);
  grad.addColorStop(1, `rgba(228, 214, 185, ${alpha * 0.65})`);
  sprite.fillStyle = grad;
  sprite.fill();

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

export interface OutfitItem {
  id: string;
  number: string;
  category: string;
  title: string;
  image: string;
  href: string;
  width: number;
  height: number;
}

export const CAMPAIGN_OUTFITS: OutfitItem[] = [
  {
    id: "saree",
    number: "01",
    category: "Sarees",
    title: "Emerald Silk Saree",
    image: "/pic/Elegant Emerald Green Saree Portrait.webp",
    href: "/shop?category=sarees",
    width: 1024,
    height: 1536,
  },
  {
    id: "kurti",
    number: "02",
    category: "Kurtis",
    title: "Ivory Embroidered Kurta Set",
    image: "/pic/Elegant Ivory Embroidered Anarkali Portrait.webp",
    href: "/shop?category=kurtis",
    width: 1024,
    height: 1536,
  },
  {
    id: "top",
    number: "03",
    category: "Tops",
    title: "Wine Occasion Ensemble",
    image: "/pic/Maroon Embroidered Anarkali Portrait.webp",
    href: "/shop?category=tops",
    width: 1024,
    height: 1536,
  },
  {
    id: "leggings",
    number: "04",
    category: "Leggings",
    title: "Navy Festive Suit Set",
    image: "/pic/Elegant Navy Indian Ensemble.webp",
    href: "/shop?category=leggings",
    width: 1024,
    height: 1536,
  },
  {
    id: "ethnic",
    number: "05",
    category: "Ethnic Wear",
    title: "Lavender Lilac Palazzo Set",
    image: "/pic/Lavender Embroidered Anarkali Portrait.webp",
    href: "/shop?category=ethnic-wear",
    width: 1024,
    height: 1536,
  },
];

interface LuxuryHero3DBackgroundProps {
  categories?: Taxonomy[];
  arrivals?: Product[];
  lowStockThreshold?: number;
  objectPosition?: string;
}

export function LuxuryHero3DBackground({
  objectPosition = "center 36%",
}: LuxuryHero3DBackgroundProps = {}) {
  const containerRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const prefersReducedMotionRef = useRef(false);
  const mouseRef = useRef({ x: 0, y: 0, targetX: 0, targetY: 0 });

  const cutoutLayersRef = useRef<(HTMLDivElement | null)[]>([]);
  const cutoutImagesRef = useRef<(HTMLImageElement | null)[]>([]);
  const preloadedImagesRef = useRef<Set<number>>(new Set());
  const paginationDotsRef = useRef<(HTMLButtonElement | null)[]>([]);
  const timelineItemsRef = useRef<(HTMLButtonElement | null)[]>([]);
  const timelineFillRef = useRef<HTMLDivElement | null>(null);

  // Jump to specific outfit when clicking an indicator
  const scrollToOutfit = useCallback((index: number) => {
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const scrollY = window.scrollY;
    const viewportH = window.innerHeight;
    const scrollDist = Math.max(1, rect.height - viewportH);
    const targetProgressVal = (index + 0.5) / CAMPAIGN_OUTFITS.length;
    const targetY = rect.top + scrollY + targetProgressVal * scrollDist;
    window.scrollTo({ top: targetY, behavior: "smooth" });
  }, []);

  // Pre-decode all 5 outfit images off-thread to eliminate first-visibility decode lag
  useEffect(() => {
    CAMPAIGN_OUTFITS.forEach((outfit, idx) => {
      // 1. Offscreen Image decode to prime browser image cache with exact WebP source
      const offscreen = new window.Image();
      offscreen.src = outfit.image;
      if (typeof offscreen.decode === "function") {
        offscreen.decode().catch(() => {});
      }
      // 2. Decode the mounted DOM <img> element directly
      const domImg = cutoutImagesRef.current[idx];
      if (domImg && typeof domImg.decode === "function") {
        domImg.decode().catch(() => {});
      }
    });
  }, []);

  useEffect(() => {
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
    let lastShiftX = Number.POSITIVE_INFINITY;
    let lastShiftY = Number.POSITIVE_INFINITY;
    let lastTick = 0;

    const getPetalCount = (w: number) => {
      if (w < 768) return 6;
      if (w < 1024) return 12;
      return 16;
    };

    let petals: Petal[] = [];

    const initPetals = () => {
      const count = getPetalCount(width);
      petals = Array.from({ length: count }, (_, i) => ({
        x: Math.random() * width,
        y: Math.random() * height,
        z: (Math.random() - 0.3) * 120,
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

    let sectionTop = 0;
    let scrollDistance = 1;
    // Flag: refresh geometry once when user first scrolls into the hero section.
    // This corrects any stale sectionTop from mount-time measurement (before intro
    // layout fully settles with fonts/images loaded).
    let hasRefreshedGeometryOnApproach = false;

    const updateGeometry = () => {
      if (!container) return;
      const rect = container.getBoundingClientRect();
      sectionTop = rect.top + window.scrollY;
      const vh = window.innerHeight;
      scrollDistance = Math.max(1, rect.height - vh);
    };

    let updateScrollProgress: () => void = () => {};

    const resize = () => {
      const isMobileMatch = mobileQuery.matches;
      const stickyStage = container.querySelector<HTMLElement>(
        ".cinematic-sticky-stage",
      );
      const stageRect = stickyStage
        ? stickyStage.getBoundingClientRect()
        : container.getBoundingClientRect();
      width = stageRect.width || window.innerWidth;
      height = stageRect.height || window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, isMobileMatch ? 1 : 1.5);

      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      initPetals();
      updateGeometry();
      updateScrollProgress();
    };

    resize();
    window.addEventListener("resize", resize);

    // Mouse parallax tracking (desktop only)
    const handleMouseMove = (e: MouseEvent) => {
      if (mobileQuery.matches) return;
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

    let startAnimationLoop = () => {};
    let stopAnimationLoop = () => {};

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          isVisible = entry.isIntersecting;
          if (isVisible) {
            updateGeometry();
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
    // Responsive Scroll-Controlled Master Video Controller
    // -------------------------------------------------------------
    const video = videoRef.current;
    let currentSrc = "";
    let duration = 10.0;
    let isSeeking = false;
    let pendingTime: number | null = null;
    let lastSoughtFrame = -1;
    let lastSeekTime = 0;
    let currentProgress = 0;
    let targetProgress = 0;
    let hasInitialProgress = false;
    let isScrolling = false;
    let scrollStopTimer: ReturnType<typeof setTimeout> | null = null;
    const isMobileDevice = mobileQuery.matches;
    const targetFps = isMobileDevice ? 18 : 30;
    const frameDuration = 1 / targetFps;

    const getVideoSrc = (matchesMobile: boolean) =>
      matchesMobile
        ? "/videos/Mobile.mp4"
        : "/videos/laptop-resolution.mp4";

    const executeSeek = (quantizedTime: number) => {
      if (!video) return;
      isSeeking = true;
      lastSeekTime = performance.now();
      try {
        const videoWithFastSeek = video as HTMLVideoElement & {
          fastSeek?: (time: number) => void;
        };
        if (typeof videoWithFastSeek.fastSeek === "function") {
          videoWithFastSeek.fastSeek(quantizedTime);
          return;
        }
        video.currentTime = quantizedTime;
      } catch {
        isSeeking = false;
      }
    };

    const performSeek = (targetTime: number) => {
      if (!video) return;
      const dur = duration > 0 ? duration : 10.0;
      // Clamp to duration - 0.04 to prevent seeking past EOF which causes freeze or black frames
      const clamped = Math.max(0, Math.min(dur - 0.04, targetTime));
      const frameIndex = Math.round(clamped / frameDuration);
      if (frameIndex === lastSoughtFrame) return;

      const quantizedTime = frameIndex * frameDuration;
      lastSoughtFrame = frameIndex;

      const now = performance.now();

      // Reset isSeeking if browser completed seek or on 300ms watchdog
      if (isSeeking && (!video.seeking || now - lastSeekTime > 300)) {
        isSeeking = false;
      }

      const minInterval = mobileQuery.matches ? 70 : 25;
      if (isSeeking || now - lastSeekTime < minInterval) {
        pendingTime = quantizedTime;
        return;
      }

      executeSeek(quantizedTime);
    };

    let seekRafId = 0;
    const handleSeeked = () => {
      isSeeking = false;
      if (pendingTime !== null) {
        const next = pendingTime;
        pendingTime = null;
        const now = performance.now();
        const minInterval = mobileQuery.matches ? 70 : 25;
        if (now - lastSeekTime < minInterval) {
          if (seekRafId) cancelAnimationFrame(seekRafId);
          seekRafId = requestAnimationFrame(() => {
            executeSeek(next);
          });
        } else {
          executeSeek(next);
        }
      }
    };

    if (video) {
      video.muted = true;
      video.playsInline = true;
      video.addEventListener("seeked", handleSeeked);
      if (video.duration && !isNaN(video.duration) && video.duration > 0) {
        duration = video.duration;
      }
    }

    // Independent Responsive Product Timeline: ENTER -> HOLD -> EXIT for each dress
    // On mobile, allocates a longer, more stable HOLD viewing phase and slower, more gradual crossfade transitions
    const computeDressState = (idx: number, p: number, isMobile: boolean) => {
      // On mobile, hw=0.055 gives a wider, more gradual crossfade (11% total).
      // On desktop, hw=0.028 keeps crisp, snappy transitions.
      const hw = isMobile ? 0.055 : 0.028;
      // Boundaries shifted slightly inward to lengthen each outfit's HOLD window:
      // 0→0.17 dress-0 hold | 0.17→0.38 dress-1 | 0.38→0.58 dress-2 | 0.58→0.78 dress-3 | 0.78→1 dress-4
      const b0 = 0.17;
      const b1 = 0.38;
      const b2 = 0.58;
      const b3 = 0.78;

      // Smootherstep easing function: 6t^5 - 15t^4 + 10t^3 (zero 1st & 2nd derivatives at endpoints)
      const smootherstep = (t: number) => {
        const clampedT = Math.max(0, Math.min(1, t));
        return clampedT * clampedT * clampedT * (clampedT * (clampedT * 6 - 15) + 10);
      };

      // Gentle vertical translation cues:
      // On mobile: subtle 6px entry, -5px exit (avoids visual jumping on narrow phone screens)
      // On desktop: 16px entry, -12px exit
      const enterOffset = isMobile ? 6 : 16;
      const exitOffset = isMobile ? -5 : -12;

      let opacity = 0;
      let offsetY = 0;

      if (idx === 0) {
        if (p <= b0 - hw) {
          // Solid, extended HOLD
          opacity = 1;
          offsetY = 0;
        } else if (p < b0 + hw) {
          // Slower, gradual EXIT crossfade
          const t = (p - (b0 - hw)) / (2 * hw);
          const ease = smootherstep(t);
          opacity = 1 - ease;
          offsetY = exitOffset * ease;
        } else {
          opacity = 0;
          offsetY = exitOffset;
        }
      } else if (idx === 1) {
        if (p <= b0 - hw) {
          opacity = 0;
          offsetY = enterOffset;
        } else if (p < b0 + hw) {
          // Slower, gradual ENTER crossfade
          const t = (p - (b0 - hw)) / (2 * hw);
          const ease = smootherstep(t);
          opacity = ease;
          offsetY = enterOffset * (1 - ease);
        } else if (p <= b1 - hw) {
          // Solid, extended HOLD phase
          opacity = 1;
          offsetY = 0;
        } else if (p < b1 + hw) {
          // Slower, gradual EXIT crossfade
          const t = (p - (b1 - hw)) / (2 * hw);
          const ease = smootherstep(t);
          opacity = 1 - ease;
          offsetY = exitOffset * ease;
        } else {
          opacity = 0;
          offsetY = exitOffset;
        }
      } else if (idx === 2) {
        if (p <= b1 - hw) {
          opacity = 0;
          offsetY = enterOffset;
        } else if (p < b1 + hw) {
          // Slower, gradual ENTER crossfade
          const t = (p - (b1 - hw)) / (2 * hw);
          const ease = smootherstep(t);
          opacity = ease;
          offsetY = enterOffset * (1 - ease);
        } else if (p <= b2 - hw) {
          // Solid, extended HOLD phase
          opacity = 1;
          offsetY = 0;
        } else if (p < b2 + hw) {
          // Slower, gradual EXIT crossfade
          const t = (p - (b2 - hw)) / (2 * hw);
          const ease = smootherstep(t);
          opacity = 1 - ease;
          offsetY = exitOffset * ease;
        } else {
          opacity = 0;
          offsetY = exitOffset;
        }
      } else if (idx === 3) {
        if (p <= b2 - hw) {
          opacity = 0;
          offsetY = enterOffset;
        } else if (p < b2 + hw) {
          // Slower, gradual ENTER crossfade
          const t = (p - (b2 - hw)) / (2 * hw);
          const ease = smootherstep(t);
          opacity = ease;
          offsetY = enterOffset * (1 - ease);
        } else if (p <= b3 - hw) {
          // Solid, extended HOLD phase
          opacity = 1;
          offsetY = 0;
        } else if (p < b3 + hw) {
          // Slower, gradual EXIT crossfade
          const t = (p - (b3 - hw)) / (2 * hw);
          const ease = smootherstep(t);
          opacity = 1 - ease;
          offsetY = exitOffset * ease;
        } else {
          opacity = 0;
          offsetY = exitOffset;
        }
      } else if (idx === 4) {
        if (p <= b3 - hw) {
          opacity = 0;
          offsetY = enterOffset;
        } else if (p < b3 + hw) {
          // Slower, gradual ENTER crossfade
          const t = (p - (b3 - hw)) / (2 * hw);
          const ease = smootherstep(t);
          opacity = ease;
          offsetY = enterOffset * (1 - ease);
        } else {
          // Solid, extended HOLD phase
          opacity = 1;
          offsetY = 0;
        }
      }

      return { opacity, offsetY };
    };

    // Update active outfit metadata and apply scroll-driven ENTER -> HOLD -> EXIT layers (0 React re-renders)
    let lastActiveIdx = 0;
    const updateActiveOutfit = (p: number) => {
      const outfitCount = CAMPAIGN_OUTFITS.length;
      const rawIdx = Math.floor(p * outfitCount);
      const clampedIdx = Math.min(outfitCount - 1, Math.max(0, rawIdx));
      if (clampedIdx !== lastActiveIdx) {
        lastActiveIdx = clampedIdx;
        if (container) {
          container.setAttribute("data-active-outfit", String(clampedIdx));
        }

        // Fast batch class toggle on cached node arrays - zero React re-render!
        const layers = cutoutLayersRef.current;
        for (let i = 0; i < layers.length; i++) {
          const layer = layers[i];
          if (!layer) continue;
          const isActive = i === clampedIdx;
          layer.classList.toggle("active", isActive);
          layer.setAttribute("aria-hidden", String(!isActive));
        }

        const dots = paginationDotsRef.current;
        for (let i = 0; i < dots.length; i++) {
          dots[i]?.classList.toggle("active", i === clampedIdx);
        }

        const items = timelineItemsRef.current;
        for (let i = 0; i < items.length; i++) {
          items[i]?.classList.toggle("active", i === clampedIdx);
        }

        if (timelineFillRef.current) {
          const scale = (clampedIdx + 0.5) / outfitCount;
          timelineFillRef.current.style.transform = `scaleY(${scale})`;
        }
      }

      // Proactively pre-decode upcoming and preceding product images well before transition begins
      const nextIdx = Math.min(outfitCount - 1, clampedIdx + 1);
      const nextNextIdx = Math.min(outfitCount - 1, clampedIdx + 2);
      const prevIdx = Math.max(0, clampedIdx - 1);
      [nextIdx, nextNextIdx, prevIdx].forEach((targetIdx) => {
        if (cutoutImagesRef.current[targetIdx] && !preloadedImagesRef.current.has(targetIdx)) {
          cutoutImagesRef.current[targetIdx]?.decode().then(() => {
            preloadedImagesRef.current.add(targetIdx);
          }).catch(() => {});
        }
      });

      // Smooth scroll-driven ENTER -> HOLD -> EXIT crossfade on cached DOM layers
      const isMobile = mobileQuery.matches;
      const layers = cutoutLayersRef.current;
      for (let i = 0; i < layers.length; i++) {
        const layer = layers[i];
        if (!layer) continue;
        const { opacity, offsetY } = computeDressState(i, p, isMobile);
        if (opacity <= 0.001) {
          layer.style.opacity = "0";
          // Keep immediately adjacent layers in compositor tree at opacity 0 to prevent layer promotion hitch on mobile
          if (Math.abs(i - clampedIdx) <= 1) {
            layer.style.visibility = "visible";
          } else {
            layer.style.visibility = "hidden";
          }
        } else {
          layer.style.visibility = "visible";
          layer.style.opacity = opacity >= 0.999 ? "1" : opacity.toFixed(3);
          const transformStr = isMobile
            ? `translate3d(0, ${offsetY.toFixed(1)}px, 0)`
            : `translate3d(-50%, ${offsetY.toFixed(1)}px, 0)`;
          layer.style.transform = transformStr;
        }
      }
    };

    updateScrollProgress = () => {
      if (!isVisible || !container) return;
      const scrollY = window.scrollY;
      const p = Math.max(0, Math.min(1, (scrollY - sectionTop) / scrollDistance));
      targetProgress = p;

      if (!hasInitialProgress) {
        hasInitialProgress = true;
        currentProgress = p;
        performSeek(p * duration);
        updateActiveOutfit(p);
      }

      startAnimationLoop();
    };

    const loadVideoSource = (src: string, preserveProgress = false) => {
      if (!video) return;
      if (currentSrc === src && video.getAttribute("src") === src) return;
      currentSrc = src;
      const savedProgress = preserveProgress ? currentProgress : null;

      const onLoadedMetadata = () => {
        if (!video) return;
        video.removeEventListener("loadedmetadata", onLoadedMetadata);
        if (video.duration && !isNaN(video.duration) && video.duration > 0) {
          duration = video.duration;
        }
        updateScrollProgress();
        if (savedProgress !== null) {
          currentProgress = savedProgress;
          targetProgress = savedProgress;
        }

        const initialTime = Math.max(0, Math.min(duration - 0.04, currentProgress * duration));
        executeSeek(initialTime);

        // Prime video decoder on mobile so initial seek renders instantly
        if (mobileQuery.matches) {
          const playPromise = video.play();
          if (playPromise !== undefined) {
            playPromise.then(() => {
              video.pause();
              video.currentTime = initialTime;
            }).catch(() => {
              // Video auto-play policy: pause/currentTime handled
            });
          }
        }
        video.style.opacity = "1";
      };

      video.addEventListener("loadedmetadata", onLoadedMetadata);
      if (video.getAttribute("src") !== src) {
        video.src = src;
        video.load();
      }

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

    const handleScroll = () => {
      isScrolling = true;
      if (scrollStopTimer) clearTimeout(scrollStopTimer);
      scrollStopTimer = setTimeout(() => {
        isScrolling = false;
        // Guarantee final resting target frame is sought when scrolling stops
        if (video) {
          const dur = duration > 0 ? duration : 10.0;
          const finalTime = Math.max(0, Math.min(dur - 0.04, targetProgress * dur));
          isSeeking = false;
          pendingTime = null;
          executeSeek(finalTime);
        }
      }, 80);

      const scrollY = window.scrollY;

      // Re-measure geometry the first time scroll approaches the hero section.
      // This corrects stale sectionTop from the mount-time measurement which
      // can be wrong when the intro layout settles after fonts/images load.
      if (!hasRefreshedGeometryOnApproach && scrollY > sectionTop - 2 * window.innerHeight) {
        hasRefreshedGeometryOnApproach = true;
        updateGeometry();
      }

      targetProgress = Math.max(0, Math.min(1, (scrollY - sectionTop) / scrollDistance));

      startAnimationLoop();
    };

    mobileQuery.addEventListener("change", handleMediaChange);
    window.addEventListener("scroll", handleScroll, { passive: true });
    // On mobile, the visual viewport resizes when the address bar shows/hides.
    // Re-running resize() here keeps canvas dimensions and geometry fresh.
    window.visualViewport?.addEventListener("resize", resize, { passive: true });

    const startTime = performance.now();

    const drawPetal = (
      p: Petal,
      pX: number,
      pY: number,
      parallaxScale: number,
    ) => {
      const depthScale = Math.max(0.4, (p.z + 100) / 100);
      const renderX = p.x + pX * parallaxScale * depthScale;
      const renderY = p.y + pY * parallaxScale * depthScale;

      let alpha = 0.88;
      let blur = 0;
      if (!mobileQuery.matches) {
        if (p.z > 50) {
          alpha = 0.72;
          blur = 1.5;
        } else if (p.z < -20) {
          alpha = 0.55;
          blur = 1.8;
        }
      }

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

    const render = (now: number) => {
      if (!isVisible) {
        animationFrameId = 0;
        return;
      }

      const isReducedMotion = prefersReducedMotionRef.current;
      const elapsed = isReducedMotion ? 0 : now - startTime;
      const dt = Math.min(32, now - (lastTick || now - 16.67));
      lastTick = now;

      if (!isReducedMotion) {
        const diff = targetProgress - currentProgress;
        const absDiff = Math.abs(diff);
        if (absDiff > 0.00005) {
          const smoothSpeed = mobileQuery.matches ? 18 : 75;
          const followRate = Math.min(1, 1 - Math.exp(-dt / smoothSpeed));
          currentProgress += diff * followRate;

          if (Math.abs(targetProgress - currentProgress) < 0.0001) {
            currentProgress = targetProgress;
          }

          performSeek(currentProgress * duration);
          updateActiveOutfit(currentProgress);
        }
      }

      const m = mouseRef.current;
      m.x += (m.targetX - m.x) * 0.045;
      m.y += (m.targetY - m.y) * 0.045;

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

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, height);

      for (const p of petals) {
        if (!isReducedMotion) {
          p.y += p.fallSpeed;
          p.x += Math.sin(elapsed * p.swayFreq + p.swayPhase) * p.swayAmp;
          p.rotation += p.rotSpeed;
          p.tilt += p.tiltSpeed;

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

      if (!isReducedMotion || Math.abs(targetProgress - currentProgress) > 0.0001) {
        animationFrameId = requestAnimationFrame(render);
      } else {
        animationFrameId = 0;
      }
    };

    startAnimationLoop = () => {
      if (!animationFrameId && isVisible) {
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
      if (seekRafId) cancelAnimationFrame(seekRafId);
      if (scrollStopTimer) clearTimeout(scrollStopTimer);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", handleMouseMove);
      container.removeEventListener("mouseleave", handleMouseLeave);
      observer.disconnect();
      motionQuery.removeEventListener("change", handleMotionChange);
      mobileQuery.removeEventListener("change", handleMediaChange);
      window.removeEventListener("scroll", handleScroll);
      window.visualViewport?.removeEventListener("resize", resize);
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
        data-active-outfit="0"
      >
        <div className="cinematic-sticky-stage">
          {/* Layer 1: Master Continuous Background Video */}
          <div className="luxury-hero-3d-wrap">
            <div
              ref={backdropRef}
              className="luxury-hero-backdrop-img"
            >
              <video
                ref={videoRef}
                className="luxury-hero-video-element"
                muted
                playsInline
                preload="auto"
                suppressHydrationWarning
                style={{ objectPosition }}
              />
              {/* Soft atmospheric gradient */}
              <div className="luxury-hero-contrast-overlay" />
            </div>

            {/* Layer 2: Real-time 3D Canvas (Floating Mogra Petals) */}
            <canvas ref={canvasRef} className="luxury-hero-canvas" />
          </div>

          {/* Layer 3: Campaign Showcase Content Layer (Editorial Text + Isolated Cutouts + Indicator) */}
          <div className="hero-campaign-showcase">
            {/* Desktop & Mobile Left / Bottom Editorial Content */}
            <div className="hero-campaign-editorial">
              <p className="hero-campaign-eyebrow">TRADITION MEETS MODERN</p>
              <span className="hero-campaign-gold-line" aria-hidden="true" />
              <h1
                className="hero-campaign-headline"
                aria-label="Elegance, in every drape."
              >
                <span className="desktop-headline">
                  Elegance<br />
                  <em>in every drape.</em>
                </span>
                <span className="mobile-headline">
                  Elegant<br />
                  <em>Ethnic Wear</em>
                </span>
              </h1>
              <p className="hero-campaign-subtitle">
                Discover timeless ethnic wear crafted for your special moments.
              </p>
              <div className="hero-campaign-actions">
                <Link href="/shop" className="hero-cta-button">
                  <span>Explore Collection</span>
                  <ArrowRight size={16} />
                </Link>
              </div>

              {/* Bottom bar container: Left scroll prompt, Right pagination dots */}
              <div className="hero-campaign-bottom-bar">
                <div className="hero-scroll-prompt">
                  <div className="mouse-icon-pill">
                    <span className="mouse-wheel-dot" />
                  </div>
                  <span className="mouse-scroll-text">SCROLL TO EXPLORE</span>
                </div>

                <div className="hero-pagination-dots" aria-hidden="true">
                  {CAMPAIGN_OUTFITS.map((_, idx) => (
                    <button
                      key={idx}
                      ref={(el) => {
                        paginationDotsRef.current[idx] = el;
                      }}
                      type="button"
                      tabIndex={-1}
                      onClick={() => scrollToOutfit(idx)}
                      className={`pagination-dot ${idx === 0 ? "active" : ""}`}
                      aria-label={`Outfit ${idx + 1}`}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Center: Isolated Cutout Models Layered Above Video */}
            <div className="hero-campaign-stage" aria-live="polite">
              {CAMPAIGN_OUTFITS.map((outfit, idx) => {
                const isActive = idx === 0;
                return (
                  <div
                    key={outfit.id}
                    ref={(el) => {
                      cutoutLayersRef.current[idx] = el;
                    }}
                    className={`hero-model-cutout-layer ${isActive ? "active" : ""}`}
                    data-outfit-id={outfit.id}
                    data-outfit-number={outfit.number}
                    aria-hidden={!isActive}
                  >
                    <Image
                      ref={(el) => {
                        cutoutImagesRef.current[idx] = el;
                      }}
                      src={outfit.image}
                      alt={outfit.title}
                      width={outfit.width}
                      height={outfit.height}
                      priority
                      unoptimized
                      className="hero-cutout-image"
                      sizes="(max-width: 767px) 90vw, (max-width: 1200px) 60vw, 800px"
                    />
                  </div>
                );
              })}
            </div>

            {/* Right: Vertical Progress Indicator with Line & Dots */}
            <div
              className="hero-timeline-indicator"
              role="navigation"
              aria-label="Collection timeline"
            >
              <div className="timeline-line-track">
                <div
                  ref={timelineFillRef}
                  className="timeline-progress-fill"
                  style={{
                    transform: `scaleY(${(0 + 0.5) / CAMPAIGN_OUTFITS.length})`,
                  }}
                />
              </div>

              <div className="timeline-items-list">
                {CAMPAIGN_OUTFITS.map((item, idx) => {
                  const isActive = idx === 0;
                  return (
                    <button
                      key={item.id}
                      ref={(el) => {
                        timelineItemsRef.current[idx] = el;
                      }}
                      type="button"
                      className={`timeline-item ${isActive ? "active" : ""}`}
                      onClick={() => scrollToOutfit(idx)}
                      aria-label={`Jump to ${item.number} ${item.category}`}
                    >
                      <span className="timeline-dot" />
                      <span className="timeline-label">
                        <strong>{item.number}</strong> {item.category}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </section>
  );
}
