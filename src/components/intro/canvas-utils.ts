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
    [22, 0],
    [32, 0.3],
    [40, 0.58],
    [60, 0.65],
    [72, 0.55],
    [82, 0.4],
    [100, 0.62],
    [130, 0.5],
    [239, 0.5],
  ];
  for (let i = 1; i < positions.length; i++) {
    const [end, to] = positions[i];
    if (frame <= end) {
      const [start, from] = positions[i - 1];
      const t = clamp((frame - start) / (end - start));
      return from + (to - from) * t;
    }
  }
  return 0.5;
}

/** Portrait phone window keeps the full central logo and welcome lettering. */
export const portraitFit = (width: number, height: number) =>
  width <= 600 && width <= height;
export const portraitLogoWidth = 360;

/** Proportionally crop portrait source sides so the entire final logo window fits. */
export function drawBounds(
  width: number,
  height: number,
  source: FrameRect,
  position = 0.5,
) {
  const scale = portraitFit(width, height)
    ? Math.min(width / portraitLogoWidth, height / source.height)
    : Math.max(width / source.width, height / source.height);
  const drawWidth = source.width * scale;
  const drawHeight = source.height * scale;
  return {
    x: (width - drawWidth) * clamp(position),
    // A lower source focus keeps the native welcome line in short landscapes.
    y: (height - drawHeight) * (portraitFit(width, height) ? 0.5 : 0.72),
    width: drawWidth,
    height: drawHeight,
  };
}
