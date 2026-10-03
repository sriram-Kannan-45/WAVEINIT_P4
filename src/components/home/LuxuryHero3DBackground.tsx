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
      if (w < 768) return 8; // Mobile
      if (w < 1024) return 14; // Tablet
      return 26; // Desktop
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
      time: number,
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

    // 3D Ring drawing helper
    const draw3DRing = (
      cx: number,
      cy: number,
      radiusX: number,
      radiusY: number,
      tiltAngle: number,
      rotAngle: number,
      pX: number,
      pY: number,
      parallaxMult: number,
      strokeWidth: number,
      opacity: number,
    ) => {
      ctx.save();
      ctx.translate(cx + pX * parallaxMult, cy + pY * parallaxMult);
      ctx.rotate(tiltAngle);

      // 3D perspective simulated via scale and rotation
      const cosRot = Math.cos(rotAngle);

      ctx.beginPath();
      ctx.ellipse(
        0,
        0,
        radiusX,
        radiusY * Math.abs(cosRot) + 6,
        rotAngle * 0.4,
        0,
        Math.PI * 2,
      );

      // Metallic gold gradient stroke with specular shine
      const grad = ctx.createLinearGradient(
        -radiusX,
        -radiusY,
        radiusX,
        radiusY,
      );
      grad.addColorStop(0, `rgba(180, 142, 60, ${opacity * 0.4})`);
      grad.addColorStop(0.25, `rgba(255, 248, 220, ${opacity * 0.95})`);
      grad.addColorStop(0.5, `rgba(218, 175, 70, ${opacity * 0.7})`);
      grad.addColorStop(0.75, `rgba(255, 242, 195, ${opacity * 0.9})`);
      grad.addColorStop(1, `rgba(160, 120, 45, ${opacity * 0.5})`);

      ctx.strokeStyle = grad;
      ctx.lineWidth = strokeWidth;
      ctx.shadowColor = "rgba(212, 175, 55, 0.35)";
      ctx.shadowBlur = 12;
      ctx.stroke();

      ctx.restore();
    };

    // Silk wave drawing helper (Parametric luxury cloth simulation)
    const drawSilkWaves = (
      time: number,
      pX: number,
      pY: number,
      isMobileView: boolean,
    ) => {
      ctx.save();

      // Coordinates anchor based on screen size
      const originX = isMobileView
        ? width * 0.62 + pX * 12
        : width * 0.68 + pX * 24;
      const originY = isMobileView
        ? height * 0.08 + pY * 8
        : height * 0.12 + pY * 16;
      const waveWidth = isMobileView ? width * 0.42 : width * 0.38;
      const waveHeight = isMobileView ? height * 0.45 : height * 0.65;

      const t = time * 0.00065;

      // Ribbon 1: Sumptuous Emerald Green Silk
      ctx.beginPath();
      const pointsTop: [number, number][] = [];
      const pointsBottom: [number, number][] = [];
      const segments = 24;

      for (let i = 0; i <= segments; i++) {
        const u = i / segments;
        const x = originX + u * waveWidth;
        // Natural multi-frequency cloth wave
        const wave1 = Math.sin(t * 1.8 + u * 4.2) * 22;
        const wave2 = Math.cos(t * 1.2 + u * 6.5) * 14;
        const archCurve = Math.sin(u * Math.PI) * (waveHeight * 0.32);
        const yTop =
          originY + u * (waveHeight * 0.75) + wave1 + wave2 - archCurve;
        const ribbonThickness =
          (isMobileView ? 45 : 75) + Math.sin(t * 1.5 + u * 3) * 16;
        const yBottom = yTop + ribbonThickness;

        pointsTop.push([x, yTop]);
        pointsBottom.push([x, yBottom]);
      }

      ctx.moveTo(pointsTop[0][0], pointsTop[0][1]);
      for (let i = 1; i < pointsTop.length; i++) {
        const xc = (pointsTop[i - 1][0] + pointsTop[i][0]) / 2;
        const yc = (pointsTop[i - 1][1] + pointsTop[i][1]) / 2;
        ctx.quadraticCurveTo(pointsTop[i - 1][0], pointsTop[i - 1][1], xc, yc);
      }
      ctx.lineTo(
        pointsTop[pointsTop.length - 1][0],
        pointsTop[pointsTop.length - 1][1],
      );

      ctx.lineTo(
        pointsBottom[pointsBottom.length - 1][0],
        pointsBottom[pointsBottom.length - 1][1],
      );
      for (let i = pointsBottom.length - 2; i >= 0; i--) {
        const xc = (pointsBottom[i + 1][0] + pointsBottom[i][0]) / 2;
        const yc = (pointsBottom[i + 1][1] + pointsBottom[i][1]) / 2;
        ctx.quadraticCurveTo(
          pointsBottom[i + 1][0],
          pointsBottom[i + 1][1],
          xc,
          yc,
        );
      }
      ctx.closePath();

      // Emerald silk luxurious sheen gradient
      const emeraldGrad = ctx.createLinearGradient(
        originX,
        originY,
        originX + waveWidth,
        originY + waveHeight,
      );
      emeraldGrad.addColorStop(0, "rgba(10, 48, 35, 0.88)");
      emeraldGrad.addColorStop(0.28, "rgba(22, 92, 70, 0.94)");
      emeraldGrad.addColorStop(0.52, "rgba(38, 138, 105, 0.92)");
      emeraldGrad.addColorStop(0.74, "rgba(18, 78, 58, 0.86)");
      emeraldGrad.addColorStop(1, "rgba(8, 35, 26, 0.82)");

      ctx.fillStyle = emeraldGrad;
      ctx.shadowColor = "rgba(4, 25, 18, 0.4)";
      ctx.shadowBlur = 24;
      ctx.fill();

      // Satin highlight rim along the top fold
      ctx.beginPath();
      ctx.moveTo(pointsTop[0][0], pointsTop[0][1]);
      for (let i = 1; i < pointsTop.length; i++) {
        const xc = (pointsTop[i - 1][0] + pointsTop[i][0]) / 2;
        const yc = (pointsTop[i - 1][1] + pointsTop[i][1]) / 2;
        ctx.quadraticCurveTo(pointsTop[i - 1][0], pointsTop[i - 1][1], xc, yc);
      }
      ctx.strokeStyle = "rgba(110, 205, 170, 0.45)";
      ctx.lineWidth = isMobileView ? 1.5 : 2.5;
      ctx.stroke();

      // Ribbon 2: Flowing Champagne Gold Satin (Gracefully draped alongside emerald)
      ctx.beginPath();
      const goldTop: [number, number][] = [];
      const goldBottom: [number, number][] = [];

      for (let i = 0; i <= segments; i++) {
        const u = i / segments;
        const x = originX - (isMobileView ? 20 : 35) + u * (waveWidth * 0.95);
        const wave =
          Math.sin(t * 1.6 + u * 4.5 + 1.2) * 18 +
          Math.cos(t * 1.1 + u * 5.8) * 12;
        const yTop =
          originY + (isMobileView ? 35 : 55) + u * (waveHeight * 0.68) + wave;
        const thickness =
          (isMobileView ? 32 : 55) + Math.sin(t * 1.4 + u * 3.2) * 12;
        const yBottom = yTop + thickness;

        goldTop.push([x, yTop]);
        goldBottom.push([x, yBottom]);
      }

      ctx.moveTo(goldTop[0][0], goldTop[0][1]);
      for (let i = 1; i < goldTop.length; i++) {
        const xc = (goldTop[i - 1][0] + goldTop[i][0]) / 2;
        const yc = (goldTop[i - 1][1] + goldTop[i][1]) / 2;
        ctx.quadraticCurveTo(goldTop[i - 1][0], goldTop[i - 1][1], xc, yc);
      }
      ctx.lineTo(
        goldTop[goldTop.length - 1][0],
        goldTop[goldTop.length - 1][1],
      );

      ctx.lineTo(
        goldBottom[goldBottom.length - 1][0],
        goldBottom[goldBottom.length - 1][1],
      );
      for (let i = goldBottom.length - 2; i >= 0; i--) {
        const xc = (goldBottom[i + 1][0] + goldBottom[i][0]) / 2;
        const yc = (goldBottom[i + 1][1] + goldBottom[i][1]) / 2;
        ctx.quadraticCurveTo(
          goldBottom[i + 1][0],
          goldBottom[i + 1][1],
          xc,
          yc,
        );
      }
      ctx.closePath();

      const champagneGrad = ctx.createLinearGradient(
        originX - 30,
        originY + 40,
        originX + waveWidth,
        originY + waveHeight + 50,
      );
      champagneGrad.addColorStop(0, "rgba(245, 230, 190, 0.82)");
      champagneGrad.addColorStop(0.3, "rgba(255, 248, 225, 0.92)");
      champagneGrad.addColorStop(0.65, "rgba(224, 185, 105, 0.88)");
      champagneGrad.addColorStop(1, "rgba(175, 135, 60, 0.78)");

      ctx.fillStyle = champagneGrad;
      ctx.shadowColor = "rgba(130, 95, 30, 0.3)";
      ctx.shadowBlur = 18;
      ctx.fill();

      // Delicate gold highlight ridge
      ctx.beginPath();
      ctx.moveTo(goldTop[0][0], goldTop[0][1]);
      for (let i = 1; i < goldTop.length; i++) {
        const xc = (goldTop[i - 1][0] + goldTop[i][0]) / 2;
        const yc = (goldTop[i - 1][1] + goldTop[i][1]) / 2;
        ctx.quadraticCurveTo(goldTop[i - 1][0], goldTop[i - 1][1], xc, yc);
      }
      ctx.strokeStyle = "rgba(255, 250, 235, 0.65)";
      ctx.lineWidth = isMobileView ? 1.2 : 2;
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

      const isMobile = width < 768;
      const isTablet = width >= 768 && width < 1024;

      // 1. Draw 3D Metallic Gold Rings behind the silk
      const ringCX = isMobile ? width * 0.75 : width * 0.72;
      const ringCY = isMobile ? height * 0.22 : height * 0.28;
      const ringR1X = isMobile
        ? width * 0.16
        : isTablet
          ? width * 0.14
          : width * 0.16;
      const ringR1Y = ringR1X * 0.48;

      const ringTime = elapsed * 0.00045;

      draw3DRing(
        ringCX,
        ringCY,
        ringR1X,
        ringR1Y,
        0.35,
        ringTime,
        m.x,
        m.y,
        38,
        isMobile ? 1.2 : 2.0,
        isMobile ? 0.65 : 0.9,
      );

      draw3DRing(
        ringCX + (isMobile ? 18 : 35),
        ringCY + (isMobile ? 22 : 45),
        ringR1X * 0.82,
        ringR1Y * 0.85,
        -0.42,
        -ringTime * 0.85 + 1.2,
        m.x,
        m.y,
        28,
        isMobile ? 1.0 : 1.6,
        isMobile ? 0.5 : 0.8,
      );

      // 2. Draw Flowing 3D Silk Ribbons
      drawSilkWaves(elapsed, m.x, m.y, isMobile);

      // 3. Update & Draw Floating White Flower Petals
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
      {/* Layer 1: High-Resolution Architectural Stone Arches Backdrop */}
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

      {/* Layer 2: Real-time 3D Canvas (Silk + Gold Rings + Floating Petals + Depth-of-Field) */}
      <canvas ref={canvasRef} className="luxury-hero-canvas" />
    </div>
  );
}
