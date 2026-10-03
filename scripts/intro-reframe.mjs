import sharp from "sharp";

/** Extend the ivory environment into padding; never paint over video pixels. */
export async function portraitFrame(art, quality) {
  const { data, info } = await sharp(art)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const top = Math.floor((1280 - info.height) / 2);
  const base = [255, 252, 239];
  const edge = (row) => {
    const colors = [];
    for (let x = 0; x < 720; x++) {
      const offset = (row * 720 + x) * 3;
      const rgb = [data[offset], data[offset + 1], data[offset + 2]];
      // Extend only the light environment, never duplicate feathers or lettering.
      colors.push(
        Math.min(...rgb) >= 220 && Math.max(...rgb) - Math.min(...rgb) < 45
          ? rgb
          : base,
      );
    }
    return colors.map((_, x) => {
      const neighbors = colors.slice(
        Math.max(0, x - 16),
        Math.min(720, x + 17),
      );
      return base.map(
        (_, c) =>
          neighbors.reduce((sum, rgb) => sum + rgb[c], 0) / neighbors.length,
      );
    });
  };
  const upper = edge(0),
    lower = edge(info.height - 1);
  const padding = Buffer.alloc(720 * 1280 * 3);
  for (let y = 0; y < 1280; y++) {
    if (y >= top && y < top + info.height) continue;
    const above = y < top;
    const t = above
      ? y / Math.max(1, top)
      : (1280 - y - 1) / Math.max(1, 1280 - top - info.height);
    const amount = Math.max(0, Math.min(1, t));
    const colors = above ? upper : lower;
    for (let x = 0; x < 720; x++)
      for (let c = 0; c < 3; c++)
        padding[(y * 720 + x) * 3 + c] = Math.round(
          base[c] + (colors[x][c] - base[c]) * amount,
        );
  }
  return sharp(padding, { raw: { width: 720, height: 1280, channels: 3 } })
    .composite([{ input: art, left: 0, top }])
    .webp({ quality, effort: 5 })
    .toBuffer();
}
