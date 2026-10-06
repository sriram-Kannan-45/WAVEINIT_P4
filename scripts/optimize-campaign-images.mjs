import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const publicPicDir = path.join(rootDir, "public", "pic");

const files = [
  "Elegant Emerald Green Saree Portrait",
  "Elegant Ivory Embroidered Anarkali Portrait",
  "Maroon Embroidered Anarkali Portrait",
  "Elegant Navy Indian Ensemble",
  "Lavender Embroidered Anarkali Portrait",
];

async function main() {
  console.log("Optimizing campaign outfit images to high-quality WebP...");
  for (const name of files) {
    const pngPath = path.join(publicPicDir, `${name}.png`);
    const webpPath = path.join(publicPicDir, `${name}.webp`);

    if (!fs.existsSync(pngPath)) {
      console.warn(`File not found: ${pngPath}`);
      continue;
    }

    const pngStat = fs.statSync(pngPath);
    await sharp(pngPath)
      .webp({
        quality: 90,
        alphaQuality: 100,
        effort: 4,
      })
      .toFile(webpPath);

    const webpStat = fs.statSync(webpPath);
    console.log(
      `✓ ${name}: ${(pngStat.size / 1024 / 1024).toFixed(2)} MB -> ${(webpStat.size / 1024).toFixed(1)} KB (-${(((pngStat.size - webpStat.size) / pngStat.size) * 100).toFixed(1)}%)`
    );
  }
}

main().catch(console.error);
