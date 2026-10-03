import type { FrameSet } from "./canvas-utils";

/** Fill unused viewport space with the frame's light environment, without
 * stretching artwork, duplicating feathers, or cropping the original frame. */
export function extendFrameBackground(
  context: CanvasRenderingContext2D,
  sampler: CanvasRenderingContext2D,
  image: CanvasImageSource,
  source: FrameSet,
  bounds: { x: number; y: number; width: number; height: number },
  width: number,
  height: number,
) {
  const samples = 32;
  const fill = (side: "left" | "right" | "top" | "bottom") => {
    const vertical = side === "left" || side === "right";
    sampler.canvas.width = vertical ? 1 : samples;
    sampler.canvas.height = vertical ? samples : 1;
    sampler.drawImage(
      image,
      side === "right" ? source.width - 1 : 0,
      side === "bottom" ? source.height - 1 : 0,
      vertical ? 1 : source.width,
      vertical ? source.height : 1,
      0,
      0,
      sampler.canvas.width,
      sampler.canvas.height,
    );
    const pixels = sampler.getImageData(
      0,
      0,
      sampler.canvas.width,
      sampler.canvas.height,
    ).data;
    const gradient = vertical
      ? context.createLinearGradient(0, bounds.y, 0, bounds.y + bounds.height)
      : context.createLinearGradient(bounds.x, 0, bounds.x + bounds.width, 0);
    for (let i = 0; i < samples; i++) {
      const r = pixels[i * 4],
        g = pixels[i * 4 + 1],
        b = pixels[i * 4 + 2];
      // Only ivory background reaches the padding, never the entering bird.
      const light =
        Math.min(r, g, b) >= 195 &&
        (r + g + b) / 3 >= 225 &&
        Math.max(r, g, b) - Math.min(r, g, b) < 55;
      gradient.addColorStop(
        i / (samples - 1),
        light ? `rgb(${r},${g},${b})` : "#fffcef",
      );
    }
    context.fillStyle = gradient;
    if (side === "left") context.fillRect(0, 0, bounds.x + 1, height);
    if (side === "right")
      context.fillRect(
        bounds.x + bounds.width - 1,
        0,
        width - bounds.x - bounds.width + 1,
        height,
      );
    if (side === "top") context.fillRect(0, 0, width, bounds.y + 1);
    if (side === "bottom")
      context.fillRect(
        0,
        bounds.y + bounds.height - 1,
        width,
        height - bounds.y - bounds.height + 1,
      );
  };
  if (bounds.x > 0.5) {
    fill("left");
    fill("right");
  }
  if (bounds.y > 0.5) {
    fill("top");
    fill("bottom");
  }
}
