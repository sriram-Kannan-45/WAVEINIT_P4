"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Volume2, VolumeX, ArrowRight } from "lucide-react";

interface AchuMobileIntroProps {
  onComplete?: () => void;
}

const completedVisitKey = "achu:mobile-intro-completed";
let completedInDocument = false;

function hasCompletedIntro() {
  if (typeof window === "undefined") return false;
  if (completedInDocument) return true;
  try {
    return window.sessionStorage.getItem(completedVisitKey) === "1";
  } catch {
    return false;
  }
}

function rememberCompletedIntro() {
  // Keep client-side navigation working even when browser storage is blocked.
  completedInDocument = true;
  try {
    window.sessionStorage.setItem(completedVisitKey, "1");
  } catch {
    // The in-memory flag still covers this document's route changes.
  }
}

export function AchuMobileIntro({ onComplete }: AchuMobileIntroProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const storeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finishingRef = useRef(false);
  const [alreadyCompleted] = useState(hasCompletedIntro);

  const [status, setStatus] = useState<
    "playing" | "ended" | "exiting" | "dismissed"
  >(() =>
    alreadyCompleted
      ? "dismissed"
      : typeof window !== "undefined" &&
          window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "ended"
        : "playing",
  );
  const [isMuted, setIsMuted] = useState(true);
  const [canSkip, setCanSkip] = useState(true);
  const [progress, setProgress] = useState(0);

  const finishIntro = useCallback(() => {
    if (finishingRef.current) return;
    finishingRef.current = true;
    // Save before the exit animation so leaving during the fade cannot replay.
    rememberCompletedIntro();
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }

    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Trigger synchronized entrance animation on boutique storefront
    document.documentElement.setAttribute("data-store-animate", "in");
    storeTimerRef.current = setTimeout(() => {
      document.documentElement.setAttribute("data-store-animate", "done");
    }, 1800);

    if (prefersReducedMotion) {
      setStatus("dismissed");
      document.documentElement.removeAttribute("data-mobile-intro");
      document.body.style.removeProperty("overflow");
      document.body.style.removeProperty("touch-action");
      if (onComplete) onComplete();
      return;
    }

    // Begin cinematic crossfade & scale exit
    setStatus("exiting");
    document.documentElement.removeAttribute("data-mobile-intro");
    document.body.style.removeProperty("overflow");
    document.body.style.removeProperty("touch-action");

    exitTimerRef.current = setTimeout(() => {
      setStatus("dismissed");
      if (onComplete) {
        onComplete();
      }
    }, 450);
  }, [onComplete]);

  // Lock mobile scrolling during active intro playback
  useEffect(() => {
    // Returning to the home layout must not mount a video or lock restored scroll.
    if (alreadyCompleted) return;
    document.documentElement.setAttribute("data-mobile-intro", "active");
    document.body.style.setProperty("overflow", "hidden");
    document.body.style.setProperty("touch-action", "none");

    return () => {
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
      if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
      if (storeTimerRef.current) clearTimeout(storeTimerRef.current);
      document.documentElement.removeAttribute("data-mobile-intro");
      document.documentElement.removeAttribute("data-store-animate");
      document.body.style.removeProperty("overflow");
      document.body.style.removeProperty("touch-action");
    };
  }, [alreadyCompleted]);

  // Handle autoplay with safety fallback
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Check for prefers-reduced-motion
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      // For reduced motion, seek to final logo frame immediately
      video.currentTime = 9.9;
      return;
    }

    const playPromise = video.play();
    if (playPromise !== undefined) {
      playPromise.catch(() => {
        // Autoplay policy fallback: ensure muted and retry
        video.muted = true;
        setIsMuted(true);
        video.play().catch(() => {
          // If still blocked, user can tap screen or skip
          setCanSkip(true);
        });
      });
    }
  }, []);

  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (!video || !video.duration) return;
    const p = Math.min(1, Math.max(0, video.currentTime / video.duration));
    setProgress(p);
  };

  const handleEnded = () => {
    if (finishingRef.current) return;
    setStatus("ended");
    setProgress(1);

    // Phase 7: Intro final state holds the complete logo before transitioning to Hero
    holdTimerRef.current = setTimeout(() => {
      finishIntro();
    }, 850);
  };

  const handleSkip = (e: React.MouseEvent) => {
    e.stopPropagation();
    finishIntro();
  };

  const handleToggleSound = (e: React.MouseEvent) => {
    e.stopPropagation();
    const video = videoRef.current;
    if (!video) return;
    const nextMuted = !isMuted;
    video.muted = nextMuted;
    setIsMuted(nextMuted);
  };

  const touchStartY = useRef<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartY.current === null) return;
    const diff = touchStartY.current - e.touches[0].clientY;
    if (diff > 35) {
      touchStartY.current = null;
      finishIntro();
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (e.deltaY > 15) {
      finishIntro();
    }
  };

  if (status === "dismissed") {
    return null;
  }

  return (
    <section
      ref={containerRef}
      className={`mobile-intro-container ${status === "ended" ? "is-ended" : ""} ${status === "exiting" ? "is-exiting" : ""}`}
      data-status={status}
      aria-label="Achu Designer Boutique mobile introduction"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onWheel={handleWheel}
      onClick={() => {
        if (status === "ended") finishIntro();
      }}
    >
      <div className="mobile-intro-stage">
        <video
          ref={videoRef}
          className="mobile-intro-video"
          src="/videos/achu_mobile.mp4"
          playsInline
          muted={isMuted}
          autoPlay
          preload="auto"
          onTimeUpdate={handleTimeUpdate}
          onEnded={handleEnded}
        />

        {/* Ambient background blend matching the video's ivory backdrop */}
        <div className="mobile-intro-ambient" aria-hidden="true" />
      </div>

      {/* Top action controls: sound toggle and skip button */}
      <div className="mobile-intro-controls" aria-label="Intro options">
        <button
          type="button"
          onClick={handleToggleSound}
          className="mobile-intro-btn mobile-intro-sound-btn"
          aria-label={isMuted ? "Unmute intro video" : "Mute intro video"}
          title={isMuted ? "Unmute" : "Mute"}
        >
          {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          <span className="mobile-intro-btn-text">
            {isMuted ? "Sound Off" : "Sound On"}
          </span>
        </button>

        {canSkip && (
          <button
            type="button"
            onClick={handleSkip}
            className="mobile-intro-btn mobile-intro-skip-btn"
            aria-label="Skip intro and enter boutique"
          >
            <span>{status === "ended" ? "Enter Boutique" : "Skip"}</span>
            <ArrowRight size={14} />
          </button>
        )}
      </div>

      {/* Subtle progress indicator at the very bottom edge */}
      <div className="mobile-intro-progress-bar" aria-hidden="true">
        <div
          className="mobile-intro-progress-fill"
          style={{ width: `${(progress * 100).toFixed(1)}%` }}
        />
      </div>
    </section>
  );
}
