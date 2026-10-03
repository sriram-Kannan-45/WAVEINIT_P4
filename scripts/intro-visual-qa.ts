import { chromium, webkit, expect, type Browser } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import frames from "../public/intro/frames.json";
const qaBrowsers: Browser[] = [];

async function main() {
  const output = "output/responsive-flow-qa";
  await mkdir(output, { recursive: true });
  const report: unknown[] = [];
  for (const engine of [chromium, webkit]) {
    const browser = await engine.launch();
    qaBrowsers.push(browser);
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
    });
    const page = await context.newPage();
    const errors: string[] = [],
      missing: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("response", (r) => {
      if (r.url().includes("/intro/") && r.status() >= 400)
        missing.push(r.url());
    });
    await page.goto("http://localhost:3000/");
    await page.evaluate(async () => {
      const artwork = new Image();
      artwork.src = "/intro/scroll-to-continue.png";
      await artwork.decode();
    });
    for (const size of [
      { width: 320, height: 760 },
      { width: 375, height: 812 },
      { width: 390, height: 844 },
      { width: 430, height: 932 },
      { width: 768, height: 1024 },
      { width: 1024, height: 1366 },
      { width: 1366, height: 768 },
      { width: 1440, height: 900 },
      { width: 1920, height: 1080 },
      { width: 844, height: 390 },
      { width: 1024, height: 768 },
    ]) {
      await page.setViewportSize(size);
      for (const [name, p] of [
        ["welcome", -2],
        ["reveal", -1],
        ["first", 0],
        ["flight", 0.25],
        ["transformation", 0.5],
        ["logo", 0.92],
        ["release", 0.98],
        ["store", 1.02],
      ] as const) {
        await page.evaluate((progress) => {
          const section = document.querySelector<HTMLElement>(".intro-scroll")!;
          const front =
            section.querySelector<HTMLElement>(
              ".intro-front-range",
            )!.clientHeight;
          const video =
            section.querySelector<HTMLElement>(
              ".intro-video-range",
            )!.clientHeight;
          window.scrollTo({
            top:
              section.getBoundingClientRect().top +
              scrollY +
              (progress < 0
                ? front * (progress === -2 ? 0 : 0.5)
                : front + progress * video),
            behavior: "instant",
          });
        }, p);
        const expected = Math.round(
          Math.max(
            0,
            Math.min(
              1,
              (p - frames.scroll.startHold) /
                (frames.scroll.animationEnd - frames.scroll.startHold),
            ),
          ) *
            (frames.frameCount - 1),
        );
        await expect
          .poll(async () =>
            Math.abs(
              Number(
                await page.locator(".intro-scroll").getAttribute("data-frame"),
              ) - expected,
            ),
          )
          .toBeLessThanOrEqual(1);
        await expect(page.locator(".intro-scroll")).toHaveAttribute(
          "data-mode",
          size.width <= size.height ? "mobile" : "desktop",
        );
        await expect
          .poll(async () =>
            Number(
              await page
                .locator(".intro-front")
                .evaluate((e) => getComputedStyle(e).opacity),
            ),
          )
          .toBeCloseTo(p === -2 ? 1 : p === -1 ? 0.5 : 0, 1);
        await expect(page.locator(".intro-video-stage")).toHaveCSS(
          "opacity",
          p === -2 ? "0" : "1",
        );
        const opacity =
          1 -
          Math.max(
            0,
            Math.min(
              1,
              (p - frames.scroll.fadeStart) / (1 - frames.scroll.fadeStart),
            ),
          );
        await expect
          .poll(async () =>
            Number(
              await page
                .locator(".intro-sticky")
                .evaluate((e) => getComputedStyle(e).opacity),
            ),
          )
          .toBeCloseTo(opacity, 1);
        if (p >= 1)
          await expect(page.locator(".intro-sticky")).toHaveCSS("opacity", "0");
        if (p >= 0 && p < frames.scroll.fadeStart) {
          const stage = (await page
            .locator(".intro-video-stage")
            .boundingBox())!;
          expect(stage.x).toBeCloseTo(0, 1);
          expect(stage.y).toBeCloseTo(0, 1);
          expect(stage.width).toBeCloseTo(size.width, 1);
          expect(stage.height).toBeCloseTo(size.height, 1);
        }
        await page.evaluate(
          () =>
            new Promise<void>((resolve) =>
              requestAnimationFrame(() =>
                requestAnimationFrame(() => resolve()),
              ),
            ),
        );
        await page.screenshot({
          path: `${output}/${engine.name()}-${size.width}x${size.height}-${name}.png`,
        });
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBeTruthy();
      }
      console.log(
        `${engine.name()} ${size.width}×${size.height}: all eight stages captured`,
      );
    }
    expect(errors).toEqual([]);
    expect(missing).toEqual([]);
    report.push({
      engine: engine.name(),
      sizes: 11,
      stagesPerSize: 8,
      errors,
      missing,
    });
    await browser.close();
  }
  // Actual latency + bandwidth throttling, beyond the delayed-frame e2e test.
  const browser = await chromium.launch();
  qaBrowsers.push(browser);
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: 150,
    downloadThroughput: (750 * 1024) / 8,
    uploadThroughput: (250 * 1024) / 8,
  });
  const start = Date.now();
  await page.goto("http://localhost:3000/", {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  await expect(page.locator(".intro-scroll")).toHaveAttribute(
    "data-frame",
    "0",
    { timeout: 45000 },
  );
  await page.screenshot({ path: `${output}/throttled-first.png` });
  report.push({
    network: "750kbps / 150ms latency",
    firstCanvasAfterNavigationMs: Date.now() - start,
  });
  await page.evaluate(() => {
    const s = document.querySelector<HTMLElement>(".intro-scroll")!;
    window.scrollTo({
      top:
        s.offsetHeight -
        s.querySelector<HTMLElement>(".intro-sticky")!.clientHeight +
        20,
      behavior: "instant",
    });
  });
  await expect(page.locator(".site-header")).toBeInViewport();
  await page.screenshot({ path: `${output}/throttled-store.png` });
  await browser.close();
  await writeFile(`${output}/report.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await Promise.allSettled(qaBrowsers.map((browser) => browser.close()));
  });
