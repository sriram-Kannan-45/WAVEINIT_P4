import { test, expect, type CDPSession, type Page } from "@playwright/test";
import metadata from "../../public/intro/frames.json";

interface IntroState {
  y: number;
  frontDistance: number;
  videoDistance: number;
  phase: string | undefined;
  frontOpacity: number;
  videoOpacity: number;
  frame: number;
}

type TraceWindow = Window & { welcomeScrollTrace: number[] };

async function state(page: Page): Promise<IntroState> {
  return page.evaluate(() => {
    const intro = document.querySelector<HTMLElement>(".intro-scroll")!;
    return {
      y: window.scrollY,
      frontDistance:
        document.querySelector<HTMLElement>(".intro-front-range")!.clientHeight,
      videoDistance:
        document.querySelector<HTMLElement>(".intro-video-range")!.clientHeight,
      phase: intro.dataset.phase,
      frontOpacity: Number(
        getComputedStyle(document.querySelector(".intro-front")!).opacity,
      ),
      videoOpacity: Number(
        getComputedStyle(document.querySelector(".intro-video-stage")!).opacity,
      ),
      frame: Number(intro.dataset.frame),
    };
  });
}

async function waitForNativeScrollToSettle(page: Page) {
  let previous = await page.evaluate(() => scrollY);
  let stable = 0;
  for (let attempt = 0; attempt < 60 && stable < 3; attempt++) {
    await page.waitForTimeout(80);
    const current = await page.evaluate(() => scrollY);
    stable = Math.abs(current - previous) < 0.5 ? stable + 1 : 0;
    previous = current;
  }
  expect(stable, "native touch scrolling settles without a scroll loop").toBe(
    3,
  );
}

async function swipe(
  page: Page,
  cdp: CDPSession,
  distance: number,
  speed: number,
  holdBeforeRelease = true,
) {
  const { width, height } = page.viewportSize()!;
  await page.evaluate(() => {
    (window as unknown as TraceWindow).welcomeScrollTrace = [];
  });
  // Send touch points through Chromium's native input/compositor pipeline;
  // no wheel listener, synthetic DOM scroll event, or scrollTo drives this path.
  const y = distance < 0 ? height * 0.82 : height * 0.18;
  const duration = (Math.abs(distance) / speed) * 1000;
  const steps = Math.max(6, Math.ceil(duration / 24));
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: width / 2, y }],
  });
  for (let step = 1; step <= steps; step++) {
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: width / 2, y: y + (distance * step) / steps }],
    });
    await page.waitForTimeout(duration / steps);
  }
  // Holding isolates movement from fling distance in the symmetry checks.
  // The separate unheld fast-flick path exercises browser momentum normally.
  if (holdBeforeRelease) await page.waitForTimeout(180);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await waitForNativeScrollToSettle(page);
  const trace = await page.evaluate(
    () => (window as unknown as TraceWindow).welcomeScrollTrace,
  );
  expect(trace.length, "native swipe dispatches scroll events").toBeGreaterThan(
    0,
  );
  for (let i = 1; i < trace.length; i++) {
    const step = trace[i]! - trace[i - 1]!;
    expect(
      Math.abs(step),
      "no application-sized jump during a native swipe",
    ).toBeLessThan(height * 0.5);
    if (distance < 0) expect(step).toBeGreaterThanOrEqual(-1);
    else expect(step).toBeLessThanOrEqual(1);
  }
}

async function assertScrollState(page: Page) {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  const measured = await state(page);
  const progress = Math.max(
    0,
    Math.min(1, measured.y / measured.frontDistance),
  );
  const eased = progress * progress * (3 - 2 * progress);
  expect(measured.frontOpacity).toBeCloseTo(1 - eased, 2);
  // The opaque video is composited beneath the fading front image. Its visible
  // contribution is the eased front transparency, without a double opacity dip.
  expect(measured.videoOpacity).toBe(progress === 0 ? 0 : 1);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  if (measured.y === 0) {
    expect(measured.phase).toBe("welcome");
    expect(measured.videoOpacity).toBe(0);
  } else if (measured.y < measured.frontDistance) {
    expect(measured.phase).toBe("transition");
    expect(measured.frontOpacity).toBeGreaterThan(0);
    expect(measured.videoOpacity).toBeGreaterThan(0);
    expect(measured.frame).toBe(0);
  } else {
    const videoProgress = Math.max(
      0,
      Math.min(
        1,
        (measured.y - measured.frontDistance) / measured.videoDistance,
      ),
    );
    expect(measured.phase).toBe(videoProgress >= 1 ? "store" : "video");
    if (videoProgress < metadata.scroll.fadeStart) {
      await expect(page.locator(".intro-sticky")).toHaveCSS("opacity", "1");
      await expect(page.locator(".intro-video-stage")).toBeInViewport();
      // The store intentionally overlaps under the opaque sticky stage during
      // the final hold; its geometric intersection does not mean it is shown.
      await expect(page.locator("#boutique")).toHaveAttribute("inert", "");
    }
    const expectedFrame = Math.round(
      Math.max(
        0,
        Math.min(
          1,
          (videoProgress - metadata.scroll.startHold) /
            (metadata.scroll.animationEnd - metadata.scroll.startHold),
        ),
      ) *
        (metadata.frameCount - 1),
    );
    await expect(page.locator(".intro-scroll")).toHaveAttribute(
      "data-frame",
      String(expectedFrame),
    );
  }
}

test("the supplied welcome fills the initial viewport and completely hides the video", async ({
  page,
}) => {
  await page.goto("/");
  const intro = page.locator(".intro-scroll");
  await expect(intro).toHaveAttribute("data-ready", "true");
  await expect(intro).toHaveAttribute("data-phase", "welcome");
  await expect(page.locator(".intro-front")).toHaveCSS("opacity", "1");
  await expect(page.locator(".intro-video-stage")).toHaveCSS("opacity", "0");
  await expect(page.locator("#boutique")).toHaveAttribute("inert", "");
  const front = (await page.locator(".intro-front").boundingBox())!;
  const artwork = (await page.locator(".intro-front-content").boundingBox())!;
  const viewport = page.viewportSize()!;
  expect(front.x).toBe(0);
  expect(front.y).toBe(0);
  expect(front.width).toBe(viewport.width);
  expect(front.height).toBe(viewport.height);
  expect(artwork.x).toBeGreaterThanOrEqual(0);
  expect(artwork.y).toBeGreaterThanOrEqual(0);
  expect(artwork.x + artwork.width).toBeLessThanOrEqual(viewport.width + 1);
  expect(artwork.y + artwork.height).toBeLessThanOrEqual(viewport.height + 1);
  await page.waitForTimeout(250);
  await assertScrollState(page);
  await expect(intro).toHaveAttribute("data-frame", "0");
  await expect(page.locator(".site-header")).not.toBeInViewport();
});

test("desktop preserves its original video timing after the new welcome distance", async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, "desktop timing is checked at a monitor aspect ratio");
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto("/");
  await expect(page.locator(".intro-scroll")).toHaveAttribute(
    "data-ready",
    "true",
  );
  const initial = await state(page);
  expect(initial.frontDistance).toBeCloseTo(768 * 0.45, 0);
  expect(initial.videoDistance).toBe(768 * 3);
  for (const progress of [0, 0.25, 0.5, 0.88, 0.94]) {
    await page.evaluate(
      ({ front, video, progress }) =>
        window.scrollTo({ top: front + video * progress, behavior: "instant" }),
      {
        front: initial.frontDistance,
        video: initial.videoDistance,
        progress,
      },
    );
    await assertScrollState(page);
    await expect(page.locator(".intro-front")).toHaveCSS("opacity", "0");
    await expect(page.locator(".intro-video-stage")).toHaveCSS("opacity", "1");
  }
  await page.evaluate(() => scrollTo({ top: 0, behavior: "instant" }));
  await expect(page.locator(".intro-scroll")).toHaveAttribute(
    "data-phase",
    "welcome",
  );
  await assertScrollState(page);
});

for (const { width, height } of [
  { width: 320, height: 760 },
  { width: 375, height: 812 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
]) {
  test(`native slow and fast swipes reveal and reverse the intro at ${width}px`, async ({
    page,
    isMobile,
  }) => {
    test.skip(
      !isMobile,
      "these gestures require a native touch-enabled context",
    );
    test.setTimeout(45000);
    await page.setViewportSize({ width, height });
    await page.addInitScript(() => {
      const target = window as unknown as TraceWindow;
      target.welcomeScrollTrace = [];
      window.addEventListener(
        "scroll",
        () => target.welcomeScrollTrace.push(window.scrollY),
        { passive: true },
      );
    });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("/");
    await expect(page.locator(".intro-scroll")).toHaveAttribute(
      "data-ready",
      "true",
    );
    await expect(page.locator(".intro-video-stage")).toHaveCSS("opacity", "0");
    const initial = await state(page);
    expect(initial.frontDistance).toBeCloseTo(height * 0.45, 0);
    expect(initial.videoDistance).toBeCloseTo(height * 3.5, 0);
    const artwork = (await page.locator(".intro-front-content").boundingBox())!;
    expect(artwork.x).toBeGreaterThanOrEqual(0);
    expect(artwork.x + artwork.width).toBeLessThanOrEqual(width + 1);
    const cdp = await page.context().newCDPSession(page);
    // Slow partial swipe exposes both layers without advancing the video.
    await swipe(page, cdp, -height * 0.24, 180);
    expect((await state(page)).y).toBeGreaterThan(0);
    expect((await state(page)).y).toBeLessThan(initial.frontDistance);
    await assertScrollState(page);
    // One ordinary longer swipe completes the reveal and enters the video.
    await swipe(page, cdp, -height * 0.6, 1500);
    expect((await state(page)).y).toBeGreaterThan(initial.frontDistance);
    await assertScrollState(page);
    await expect(page.locator(".intro-scroll")).toHaveAttribute(
      "data-phase",
      "video",
    );
    // Reversing the same native gesture returns smoothly through the transition.
    await swipe(page, cdp, height * 0.6, 1500);
    expect((await state(page)).y).toBeLessThan(initial.frontDistance);
    await assertScrollState(page);
    await swipe(page, cdp, height * 0.5, 180);
    expect((await state(page)).y).toBe(0);
    await assertScrollState(page);
    await expect(page.locator(".intro-scroll")).toHaveAttribute(
      "data-frame",
      "0",
    );
    await expect(page.locator(".intro-video-stage")).toHaveCSS("opacity", "0");
    // A normal fast finger release must also finish the reveal in one gesture.
    // Let native momentum run, then assert its actual resulting scroll state.
    await swipe(page, cdp, -height * 0.6, 2200, false);
    expect((await state(page)).y).toBeGreaterThan(initial.frontDistance);
    await assertScrollState(page);
    for (let attempt = 0; attempt < 6 && (await state(page)).y > 0; attempt++) {
      await swipe(page, cdp, height * 0.64, 2200, false);
    }
    expect(
      (await state(page)).y,
      "native fast flicks can return to the first screen",
    ).toBe(0);
    await assertScrollState(page);
    await expect(page.locator(".intro-video-stage")).toHaveCSS("opacity", "0");
    await cdp.detach();
    expect(errors).toEqual([]);
  });
}

test("mobile viewport resize retains native scroll position and recomputes responsive geometry", async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, "mobile viewport and address-bar resize behavior");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    const target = window as unknown as TraceWindow;
    target.welcomeScrollTrace = [];
    window.addEventListener(
      "scroll",
      () => target.welcomeScrollTrace.push(window.scrollY),
      { passive: true },
    );
  });
  await page.goto("/");
  await expect(page.locator(".intro-scroll")).toHaveAttribute(
    "data-ready",
    "true",
  );
  const cdp = await page.context().newCDPSession(page);
  await swipe(page, cdp, -844 * 0.24, 300);
  const before = await state(page);
  // Address-bar changes dispatch visual viewport events without intentionally
  // changing the physical small-viewport scroll range or moving the document.
  await page.evaluate(() => {
    window.visualViewport?.dispatchEvent(new Event("resize"));
    window.dispatchEvent(new Event("resize"));
  });
  await page.waitForTimeout(120);
  const addressBar = await state(page);
  expect(addressBar.y).toBe(before.y);
  expect(addressBar.frontDistance).toBe(before.frontDistance);
  expect(addressBar.videoDistance).toBe(before.videoDistance);
  expect(addressBar.frontOpacity).toBe(before.frontOpacity);
  await page.setViewportSize({ width: 390, height: 740 });
  await expect
    .poll(async () => (await state(page)).frontDistance)
    .toBeCloseTo(740 * 0.45, 0);
  expect((await state(page)).y).toBe(before.y);
  await assertScrollState(page);
  const front = (await page.locator(".intro-front").boundingBox())!;
  expect(front.width).toBe(390);
  expect(front.height).toBe(740);
  await cdp.detach();
});
