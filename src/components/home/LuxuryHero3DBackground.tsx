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

export function LuxuryHero3DBackground() {
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

    const resize = () => {
      const rect = container.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      dpr = Math.min(window.devicePixelRatio || 1, 2);

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
      const rect = container.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
      const y = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
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
      _time: number,
      pX: number,
      pY: number,
      parallaxScale: number,
    ) => {
      const depthScale = Math.max(0.4, (p.z + 100) / 100);
      const renderX = p.x + pX * parallaxScale * depthScale;
      const renderY = p.y + pY * parallaxScale * depthScale;
      const currentSize = p.size * depthScale;

      ctx.save();
      ctx.translate(renderX, renderY);
      ctx.rotate(p.rotation);
      ctx.scale(Math.cos(p.tilt), p.aspect);

      // Depth of field blur emulation
      let alpha = 0.88;
      if (p.z > 50) {
        // Foreground soft blur
        ctx.filter = "blur(1.5px)";
        alpha = 0.72;
      } else if (p.z < -20) {
        // Distant soft blur
        ctx.filter = "blur(1.8px)";
        alpha = 0.55;
      } else {
        ctx.filter = "none";
      }

      // Elegant organic petal silhouette (delicate white mogra / jasmine petal)
      ctx.beginPath();
      ctx.moveTo(0, -currentSize);
      ctx.bezierCurveTo(
        currentSize * 0.8,
        -currentSize * 0.65,
        currentSize * 0.9,
        currentSize * 0.45,
        0,
        currentSize,
      );
      ctx.bezierCurveTo(
        -currentSize * 0.9,
        currentSize * 0.45,
        -currentSize * 0.8,
        -currentSize * 0.65,
        0,
        -currentSize,
      );
      ctx.closePath();

      // Shading gradient: pure silky ivory with subtle warm champagne reflection
      const grad = ctx.createLinearGradient(0, -currentSize, 0, currentSize);
      grad.addColorStop(0, `rgba(255, 255, 255, ${alpha})`);
      grad.addColorStop(0.4, `rgba(253, 250, 242, ${alpha * 0.95})`);
      grad.addColorStop(0.85, `rgba(243, 235, 215, ${alpha * 0.85})`);
      grad.addColorStop(1, `rgba(228, 214, 185, ${alpha * 0.65})`);

      ctx.fillStyle = grad;
      ctx.fill();

      // Delicate subtle petal vein highlight
      ctx.beginPath();
      ctx.moveTo(0, -currentSize * 0.75);
      ctx.quadraticCurveTo(currentSize * 0.08, 0, 0, currentSize * 0.65);
      ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.55})`;
      ctx.lineWidth = 0.75;
      ctx.stroke();

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

      // Direct DOM transform for 60fps GPU acceleration without React re-renders
      if (backdropRef.current) {
        backdropRef.current.style.transform = `translate3d(${m.x * -12}px, ${m.y * -8}px, 0) scale(1.05)`;
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

        drawPetal(p, elapsed, m.x, m.y, 20);
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
          priority
          sizes="100vw"
          className="luxury-hero-img-element"
        />
        {/* Soft atmospheric gradient to guarantee 100% typography contrast on the left */}
        <div className="luxury-hero-contrast-overlay" />
      </div>

      {/* Layer 2: Real-time 3D Canvas (Floating Mogra Petals with Depth-of-Field) */}
      <canvas ref={canvasRef} className="luxury-hero-canvas" />
    </div>
  );
}
