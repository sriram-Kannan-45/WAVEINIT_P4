import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
async function main() {
  await mkdir("output", { recursive: true });
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    for (const width of [320, 375, 430, 768, 1024, 1440, 1920]) {
      await page.setViewportSize({ width, height: 900 });
      for (const path of [
        "/",
        "/shop",
        "/product/ivory-embroidered-kurta-set",
        "/collections",
        "/about",
        "/contact",
        "/admin/login",
      ]) {
        await page.goto(`http://localhost:3000${path}`);
        await page.evaluate(() => document.fonts.ready);
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth > window.innerWidth,
        );
        if (overflow)
          throw new Error(`Horizontal overflow at ${width}px on ${path}`);
      }
      if (width === 1440 || width === 375) {
        await page.goto("http://localhost:3000");
        await page.evaluate(() => document.fonts.ready);
        for (const img of await page.locator("img:visible").all()) {
          await img.scrollIntoViewIfNeeded();
          await img.evaluate((element: HTMLImageElement) =>
            Promise.race([
              element.decode().catch(() => undefined),
              new Promise((resolve) => setTimeout(resolve, 1500)),
            ]),
          );
        }
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.screenshot({
          path: `output/home-${width}.png`,
          fullPage: true,
        });
        await page.screenshot({ path: `output/home-top-${width}.png` });
        await page.goto(
          "http://localhost:3000/product/ivory-embroidered-kurta-set",
        );
        await page.screenshot({
          path: `output/product-${width}.png`,
          fullPage: true,
        });
      }
      console.log(`${width}px: all seven page layouts passed`);
    }
  } finally {
    await browser.close();
  }
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
