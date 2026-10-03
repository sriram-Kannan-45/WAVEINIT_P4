export interface FrameSet {
  width: number;
  height: number;
  path: string;
  bytes: number;
  /** [left, top, width, height] of real footage, excluding export padding. */
  contentBounds?: number[][];
}
export interface FrameRect {
  x: number;
  y: number;
  width: number;
  height: number;
}
export interface IntroMetadata {
  revision: string;
  frameCount: number;
  background: string;
  scroll: {
    desktopScreens: number;
    mobileScreens: number;
    startHold: number;
    animationEnd: number;
    fadeStart: number;
  };
  desktop: FrameSet;
  mobile: FrameSet;
}
export type IntroMode = "mobile" | "desktop";
export const clamp = (value: number, min = 0, max = 1) =>
  Math.min(max, Math.max(min, value));
export const introMode = (width: number, height: number): IntroMode =>
  width <= height ? "mobile" : "desktop";
export function introProgress(
  travel: number,
  frontDistance: number,
  videoDistance: number,
) {
  return {
    front: clamp(travel / Math.max(1, frontDistance)),
    video: clamp((travel - frontDistance) / Math.max(1, videoDistance)),
  };
}
export function frameUrl(
  metadata: IntroMetadata,
  mode: IntroMode,
  index: number,
) {
  return `${metadata[mode].path.replace("%04d", String(index + 1).padStart(4, "0"))}?v=${metadata.revision}`;
}
export function scrollFrame(progress: number, metadata: IntroMetadata) {
  const { startHold, animationEnd } = metadata.scroll;
  return (
    clamp((progress - startHold) / (animationEnd - startHold)) *
    (metadata.frameCount - 1)
  );
}
export function frameSource(source: FrameSet, index: number): FrameRect {
  const rectangle = source.contentBounds?.[index];
  if (!rectangle)
    return { x: 0, y: 0, width: source.width, height: source.height };
  const [x, y, width, height] = rectangle;
  return { x, y, width, height };
}

/** Horizontal cover position, sampled from the corrected source's flight path.
 * Keep its left-edge entrance visible, then settle on the centered logo.
 * Only the crop moves; the source cadence and cover scale stay unchanged.
 */
export function cropPosition(index: number, frameCount: number) {
  const frame = (index / Math.max(1, frameCount - 1)) * 239;
  const positions = [
    [0, 0],
    [20, 0],
    [35, 0.22],
    [50, 0.46],
    [65, 0.52],
    [80, 0.48],
    [100, 0.52],
    [125, 0.5],
    [239, 0.5],
  ];
  for (let i = 1; i < positions.length; i++) {
    const [end, to] = positions[i];
    if (frame <= end) {
      const [start, from] = positions[i - 1];
      const t = clamp((frame - start) / (end - start));
      const smoothT = t * t * (3 - 2 * t);
      return from + (to - from) * smoothT;
    }
  }
  return 0.5;
}

/** Portrait window keeps the full central logo and welcome lettering.
 * Portrait phones and portrait tablets share one composition; only widths up
 * to the mobile breakpoint qualify, so landscape desktops keep cover framing. */
export const portraitFit = (width: number, height: number) =>
  width <= 768 && width <= height;
export const portraitLogoWidth = 380;
export const portraitFlightWidth = 400;

/** Convert hex background to 0-alpha rgba for seamless edge feathering. */
export function transparentColor(hex: string) {
  if (hex.startsWith("#") && hex.length === 7) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, 0)`;
  }
  return "transparent";
}

/** Computes the smooth scale for mobile portrait animation.
 * Entrance (frames 0-20) fills the screen edge-to-edge and top-to-bottom.
 * Flight (frames 20-120) scales proportionally to give the peacock breathing room without clipping wings.
 * Transition (frames 120-180) smoothly centers and frames the circular wreath logo.
 */
export function dynamicScale(
  width: number,
  height: number,
  source: FrameRect,
  index = 0,
  frameCount = 240,
) {
  const coverScale = Math.max(width / source.width, height / source.height);
  if (!portraitFit(width, height)) {
    return coverScale;
  }
  const logoScale = Math.min(coverScale, width / portraitLogoWidth);
  const flightScale = Math.min(coverScale, width / portraitFlightWidth);

  const frame = (index / Math.max(1, frameCount - 1)) * 239;
  if (frame <= 20) {
    return coverScale;
  }
  if (frame <= 60) {
    const t = (frame - 20) / 40;
    const eased = t * t * (3 - 2 * t);
    return coverScale + (flightScale - coverScale) * eased;
  }
  if (frame <= 120) {
    return flightScale;
  }
  if (frame <= 180) {
    const t = (frame - 120) / 60;
    const eased = t * t * (3 - 2 * t);
    return flightScale + (logoScale - flightScale) * eased;
  }
  return logoScale;
}

/** Proportionally crop portrait source sides so the animation fills the viewport smoothly. */
export function drawBounds(
  width: number,
  height: number,
  source: FrameRect,
  position = 0.5,
  index = 0,
  frameCount = 240,
) {
  const scale = dynamicScale(width, height, source, index, frameCount);
  const drawWidth = source.width * scale;
  const drawHeight = source.height * scale;
  const rawY =
    (height - drawHeight) * (portraitFit(width, height) ? 0.5 : 0.72);
  return {
    x: (width - drawWidth) * clamp(position),
    // A lower source focus keeps the native welcome line in short landscapes.
    y: Math.abs(rawY) < 1e-6 ? 0 : rawY,
    width: drawWidth,
    height: drawHeight,
  };
}
