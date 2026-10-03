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
// Fixed composition band containing the finished emblem and welcome text.
// Apply throughout the sequence; do not track the moving bird or add a pan.
export const introVerticalFocus = { top: 0.13, bottom: 0.95 };
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

/** Fill the available width uniformly; never inset the source's side edges. */
export function drawBounds(width: number, height: number, source: FrameRect) {
  const scale = width / source.width;
  const drawHeight = source.height * scale;
  let y = (height - drawHeight) / 2;
  if (drawHeight > height) {
    const upper = height - introVerticalFocus.bottom * drawHeight;
    const lower = -introVerticalFocus.top * drawHeight;
    // Trim surrounding background before the final emblem/lettering whenever
    // that fixed band fits. Otherwise retain centered, unavoidable overflow.
    if (lower <= upper) y = clamp(y, lower, upper);
  }
  return {
    x: 0,
    y,
    width,
    height: drawHeight,
  };
}
