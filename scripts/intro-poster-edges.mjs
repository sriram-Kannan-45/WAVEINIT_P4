import sharp from "sharp";

export async function posterEdgeStyles(input) {
  const info = await sharp(input).metadata();
  const gradients = {};
  for (const side of ["left", "right"]) {
    const { data } = await sharp(input)
      .extract({
        left: side === "left" ? 0 : info.width - 1,
        top: 0,
        width: 1,
        height: info.height,
      })
      .resize(1, 32, { fit: "fill" })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const stops = [];
    for (let i = 0; i < 32; i++) {
      const r = data[i * 3],
        g = data[i * 3 + 1],
        b = data[i * 3 + 2];
      const light =
        Math.min(r, g, b) >= 195 &&
        (r + g + b) / 3 >= 225 &&
        Math.max(r, g, b) - Math.min(r, g, b) < 55;
      stops.push(
        `${light ? `rgb(${r},${g},${b})` : "#fffcef"} ${((i / 31) * 100).toFixed(3)}%`,
      );
    }
    gradients[side] = `linear-gradient(to bottom, ${stops.join(", ")})`;
  }
  return gradients;
}
