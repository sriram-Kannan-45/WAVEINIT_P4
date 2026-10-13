"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { Product, Taxonomy } from "@/types";

export interface OutfitItem {
  id: string;
  number: string;
  category: string;
  title: string;
  tagline: string;
  description: string;
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
    tagline: "Elegant. Timeless. You.",
    description: "Handwoven pure silk drape with royal gold zari border.",
    image: "/pic/Elegant Emerald Green Saree Portrait.webp",
    href: "/collections/sarees",
    width: 1024,
    height: 1536,
  },
  {
    id: "kurti",
    number: "02",
    category: "Kurtis & sets",
    title: "Ivory Embroidered Kurta Set",
    tagline: "Designed for Every Occasion",
    description: "Intricate floral thread embroidery on pristine festive ivory.",
    image: "/pic/Elegant Ivory Embroidered Anarkali Portrait.webp",
    href: "/collections/kurtis",
    width: 1024,
    height: 1536,
  },
  {
    id: "top",
    number: "03",
    category: "Occasion wear",
    title: "Wine Occasion Ensemble",
    tagline: "Where Style Meets Comfort",
    description: "Deep wine flared anarkali tailored for effortless festive grace.",
    image: "/pic/Maroon Embroidered Anarkali Portrait.webp",
    href: "/collections/occasion-wear",
    width: 1024,
    height: 1536,
  },
  {
    id: "leggings",
    number: "04",
    category: "Festive edit",
    title: "Navy Festive Suit Set",
    tagline: "Make Every Moment Beautiful",
    description: "Rich midnight navy silk with signature handcrafted embellishments.",
    image: "/pic/Elegant Navy Indian Ensemble.webp",
    href: "/collections/festive-edit",
    width: 1024,
    height: 1536,
  },
  {
    id: "ethnic",
    number: "05",
    category: "Designer wear",
    title: "The Emerald Occasion Edit",
    tagline: "Your Style, Your Statement",
    description: "Contemporary bespoke silhouette infused with classic heritage craft.",
    image: "/pic/Lavender Embroidered Anarkali Portrait.webp",
    href: "/collections/designer-wear",
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
  objectPosition = "center center",
}: LuxuryHero3DBackgroundProps = {}) {
  const containerRef = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const cutoutLayersRef = useRef<(HTMLDivElement | null)[]>([]);
  const messageLayersRef = useRef<(HTMLDivElement | null)[]>([]);
  const paginationDotsRef = useRef<(HTMLButtonElement | null)[]>([]);

  // Allow clicking dots to jump directly to an outfit along the video timeline
  const jumpToOutfit = (index: number) => {
    const video = videoRef.current;
    if (!video) return;
    const dur =
      video.duration && !isNaN(video.duration) && video.duration > 0
        ? video.duration
        : 10;
    video.currentTime = (index / CAMPAIGN_OUTFITS.length) * dur;
    if (video.paused) {
      video.play().catch(() => {});
    }
  };

  useEffect(() => {
    const video = videoRef.current;
    const container = containerRef.current;
    if (!video || !container) return;

    const layers = cutoutLayersRef.current;
    const messageLayers = messageLayersRef.current;
    const dots = paginationDotsRef.current;
    let currentActive = -1;

    // Smoothly synchronizes the displayed picture and right-side message with the video timeline
    const syncActiveOutfit = () => {
      if (!video) return;
      const t = video.currentTime;
      const dur =
        video.duration && !isNaN(video.duration) && video.duration > 0
          ? video.duration
          : 10;
      const count = CAMPAIGN_OUTFITS.length;
      const idx = Math.min(
        count - 1,
        Math.max(0, Math.floor((t / dur) * count)),
      );

      if (idx !== currentActive) {
        currentActive = idx;
        container.setAttribute("data-active-outfit", String(idx));

        for (let i = 0; i < layers.length; i++) {
          const layer = layers[i];
          if (!layer) continue;
          const isActive = i === idx;
          layer.classList.toggle("active", isActive);
          layer.setAttribute("aria-hidden", String(!isActive));
        }

        for (let i = 0; i < messageLayers.length; i++) {
          const msg = messageLayers[i];
          if (!msg) continue;
          const isActive = i === idx;
          msg.classList.toggle("active", isActive);
          msg.setAttribute("aria-hidden", String(!isActive));
        }

        for (let i = 0; i < dots.length; i++) {
          dots[i]?.classList.toggle("active", i === idx);
        }
      }
    };

    let animId: number;
    const tick = () => {
      syncActiveOutfit();
      animId = requestAnimationFrame(tick);
    };
    animId = requestAnimationFrame(tick);

    video.addEventListener("timeupdate", syncActiveOutfit);

    // Responsive native video source matching
    const mobileQuery = window.matchMedia("(max-width: 767px)");

    const syncVideoSource = () => {
      const isMobile = mobileQuery.matches;
      const targetSrc = isMobile
        ? "/videos/Mobile.mp4"
        : "/videos/laptop-resolution.mp4";

      if (video.getAttribute("data-src") !== targetSrc) {
        video.setAttribute("data-src", targetSrc);
        const wasPlaying = !video.paused;
        video.src = targetSrc;
        video.load();
        if (wasPlaying || true) {
          video.play().catch(() => {});
        }
      }
    };

    syncVideoSource();
    mobileQuery.addEventListener("change", syncVideoSource);

    // Play continuously when visible; pause only when scrolled away to conserve resources
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            video.play().catch(() => {});
          } else {
            video.pause();
          }
        }
      },
      { threshold: 0.05, rootMargin: "150px 0px" },
    );

    observer.observe(container);

    return () => {
      cancelAnimationFrame(animId);
      video.removeEventListener("timeupdate", syncActiveOutfit);
      mobileQuery.removeEventListener("change", syncVideoSource);
      observer.disconnect();
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
        {/* Layer 1: Native HTML5 Master Continuous Showcase Video */}
        <div className="luxury-hero-3d-wrap">
          <div className="luxury-hero-backdrop-img">
            <video
              ref={videoRef}
              className="luxury-hero-video-element"
              autoPlay
              muted
              loop
              playsInline
              preload="auto"
              suppressHydrationWarning
              style={{ objectPosition }}
            >
              <source
                media="(max-width: 767px)"
                src="/videos/Mobile.mp4"
                type="video/mp4"
              />
              <source
                src="/videos/laptop-resolution.mp4"
                type="video/mp4"
              />
            </video>
            {/* Soft atmospheric contrast overlay */}
            <div className="luxury-hero-contrast-overlay" />
          </div>
        </div>

        {/* Layer 2: Model Cutout Showcase Above Video from the pic folder */}
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
                  src={outfit.image}
                  alt={outfit.title}
                  width={outfit.width}
                  height={outfit.height}
                  priority={idx < 2}
                  unoptimized
                  className="hero-cutout-image"
                  sizes="(max-width: 767px) 90vw, (max-width: 1200px) 60vw, 800px"
                />
              </div>
            );
          })}
        </div>

        {/* Layer 3: Left-Side Editorial Branding & Collection CTA */}
        <div className="hero-campaign-showcase">
          <div className="hero-campaign-editorial">
            <p className="hero-campaign-eyebrow">TRADITION MEETS MODERN</p>
            <span className="hero-campaign-gold-line" aria-hidden="true" />
            <h2
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
            </h2>
            <p className="hero-campaign-subtitle">
              Discover timeless ethnic wear crafted for your special moments.
            </p>
            <div className="hero-campaign-actions">
              <Link href="/collections" className="hero-cta-button">
                <span>Explore Collections</span>
                <ArrowRight size={16} />
              </Link>
            </div>
          </div>
        </div>

        {/* Layer 4: Right-Side Showcase Message Panel (Dynamic per dress) */}
        <div className="hero-campaign-message-panel" aria-live="polite">
          <div className="hero-dress-messages-container">
            {CAMPAIGN_OUTFITS.map((outfit, idx) => {
              const isActive = idx === 0;
              return (
                <div
                  key={outfit.id}
                  ref={(el) => {
                    messageLayersRef.current[idx] = el;
                  }}
                  className={`hero-dress-message-card ${isActive ? "active" : ""}`}
                  data-outfit-id={outfit.id}
                  aria-hidden={!isActive}
                >
                  <div className="dress-message-header">
                    <span className="dress-number-badge">
                      LOOK {outfit.number} OF 05
                    </span>
                    <span className="dress-category-label">
                      {outfit.category}
                    </span>
                  </div>
                  <h3 className="dress-tagline-quote">
                    “{outfit.tagline}”
                  </h3>
                  <p className="dress-title-subtitle">
                    {outfit.title}
                  </p>
                  <p className="dress-description-text">
                    {outfit.description}
                  </p>
                  <Link href={outfit.href} className="dress-explore-link">
                    <span>Explore {outfit.category}</span>
                    <ArrowRight size={13} />
                  </Link>
                </div>
              );
            })}
          </div>

          {/* Dots indicating active look */}
          <div
            className="dress-message-dots"
            role="tablist"
            aria-label="Featured dress indicators"
          >
            {CAMPAIGN_OUTFITS.map((outfit, idx) => (
              <button
                key={outfit.id}
                ref={(el) => {
                  paginationDotsRef.current[idx] = el;
                }}
                type="button"
                onClick={() => jumpToOutfit(idx)}
                className={`dress-dot pagination-dot ${idx === 0 ? "active" : ""}`}
                aria-label={`View ${outfit.title}`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export const CampaignVideoShowcase = LuxuryHero3DBackground;
