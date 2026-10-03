import {
  test,
  expect,
  devices,
  type BrowserContext,
  type CDPSession,
  type Page,
} from "@playwright/test";
import metadata from "../../public/intro/frames.json";

interface ExposureSample {
  time: number;
  frame: number;
  phase: string | undefined;
  visible: boolean;
}
type ExposureWindow = Window & {
  introExposure: ExposureSample[];
  sampleIntroExposure: boolean;
};

async function dimensions(page: Page) {
  return page.evaluate(() => ({
    y: scrollY,
    height: innerHeight,
    width: innerWidth,
    front:
      document.querySelector<HTMLElement>(".intro-front-range")!.clientHeight,
    video:
      document.querySelector<HTMLElement>(".intro-video-range")!.clientHeight,
    section: document.querySelector<HTMLElement>(".intro-scroll")!.clientHeight,
  }));
}

async function scrub(page: Page, progress: number) {
  const size = await dimensions(page);
  await page.evaluate(
    ({ front, video, progress }) =>
      scrollTo({ top: front + video * progress, behavior: "instant" }),
    { ...size, progress },
  );
}

async function assertVisiblePeacock(page: Page, flying = false) {
  const intro = page.locator(".intro-scroll");
  await expect(intro).toHaveAttribute("data-phase", "video");
  await expect(page.locator(".intro-front")).toHaveCSS("opacity", "0");
  await expect(page.locator(".intro-video-stage")).toHaveCSS("opacity", "1");
  await expect(page.locator(".intro-sticky")).toHaveCSS("opacity", "1");
  await expect(page.locator(".intro-media canvas")).toHaveCSS("opacity", "1");
  await expect(page.locator("#boutique")).toHaveAttribute("inert", "");
  const video = (await page.locator(".intro-video-stage").boundingBox())!;
  const canvas = (await page.locator(".intro-media canvas").boundingBox())!;
  const viewport = page.viewportSize()!;
  expect(video.x).toBeCloseTo(0, 1);
  expect(video.y).toBeCloseTo(0, 1);
  expect(video.width).toBeCloseTo(viewport.width, 1);
  expect(video.height).toBeCloseTo(viewport.height, 1);
  expect(canvas.width).toBeCloseTo(video.width, 1);
  expect(canvas.height).toBeCloseTo(video.height, 1);
  expect(canvas.x - video.x).toBeCloseTo(0, 1);
  expect(canvas.y - video.y).toBeCloseTo(0, 1);
  expect(canvas.height).toBeGreaterThan(0);
  if (flying) {
    await expect
      .poll(async () => Number(await intro.getAttribute("data-frame")))
      .toBeGreaterThan(0);
    await expect
      .poll(async () => Number(await intro.getAttribute("data-frame")))
      .toBeLessThan(metadata.frameCount * 0.78);
  }
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
}

async function assertStore(page: Page) {
  await expect(page.locator(".intro-scroll")).toHaveAttribute(
    "data-phase",
    "store",
  );
  await expect(page.locator(".intro-scroll")).toHaveAttribute(
    "data-active",
    "false",
  );
  await expect(page.locator(".intro-sticky")).toHaveCSS("opacity", "0");
  await expect(page.locator("#boutique")).not.toHaveAttribute("inert", "");
  await expect(page.locator(".site-header")).toBeInViewport();
}

async function emulateLegacyViewportUnits(context: BrowserContext) {
  await context.addInitScript(() => {
    const original = CSS.supports.bind(CSS);
    CSS.supports = (property: string, value?: string) => {
      if (/(?:s|d)vh\b/.test(`${property} ${value ?? ""}`)) return false;
      return value === undefined
        ? original(property)
        : original(property, value);
    };
  });
  await context.route("**/*.css*", async (route) => {
    const response = await route.fetch();
    const css = (await response.text()).replace(
      /\b(\d*\.?\d+)([ds]vh)\b/g,
      (_, number: string) => `${number}xvh`,
    );
    // Adapt only CSS feature support. Changing HTML or JavaScript can corrupt
    // streamed React payloads and would test hydration failure instead.
    await route.fulfill({ response, body: css });
  });
}

async function gesture(
  page: Page,
  cdp: CDPSession,
  fraction: number,
  duration: number,
  hold = false,
) {
  const { width, height } = page.viewportSize()!;
  const start = fraction < 0 ? height * 0.97 : height * 0.03;
  const distance = fraction * height;
  const steps = Math.max(5, Math.ceil(duration / 24));
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: width / 2, y: start }],
  });
  for (let step = 1; step <= steps; step++) {
    await page.waitForTimeout(duration / steps);
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: width / 2, y: start + (distance * step) / steps }],
    });
  }
  if (hold) await page.waitForTimeout(180);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
}

async function settle(page: Page) {
  let previous = await page.evaluate(() => scrollY),
    stable = 0;
  for (let attempt = 0; attempt < 60 && stable < 3; attempt++) {
    await page.waitForTimeout(80);
    const y = await page.evaluate(() => scrollY);
    stable = Math.abs(y - previous) < 0.5 ? stable + 1 : 0;
    previous = y;
  }
  expect(stable, "native scrolling settles").toBe(3);
}

test("all nine requested widths retain a visible peacock stage between welcome and store", async ({
  page,
  isMobile,
}) => {
  test.skip(
    isMobile,
    "viewport geometry is shared; native touch is checked separately",
  );
  test.setTimeout(60000);
  await page.goto("/");
  await expect(page.locator(".intro-scroll")).toHaveAttribute(
    "data-ready",
    "true",
  );
  for (const viewport of [
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
    await page.setViewportSize(viewport);
    await page.evaluate(() => scrollTo({ top: 0, behavior: "instant" }));
    await expect(page.locator(".intro-scroll")).toHaveAttribute(
      "data-phase",
      "welcome",
    );
    await expect(page.locator(".intro-video-stage")).toHaveCSS("opacity", "0");
    const size = await dimensions(page);
    expect(size.front).toBe(Math.round(viewport.height * 0.45));
    expect(size.video).toBeCloseTo(
      viewport.height * (viewport.width <= viewport.height ? 3.5 : 3),
      0,
    );
    expect(size.section).toBeGreaterThan(size.front + size.video);
    await scrub(page, 0.45);
    const frame = Math.round(
      ((0.45 - metadata.scroll.startHold) /
        (metadata.scroll.animationEnd - metadata.scroll.startHold)) *
        (metadata.frameCount - 1),
    );
    await expect(page.locator(".intro-scroll")).toHaveAttribute(
      "data-frame",
      String(frame),
    );
    await assertVisiblePeacock(page, true);
    await scrub(page, 1.01);
    await assertStore(page);
    await scrub(page, 0.45);
    await assertVisiblePeacock(page, true);
  }
});

test("unsupported dynamic and small viewport units keep physical scroll ranges and the peacock visible", async ({
  browser,
  baseURL,
  isMobile,
}) => {
  test.skip(
    isMobile,
    "legacy contexts are created explicitly to avoid duplicate runs",
  );
  test.setTimeout(60000);
  for (const javaScriptEnabled of [true, false]) {
    for (const viewport of [
      { width: 390, height: 844 },
      { width: 844, height: 390 },
    ]) {
      const context = await browser.newContext({
        ...devices["iPhone 13"],
        viewport,
        javaScriptEnabled,
      });
      await emulateLegacyViewportUnits(context);
      const page = await context.newPage();
      await page.goto(baseURL!);
      if (javaScriptEnabled) {
        await expect(page.locator(".intro-scroll")).toHaveAttribute(
          "data-ready",
          "true",
        );
        const before = await dimensions(page);
        expect(before.front).toBe(Math.round(viewport.height * 0.45));
        expect(before.video).toBeCloseTo(
          viewport.height * (viewport.width <= viewport.height ? 3.5 : 3),
          0,
        );
        expect(before.section).toBeGreaterThan(before.front + before.video);
        await scrub(page, 0.4);
        await assertVisiblePeacock(page, true);
        const y = await page.evaluate(() => scrollY);
        await page.setViewportSize({
          width: viewport.width,
          height: viewport.height - 40,
        });
        await expect
          .poll(() =>
            page
              .locator(".intro-video-stage")
              .evaluate((element) => element.clientHeight),
          )
          .toBe(viewport.height - 40);
        const resized = await dimensions(page);
        expect(resized.y).toBe(y);
        expect(resized.front).toBe(before.front);
        expect(resized.video).toBe(before.video);
        await assertVisiblePeacock(page, true);
        await scrub(page, 1.01);
        await assertStore(page);
        await scrub(page, 0.4);
        await assertVisiblePeacock(page, true);
      } else {
        const front = (await page.locator(".intro-front").boundingBox())!;
        expect(front.height).toBe(viewport.height);
        const stage = (await page.locator(".intro-video-stage").boundingBox())!;
        expect(stage.y).toBe(viewport.height);
        expect(stage.height).toBe(viewport.height);
        await page.evaluate(
          (height) => scrollTo({ top: height, behavior: "instant" }),
          viewport.height,
        );
        await expect(page.locator(".intro-video-stage")).toHaveCSS(
          "opacity",
          "1",
        );
        const visible = (await page
          .locator(".intro-video-stage")
          .boundingBox())!;
        expect(visible.y).toBe(0);
        await expect(page.locator(".intro-poster img")).toHaveJSProperty(
          "complete",
          true,
        );
        await page.evaluate(
          (height) => scrollTo({ top: height * 2 + 20, behavior: "instant" }),
          viewport.height,
        );
        await expect(page.locator(".site-header")).toBeInViewport();
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBeTruthy();
      }
      await context.close();
    }
  }
});

for (const viewport of [
  { width: 320, height: 760 },
  { width: 375, height: 812 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
]) {
  test(`slow swipe and repeated fast flicks expose flying frames before the store at ${viewport.width}px`, async ({
    page,
    isMobile,
  }) => {
    test.skip(!isMobile, "requires a native touch-enabled context");
    test.setTimeout(45000);
    await page.setViewportSize(viewport);
    await page.goto("/");
    await expect(page.locator(".intro-scroll")).toHaveAttribute(
      "data-ready",
      "true",
    );
    await page.evaluate(() => {
      const target = window as unknown as ExposureWindow;
      target.introExposure = [];
      target.sampleIntroExposure = true;
      const sample = (time: number) => {
        const intro = document.querySelector<HTMLElement>(".intro-scroll")!;
        const stage =
          document.querySelector<HTMLElement>(".intro-video-stage")!;
        const rect = stage.getBoundingClientRect();
        const frontOpacity = Number(
          getComputedStyle(document.querySelector(".intro-front")!).opacity,
        );
        const parentOpacity = Number(
          getComputedStyle(document.querySelector(".intro-sticky")!).opacity,
        );
        const stageOpacity = Number(getComputedStyle(stage).opacity);
        target.introExposure.push({
          time,
          frame: Number(intro.dataset.frame),
          phase: intro.dataset.phase,
          visible:
            frontOpacity < 0.05 &&
            parentOpacity > 0.95 &&
            stageOpacity > 0.95 &&
            rect.top >= -1 &&
            rect.bottom <= innerHeight + 1 &&
            rect.height >= innerHeight - 1,
        });
        if (target.sampleIntroExposure) requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    });
    const cdp = await page.context().newCDPSession(page);
    await gesture(page, cdp, -0.24, 800, true);
    await settle(page);
    await expect(page.locator(".intro-scroll")).toHaveAttribute(
      "data-phase",
      "transition",
    );
    await expect(page.locator(".intro-scroll")).toHaveAttribute(
      "data-frame",
      "0",
    );
    for (let swipe = 0; swipe < 5; swipe++) {
      await gesture(page, cdp, -0.94, 60);
      await page.waitForTimeout(70);
    }
    await settle(page);
    await assertStore(page);
    const samples = await page.evaluate(() => {
      const target = window as unknown as ExposureWindow;
      target.sampleIntroExposure = false;
      return target.introExposure;
    });
    const firstStore = samples.find((sample) => sample.phase === "store")!;
    expect(firstStore, "the trace reaches the store").toBeTruthy();
    const flight = samples.filter(
      (sample) =>
        sample.visible &&
        sample.frame > 0 &&
        sample.frame < metadata.frameCount * 0.78 &&
        sample.time < firstStore.time,
    );
    expect(
      flight.length,
      "flying peacock frames are actually onscreen before ecommerce appears",
    ).toBeGreaterThan(1);
    const exposed = flight.reduce(
      (sum, sample, index) =>
        sum +
        (index && sample.time - flight[index - 1]!.time < 60
          ? sample.time - flight[index - 1]!.time
          : 0),
      0,
    );
    expect(
      exposed,
      "the fast native path displays flying frames, not only a terminal dataset value",
    ).toBeGreaterThan(150);
    const range = await dimensions(page);
    for (
      let swipe = 0;
      swipe < 6 &&
      (await dimensions(page)).y > range.front + range.video * 0.65;
      swipe++
    ) {
      await gesture(page, cdp, 0.9, 160);
      await settle(page);
    }
    await assertVisiblePeacock(page, true);
    await cdp.detach();
  });
}
