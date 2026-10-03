import { test, expect, type Page } from "@playwright/test";
import metadata from "../../public/intro/frames.json";
import {
  drawBounds,
  cropPosition,
  frameSource,
  introMode,
  portraitFit,
  scrollFrame,
  frameUrl,
} from "../../src/components/intro/canvas-utils";

test("actual source canvas covers the viewport uniformly without synthetic filler", async ({
  page,
}) => {
  test.setTimeout(60000);
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
      const index = Math.round(scrollFrame(progress, metadata));
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
      const bounds = drawBounds(
        size.width,
        size.height,
        source,
        size.width <= size.height
          ? cropPosition(snapshot.index, metadata.frameCount)
          : 0.5,
        snapshot.index,
        metadata.frameCount,
      );
      const { call, box, sticky } = snapshot;
      expect(call.slice(0, 4)).toEqual([
        source.x,
        source.y,
        source.width,
        source.height,
      ]);
      expect(call[4]).toBeCloseTo(bounds.x, 1);
      expect(call[5]).toBeCloseTo(bounds.y, 1);
      expect(call[6]).toBeCloseTo(bounds.width, 1);
      expect(call[7]).toBeCloseTo(bounds.height, 1);
      expect(box.width).toBeCloseTo(size.width, 1);
      expect(box.height).toBeCloseTo(size.height, 1);
      expect(box.x - sticky.x).toBeCloseTo(0, 1);
      expect(box.y - sticky.y).toBeCloseTo(0, 1);
      expect(box.x).toBeGreaterThanOrEqual(sticky.x - 0.1);
      expect(box.y).toBeGreaterThanOrEqual(sticky.y - 0.1);
      expect(box.x + box.width).toBeLessThanOrEqual(
        sticky.x + sticky.width + 0.1,
      );
      expect(box.y + box.height).toBeLessThanOrEqual(
        sticky.y + sticky.height + 0.1,
      );
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
      const index = reducedMotion === "reduce" ? metadata.frameCount - 1 : 0;
      const mode = introMode(size.width, size.height);
      const media = (await page.locator(".intro-media").boundingBox())!;
      const stage = (await page.locator(".intro-video-stage").boundingBox())!;
      const poster = page.locator(".intro-poster img");
      expect(media.width).toBeCloseTo(size.width, 1);
      expect(media.height).toBeCloseTo(size.height, 1);
      expect(media.x - stage.x).toBeCloseTo(0, 1);
      expect(media.y - stage.y).toBeCloseTo(0, 1);
      const portrait = portraitFit(size.width, size.height);
      await expect(poster).toHaveCSS(
        "object-fit",
        reducedMotion === "reduce" && portrait ? "fill" : "cover",
      );
      await expect(poster).toHaveCSS(
        "object-position",
        reducedMotion === "reduce" && portrait
          ? "50% 50%"
          : portrait
            ? "0% 50%"
            : reducedMotion === "reduce" || size.width > size.height
              ? "50% 72%"
              : "0% 72%",
      );
      const image = (await poster.boundingBox())!;
      if (reducedMotion === "reduce" && portrait) {
        // Reduced motion rests on the completed logo, so the pre-script poster
        // must already use the portrait logo framing the canvas will draw.
        const bounds = drawBounds(
          size.width,
          size.height,
          frameSource(metadata[mode], index),
          0.5,
          index,
          metadata.frameCount,
        );
        expect(image.width).toBeCloseTo(bounds.width, 1);
        expect(image.height).toBeCloseTo(bounds.height, 1);
        expect(image.x - media.x).toBeCloseTo(bounds.x, 1);
        expect(image.y - media.y).toBeCloseTo(bounds.y, 1);
      } else {
        expect(image.width).toBeCloseTo(size.width, 1);
        expect(image.height).toBeCloseTo(size.height, 1);
      }
      await expect(poster).toHaveAttribute(
        "src",
        frameUrl(metadata, "desktop", 0),
      );
      expect(
        await poster.evaluate((img: HTMLImageElement) => img.currentSrc),
      ).toContain(frameUrl(metadata, mode, index));
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
    .toBeGreaterThan(Math.round(scrollFrame(0.5, metadata)) - 2);
  await expect
    .poll(async () => Number(await intro.getAttribute("data-frame")))
    .toBeLessThan(Math.round(scrollFrame(0.5, metadata)) + 2);
  await page.waitForTimeout(180);
  const stopped = await intro.getAttribute("data-frame");
  await page.waitForTimeout(200);
  expect(await intro.getAttribute("data-frame")).toBe(stopped);
  await scrub(page, 0.9);
  await expect(intro).toHaveAttribute(
    "data-frame",
    String(metadata.frameCount - 1),
  );
  await expect(page.locator(".intro-sticky")).toHaveCSS("opacity", "1");
  await scrub(page, 0.94);
  await expect(intro).toHaveAttribute(
    "data-frame",
    String(metadata.frameCount - 1),
  );
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
    .toBeLessThan(Math.round(scrollFrame(0.45, metadata)) + 2);
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
      .toBeGreaterThan(Math.round(scrollFrame(0.7, metadata)) - 2);
    await expect
      .poll(async () => Number(await intro.getAttribute("data-frame")))
      .toBeLessThan(Math.round(scrollFrame(0.7, metadata)) + 2);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy();
    const bounds = await page.locator(".intro-media canvas").boundingBox();
    expect(bounds!.width).toBeCloseTo(size.width, 1);
    expect(bounds!.height).toBeCloseTo(size.height, 1);
  }
  await scrub(page, 0.5);
  await page.reload();
  await expect
    .poll(async () =>
      Number(await page.locator(".intro-scroll").getAttribute("data-frame")),
    )
    .toBeGreaterThan(Math.round(scrollFrame(0.5, metadata)) - 2);
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
    String(metadata.frameCount - 1),
  );
  expect(
    await page.locator(".intro-scroll").evaluate((e) => e.clientHeight),
  ).toBe(2 * (await page.evaluate(() => innerHeight)));
  await expect(page.locator(".intro-front")).toBeInViewport();
  await expect(page.locator(".intro-video-stage")).not.toBeInViewport();
  await page.waitForTimeout(200);
  expect(
    urls.every((url) =>
      url.endsWith(
        frameUrl(
          metadata,
          introMode(page.viewportSize()!.width, page.viewportSize()!.height),
          metadata.frameCount - 1,
        ),
      ),
    ),
  ).toBeTruthy();
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
    String(metadata.frameCount - 1),
  );
  await page.goto("/shop");
  await expect(page.locator(".product-card")).toHaveCount(4);
});

test("an unavailable frame does not block the store or create a canvas error", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const unavailable = String(
    Math.round(scrollFrame(0.5, metadata)) + 1,
  ).padStart(4, "0");
  await page.route(`**/intro/**/frame-${unavailable}.webp*`, (route) =>
    route.abort(),
  );
  await page.goto("/");
  await scrub(page, 0.5);
  await expect
    .poll(async () =>
      Number(await page.locator(".intro-scroll").getAttribute("data-frame")),
    )
    .toBeGreaterThan(Math.round(scrollFrame(0.5, metadata)) - 5);
  await scrub(page, 1.01);
  await page.getByRole("button", { name: "Search collection" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(errors).toEqual([]);
});
