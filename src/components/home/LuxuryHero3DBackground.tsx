"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";

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
  priority?: boolean;
  objectPosition?: string;
}

export function LuxuryHero3DBackground({
  priority = false,
  objectPosition = "center 36%",
}: LuxuryHero3DBackgroundProps = {}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
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
      if (w < 768) return 10; // Mobile
      if (w < 1024) return 18; // Tablet
      return 30; // Desktop
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

    // Container box in document coordinates. Keeping it here lets mousemove
    // derive the viewport-relative rect without a layout read on every event,
    // which previously forced a synchronous layout flush mid-scroll.
    let box = { left: 0, top: 0, width: 1, height: 1 };

    const resize = () => {
      const rect = container.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
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
    };

    resize();
    window.addEventListener("resize", resize);

    // Mouse parallax tracking
    const handleMouseMove = (e: MouseEvent) => {
      if (window.innerWidth < 768) return; // Disable mouse parallax on mobile
      const x =
        ((e.clientX - (box.left - window.scrollX)) / box.width - 0.5) * 2;
      const y =
        ((e.clientY - (box.top - window.scrollY)) / box.height - 0.5) * 2;
      mouseRef.current.targetX = Math.max(-1, Math.min(1, x));
      mouseRef.current.targetY = Math.max(-1, Math.min(1, y));
    };

    const handleMouseLeave = () => {
      mouseRef.current.targetX = 0;
      mouseRef.current.targetY = 0;
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    container.addEventListener("mouseleave", handleMouseLeave);

    // Visibility observer to pause loop when offscreen
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          isVisible = entry.isIntersecting;
        });
      },
      { threshold: 0.05 },
    );
    observer.observe(container);

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
        animationFrameId = requestAnimationFrame(render);
        return;
      }

      const isReducedMotion = prefersReducedMotionRef.current;
      const elapsed = isReducedMotion ? 0 : now - startTime;

      // Smooth mouse lerp
      const m = mouseRef.current;
      m.x += (m.targetX - m.x) * 0.045;
      m.y += (m.targetY - m.y) * 0.045;

      // Direct DOM transform for 60fps GPU acceleration without React re-renders.
      // The lerp approaches its target asymptotically, so writing every frame
      // kept mutating a layer that is `will-change: transform` and carries a
      // viewport-sized `filter`, re-rasterising it forever. Only write real
      // movement, so a settled scene costs zero style work.
      const shiftX = m.x * -12;
      const shiftY = m.y * -8;
      if (
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
      }
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", handleMouseMove);
      container.removeEventListener("mouseleave", handleMouseLeave);
      observer.disconnect();
      motionQuery.removeEventListener("change", handleMotionChange);
    };
  }, []);

  return (
    <div ref={containerRef} className="luxury-hero-3d-wrap" aria-hidden="true">
      {/* Layer 1: Clean Architectural Stone Arches Backdrop */}
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
        <Image
          src="/images/hero-3d-bg.jpg"
          alt=""
          fill
          priority={priority}
          sizes="100vw"
          className="luxury-hero-img-element"
          style={{ objectPosition }}
        />
        {/* Soft atmospheric gradient to guarantee 100% typography contrast on the left */}
        <div className="luxury-hero-contrast-overlay" />
      </div>

      {/* Layer 2: Real-time 3D Canvas (Floating Mogra Petals with Depth-of-Field) */}
      <canvas ref={canvasRef} className="luxury-hero-canvas" />
    </div>
  );
}
