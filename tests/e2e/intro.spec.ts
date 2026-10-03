import { test, expect, type Page } from "@playwright/test";
import metadata from "../../public/intro/frames.json";
import {
  drawBounds,
  frameSource,
  introMode,
} from "../../src/components/intro/canvas-utils";

test("actual source canvas spans both viewport edges without padding or distortion", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const original = CanvasRenderingContext2D.prototype.drawImage;
    CanvasRenderingContext2D.prototype.drawImage = function (
      this: CanvasRenderingContext2D,
      ...args: unknown[]
    ) {
      if (this.canvas.closest(".intro-media")) {
        (window as unknown as { introDraw: number[] }).introDraw = args.slice(
          1,
        ) as number[];
      }
      Reflect.apply(original, this, args);
    };
  });
  await page.goto("/");
  for (const size of [
    { width: 360, height: 800 },
    { width: 390, height: 844 },
    { width: 430, height: 932 },
    { width: 768, height: 1024 },
    { width: 800, height: 800 },
    { width: 1366, height: 640 },
    { width: 1532, height: 730 },
    { width: 1920, height: 900 },
    { width: 1920, height: 800 },
    { width: 844, height: 390 },
  ]) {
    await page.setViewportSize(size);
    for (const progress of [0, 0.5, 0.8, 0.92]) {
      const index = Math.round(
        Math.max(0, Math.min(1, (progress - 0.04) / 0.84)) * 159,
      );
      const mode = introMode(size.width, size.height);
      await scrub(page, progress);
      await expect(page.locator(".intro-scroll")).toHaveAttribute(
        "data-mode",
        mode,
      );
      await expect(page.locator(".intro-scroll")).toHaveAttribute(
        "data-frame",
        String(index),
      );
      // Read the displayed frame and its geometry atomically: progressive
      // decoding can replace a nearby frame between separate browser calls.
      const snapshot = await page.evaluate(() => ({
        index: Number(
          document.querySelector<HTMLElement>(".intro-scroll")!.dataset.frame,
        ),
        call: (window as unknown as { introDraw: number[] }).introDraw,
        box: document
          .querySelector(".intro-media canvas")!
          .getBoundingClientRect()
          .toJSON(),
        sticky: document
          .querySelector(".intro-video-stage")!
          .getBoundingClientRect()
          .toJSON(),
      }));
      const source = frameSource(metadata[mode], snapshot.index);
      const bounds = drawBounds(size.width, size.height, source);
      const { call, box, sticky } = snapshot;
      expect(call.slice(0, 4)).toEqual([
        source.x,
        source.y,
        source.width,
        source.height,
      ]);
      expect(call.slice(4, 6)).toEqual([0, 0]);
      expect(call[6]).toBeCloseTo(bounds.width, 1);
      expect(call[7]).toBeCloseTo(bounds.height, 1);
      expect(box.width).toBeCloseTo(bounds.width, 1);
      expect(box.height).toBeCloseTo(bounds.height, 1);
      expect(box.x - sticky.x).toBeCloseTo(bounds.x, 1);
      expect(box.y - sticky.y).toBeCloseTo(bounds.y, 1);
      expect(box.x).toBeCloseTo(sticky.x, 1);
      expect(box.x + box.width).toBeCloseTo(sticky.x + sticky.width, 1);
    }
  }
});

test("server-rendered poster uses the same unpadded geometry before JavaScript", async ({
  browser,
  baseURL,
}) => {
  for (const reducedMotion of ["no-preference", "reduce"] as const) {
    for (const size of [
      { width: 390, height: 844 },
      { width: 800, height: 800 },
      { width: 1532, height: 730 },
      { width: 1920, height: 800 },
      { width: 800, height: 369 },
    ]) {
      const context = await browser.newContext({
        javaScriptEnabled: false,
        viewport: size,
        reducedMotion,
      });
      const page = await context.newPage();
      await page.goto(baseURL!);
      const index = reducedMotion === "reduce" ? 159 : 0;
      const mode = introMode(size.width, size.height);
      const source = frameSource(metadata[mode], index);
      const bounds = drawBounds(size.width, size.height, source);
      const media = (await page.locator(".intro-media").boundingBox())!;
      const sticky = (await page.locator(".intro-video-stage").boundingBox())!;
      const poster = (await page.locator(".intro-poster img").boundingBox())!;
      expect(media.width).toBeCloseTo(bounds.width, 1);
      expect(media.height).toBeCloseTo(bounds.height, 1);
      expect(media.x).toBeCloseTo(sticky.x, 1);
      expect(media.y - sticky.y).toBeCloseTo(bounds.y, 1);
      expect(media.x + media.width).toBeCloseTo(sticky.x + sticky.width, 1);
      expect(poster.width).toBeCloseTo(media.width, 1);
      expect(poster.height / media.height).toBeCloseTo(
        metadata[mode].height / source.height,
        3,
      );
      expect((media.y - poster.y) / media.height).toBeCloseTo(
        source.y / source.height,
        3,
      );
      await context.close();
    }
  }
});

async function scrub(page: Page, progress: number) {
  await page.evaluate((p) => {
    const intro = document.querySelector<HTMLElement>(".intro-scroll")!;
    const front = intro.querySelector<HTMLElement>(".intro-front-range")!;
    const video = intro.querySelector<HTMLElement>(".intro-video-range")!;
    const top = intro.getBoundingClientRect().top + scrollY;
    window.scrollTo({
      top: top + front.clientHeight + p * video.clientHeight,
      behavior: "instant",
    });
  }, progress);
}

test("intro follows scroll, holds, reverses, and releases into the existing boutique", async ({
  page,
}) => {
  const errors: string[] = [],
    missing: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("response", (r) => {
    if (r.url().includes("/intro/") && r.status() >= 400) missing.push(r.url());
  });
  await page.goto("/");
  const intro = page.locator(".intro-scroll");
  await expect(intro).toHaveAttribute("data-ready", "true");
  await expect(intro).toHaveAttribute("data-frame", "0");
  await expect(page.locator("#boutique")).toHaveAttribute("inert", "");
  await page.waitForTimeout(250);
  await expect(intro).toHaveAttribute("data-frame", "0");
  await expect(page.locator("video")).toHaveCount(0);
  await scrub(page, 0.5);
  await expect
    .poll(async () => Number(await intro.getAttribute("data-frame")))
    .toBeGreaterThan(80);
  await expect
    .poll(async () => Number(await intro.getAttribute("data-frame")))
    .toBeLessThan(92);
  await page.waitForTimeout(180);
  const stopped = await intro.getAttribute("data-frame");
  await page.waitForTimeout(200);
  expect(await intro.getAttribute("data-frame")).toBe(stopped);
  await scrub(page, 0.9);
  await expect(intro).toHaveAttribute("data-frame", "159");
  await expect(page.locator(".intro-sticky")).toHaveCSS("opacity", "1");
  await scrub(page, 0.94);
  await expect(intro).toHaveAttribute("data-frame", "159");
  await scrub(page, 0.98);
  await expect
    .poll(async () =>
      Number(
        await page
          .locator(".intro-sticky")
          .evaluate((e) => getComputedStyle(e).opacity),
      ),
    )
    .toBeCloseTo(0.5, 1);
  await scrub(page, 1.01);
  await expect(page.locator("#boutique")).not.toHaveAttribute("inert", "");
  await expect(page.locator(".site-header")).toBeInViewport();
  await expect(
    page.getByRole("heading", { name: "Elegance, in every detail." }),
  ).toBeInViewport();
  await page.getByRole("button", { name: "Search collection" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await scrub(page, 0.45);
  await expect
    .poll(async () => Number(await intro.getAttribute("data-frame")))
    .toBeLessThan(85);
  await expect(page.locator(".intro-sticky")).toHaveCSS("opacity", "1");
  await scrub(page, 0);
  await expect(intro).toHaveAttribute("data-frame", "0");
  expect(errors).toEqual([]);
  expect(missing).toEqual([]);
});

test("all requested sizes resize without resetting progress or clipping the frame canvas", async ({
  page,
}) => {
  await page.goto("/");
  for (const size of [
    { width: 360, height: 800 },
    { width: 390, height: 844 },
    { width: 430, height: 932 },
    { width: 768, height: 1024 },
    { width: 1366, height: 768 },
    { width: 1920, height: 1080 },
    { width: 844, height: 390 },
  ]) {
    await page.setViewportSize(size);
    await scrub(page, 0.7);
    const intro = page.locator(".intro-scroll");
    await expect(intro).toHaveAttribute(
      "data-mode",
      size.width <= size.height ? "mobile" : "desktop",
    );
    await expect
      .poll(async () => Number(await intro.getAttribute("data-frame")))
      .toBeGreaterThan(120);
    await expect
      .poll(async () => Number(await intro.getAttribute("data-frame")))
      .toBeLessThan(130);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy();
    const bounds = await page.locator("canvas").boundingBox();
    expect(bounds!.width).toBeCloseTo(size.width, 1);
  }
  await scrub(page, 0.5);
  await page.reload();
  await expect
    .poll(async () =>
      Number(await page.locator(".intro-scroll").getAttribute("data-frame")),
    )
    .toBeGreaterThan(80);
});

test("reduced motion keeps the welcome first and shows the completed logo below it", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const urls: string[] = [];
  page.on("request", (r) => {
    if (/\/intro\/.*\.webp/.test(r.url())) urls.push(r.url());
  });
  await page.goto("/");
  await expect(page.locator(".intro-scroll")).toHaveAttribute(
    "data-frame",
    "159",
  );
  expect(
    await page.locator(".intro-scroll").evaluate((e) => e.clientHeight),
  ).toBe(2 * (await page.evaluate(() => innerHeight)));
  await expect(page.locator(".intro-front")).toBeInViewport();
  await expect(page.locator(".intro-video-stage")).not.toBeInViewport();
  await page.waitForTimeout(200);
  expect(urls.every((url) => url.includes("frame-0160.webp"))).toBeTruthy();
  await expect(page.locator("#boutique")).not.toHaveAttribute("inert", "");
  await page.locator(".site-header").scrollIntoViewIfNeeded();
  await expect(page.locator(".site-header")).toBeInViewport();
});

test("other storefront and admin routes never request animation frames", async ({
  page,
}) => {
  const urls: string[] = [];
  page.on("request", (r) => {
    if (/\/intro\//.test(r.url())) urls.push(r.url());
  });
  for (const route of [
    "/shop",
    "/product/ivory-embroidered-kurta-set",
    "/cart",
    "/checkout",
    "/admin/login",
  ]) {
    await page.goto(route);
    await expect(page.locator(".intro-scroll")).toHaveCount(0);
  }
  expect(urls).toEqual([]);
});

test("slow frame delivery keeps a server-rendered poster and permits entering the store", async ({
  page,
}) => {
  await page.route("**/intro/**/*.webp*", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 250));
    await route.continue();
  });
  await page.goto("/");
  await expect(page.locator(".intro-poster img")).toHaveJSProperty(
    "complete",
    true,
  );
  await expect(page.locator(".intro-scroll")).toHaveAttribute(
    "data-ready",
    "true",
  );
  await scrub(page, 1.01);
  await expect(page.locator(".site-header")).toBeInViewport();
  await page.getByRole("link", { name: "Shopping bag, 0 items" }).click();
  await expect(page).toHaveURL(/\/cart/);
});

test("native keyboard and touch scrolling move the animation", async ({
  page,
  isMobile,
}) => {
  await page.goto("/");
  await expect(page.locator(".intro-scroll")).toHaveAttribute(
    "data-frame",
    "0",
  );
  if (isMobile) {
    const cdp = await page.context().newCDPSession(page);
    const { width, height } = page.viewportSize()!;
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x: width / 2, y: height * 0.85 }],
    });
    for (let i = 1; i <= 8; i++) {
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x: width / 2, y: height * (0.85 - i * 0.08) }],
      });
      await page.waitForTimeout(16);
    }
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    await cdp.detach();
  } else await page.keyboard.press("PageDown");
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(100);
  await expect
    .poll(async () =>
      Number(await page.locator(".intro-scroll").getAttribute("data-frame")),
    )
    .toBeGreaterThan(0);
});

test("Image.decode fallback works when bitmap decoding is unavailable", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "createImageBitmap", { value: undefined });
  });
  await page.goto("/");
  await expect(page.locator(".intro-scroll")).toHaveAttribute(
    "data-frame",
    "0",
  );
  await scrub(page, 0.9);
  await expect(page.locator(".intro-scroll")).toHaveAttribute(
    "data-frame",
    "159",
  );
  await page.goto("/shop");
  await expect(page.locator(".product-card")).toHaveCount(4);
});

test("an unavailable frame does not block the store or create a canvas error", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("**/intro/**/frame-0088.webp*", (route) => route.abort());
  await page.goto("/");
  await scrub(page, 0.5);
  await expect
    .poll(async () =>
      Number(await page.locator(".intro-scroll").getAttribute("data-frame")),
    )
    .toBeGreaterThan(80);
  await scrub(page, 1.01);
  await page.getByRole("button", { name: "Search collection" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(errors).toEqual([]);
});
