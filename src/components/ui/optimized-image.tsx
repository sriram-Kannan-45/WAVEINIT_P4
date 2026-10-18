"use client";

import Image, { type ImageProps } from "next/image";
import { useState, useRef, useEffect } from "react";
import { imageUrl } from "@/lib/utils";

export interface OptimizedImageProps extends Omit<ImageProps, "src"> {
  src: string;
  fallbackSrc?: string;
  alt: string;
}

const DEFAULT_FALLBACK = "/brand/achu-designer-boutique-logo.png";

/**
 * Optimized Image component for Achu Designer Boutique.
 * - Resolves ImageKit URL delivery with WebP/AVIF auto-negotiation
 * - Responsive sizing and lazy loading by default
 * - Subtle shimmer placeholder during image load
 * - Graceful fallback placeholder on error without breaking UI
 */
export function OptimizedImage({
  src,
  alt,
  fallbackSrc = DEFAULT_FALLBACK,
  className = "",
  loading = "lazy",
  onError,
  onLoad,
  ...rest
}: OptimizedImageProps) {
  const [hasError, setHasError] = useState(false);
  const [isLoaded, setIsLoaded] = useState(Boolean(rest.priority));
  const imgRef = useRef<HTMLImageElement>(null);

  const resolvedSrc = hasError
    ? fallbackSrc
    : imageUrl(src || fallbackSrc);

  useEffect(() => {
    if (imgRef.current?.complete) {
      setIsLoaded(true);
    }
  }, [resolvedSrc]);

  const isLocalBlob =
    typeof resolvedSrc === "string" &&
    (resolvedSrc.startsWith("blob:") || resolvedSrc.startsWith("data:"));

  return (
    <Image
      ref={imgRef}
      decoding="async"
      unoptimized={isLocalBlob || rest.unoptimized}
      {...rest}
      src={resolvedSrc}
      alt={alt || "Achu Designer Boutique piece"}
      loading={rest.priority ? undefined : loading}
      className={`${className} ${isLoaded ? "image-loaded" : "image-loading"}`}
      onError={(e) => {
        if (!hasError) {
          setHasError(true);
        }
        onError?.(e);
      }}
      onLoad={(e) => {
        setIsLoaded(true);
        onLoad?.(e);
      }}
    />
  );
}
