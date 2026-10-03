import { networkInterfaces } from "node:os";
import {
  test,
  expect,
  devices,
  type Page,
  type CDPSession,
  type ConsoleMessage,
  type Request,
  type Response,
  type WebSocket,
} from "@playwright/test";
import metadata from "../../public/intro/frames.json";

function networkUrl(localUrl: string) {
  if (process.env.E2E_LAN_URL) return new URL(process.env.E2E_LAN_URL).href;
  const addresses = Object.values(networkInterfaces())
    .flatMap((entries) => entries ?? [])
    .filter((entry) => entry.family === "IPv4" && !entry.internal);
  const priority = (address: string) =>
    address.startsWith("192.168.") ? 0 : address.startsWith("10.") ? 1 : 2;
  addresses.sort((a, b) => priority(a.address) - priority(b.address));
  if (!addresses.length)
    throw new Error(
      "No LAN IPv4 interface found. Set E2E_LAN_URL to the running LAN preview URL.",
    );
  const url = new URL(localUrl);
  url.hostname = addresses[0]!.address;
  return url.href;
}

function diagnostics(page: Page) {
  const pageErrors: string[] = [],
    consoleErrors: string[] = [],
    failed: string[] = [],
    badAssets: string[] = [],
    socketErrors: string[] = [];
  let hmrFrames = 0,
    hmrConnected = false;
  const onError = (error: Error) => pageErrors.push(error.message);
  const onConsole = (message: ConsoleMessage) => {
    if (message.type() === "error") consoleErrors.push(message.text());
    if (message.text().includes("[HMR] connected")) hmrConnected = true;
  };
  const onFailed = (request: Request) => {
    // Strict-mode effect cleanup and navigation intentionally cancel obsolete
    // frame fetches. Other transport failures must still fail the origin test.
    if (request.failure()?.errorText !== "net::ERR_ABORTED")
      failed.push(`${request.url()}: ${request.failure()?.errorText}`);
  };
  const onResponse = (response: Response) => {
    if (response.status() >= 400)
      badAssets.push(`${response.status()} ${response.url()}`);
  };
  const onSocket = (socket: WebSocket) => {
    if (!socket.url().includes("/_next/hmr")) return;
    socket.on("framereceived", () => hmrFrames++);
    socket.on("socketerror", (error) => socketErrors.push(error));
  };
  page.on("pageerror", onError);
  page.on("console", onConsole);
  page.on("requestfailed", onFailed);
  page.on("response", onResponse);
  page.on("websocket", onSocket);
  return {
    status: () => ({
      pageErrors,
      consoleErrors,
      failed,
      badAssets,
      socketErrors,
      hmrFrames,
      hmrConnected,
    }),
    detach: () => {
      page.off("pageerror", onError);
      page.off("console", onConsole);
      page.off("requestfailed", onFailed);
      page.off("response", onResponse);
      page.off("websocket", onSocket);
    },
  };
}

async function snapshot(page: Page) {
  return page.evaluate(() => {
    const intro = document.querySelector<HTMLElement>(".intro-scroll")!;
    const stage = document.querySelector<HTMLElement>(".intro-video-stage")!;
    const box = stage.getBoundingClientRect();
    return {
      phase: intro.dataset.phase,
      ready: intro.dataset.ready,
      frame: intro.dataset.frame,
      width: innerWidth,
      height: innerHeight,
      frontRange:
        document.querySelector<HTMLElement>(".intro-front-range")!.clientHeight,
      videoRange:
        document.querySelector<HTMLElement>(".intro-video-range")!.clientHeight,
      introHeight: intro.clientHeight,
      stageWidth: box.width,
      stageHeight: box.height,
      frontOpacity: getComputedStyle(document.querySelector(".intro-front")!)
        .opacity,
      stageOpacity: getComputedStyle(stage).opacity,
      parentOpacity: getComputedStyle(document.querySelector(".intro-sticky")!)
        .opacity,
      inert: document.querySelector<HTMLElement>("#boutique")!.inert,
    };
  });
}

async function initialState(page: Page) {
  await expect(page.locator(".intro-scroll")).toHaveAttribute(
    "data-ready",
    "true",
  );
  await expect(page.locator(".intro-scroll")).toHaveAttribute(
    "data-phase",
    "welcome",
  );
  await expect(page.locator(".intro-scroll")).toHaveAttribute(
    "data-frame",
    "0",
  );
  const result = await snapshot(page);
  expect(result.frame).toBe("0");
  expect(result.frontOpacity).toBe("1");
  expect(result.stageOpacity).toBe("0");
  expect(result.parentOpacity).toBe("1");
  expect(result.inert).toBe(true);
  expect(result.frontRange).toBeGreaterThan(0);
  expect(result.videoRange).toBeGreaterThan(result.height);
  expect(result.stageWidth).toBe(result.width);
  expect(result.stageHeight).toBe(result.height);
  return result;
}

async function scrub(page: Page, progress: number) {
  await page.evaluate((progress) => {
    const front =
      document.querySelector<HTMLElement>(".intro-front-range")!.clientHeight;
    const video =
      document.querySelector<HTMLElement>(".intro-video-range")!.clientHeight;
    scrollTo({ top: front + video * progress, behavior: "instant" });
  }, progress);
}

async function visibleVideo(page: Page) {
  await expect(page.locator(".intro-scroll")).toHaveAttribute(
    "data-phase",
    "video",
  );
  await expect(page.locator(".intro-front")).toHaveCSS("opacity", "0");
  await expect(page.locator(".intro-video-stage")).toHaveCSS("opacity", "1");
  await expect(page.locator(".intro-sticky")).toHaveCSS("opacity", "1");
  await expect(page.locator(".intro-media canvas")).toHaveCSS("opacity", "1");
  const stage = (await page.locator(".intro-video-stage").boundingBox())!;
  const viewport = page.viewportSize()!;
  expect(stage.x).toBe(0);
  expect(stage.y).toBe(0);
  expect(stage.width).toBe(viewport.width);
  expect(stage.height).toBe(viewport.height);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
}

async function fullFlow(page: Page) {
  await scrub(page, 0.5);
  const midpoint = Math.round(
    ((0.5 - metadata.scroll.startHold) /
      (metadata.scroll.animationEnd - metadata.scroll.startHold)) *
      (metadata.frameCount - 1),
  );
  await expect(page.locator(".intro-scroll")).toHaveAttribute(
    "data-frame",
    String(midpoint),
  );
  await visibleVideo(page);
  await scrub(page, 0.92);
  await expect(page.locator(".intro-scroll")).toHaveAttribute(
    "data-frame",
    String(metadata.frameCount - 1),
  );
  await visibleVideo(page);
  await scrub(page, 1.01);
  await expect(page.locator(".intro-scroll")).toHaveAttribute(
    "data-phase",
    "store",
  );
  await expect(page.locator(".intro-sticky")).toHaveCSS("opacity", "0");
  await expect(page.locator("#boutique")).not.toHaveAttribute("inert", "");
  await expect(page.locator(".site-header")).toBeInViewport();
}

async function assertDiagnostics(monitor: ReturnType<typeof diagnostics>) {
  await expect.poll(() => monitor.status().hmrFrames).toBeGreaterThan(0);
  expect(monitor.status().hmrConnected).toBe(true);
  expect(monitor.status().pageErrors).toEqual([]);
  expect(monitor.status().consoleErrors).toEqual([]);
  expect(monitor.status().failed).toEqual([]);
  expect(monitor.status().badAssets).toEqual([]);
  expect(monitor.status().socketErrors).toEqual([]);
}

async function touch(
  page: Page,
  cdp: CDPSession,
  fraction: number,
  duration: number,
  hold = false,
) {
  const { width, height } = page.viewportSize()!;
  const start = fraction < 0 ? height * 0.97 : height * 0.03;
  const steps = Math.max(5, Math.ceil(duration / 24));
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: width / 2, y: start }],
  });
  for (let step = 1; step <= steps; step++) {
    await page.waitForTimeout(duration / steps);
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [
        { x: width / 2, y: start + (fraction * height * step) / steps },
      ],
    });
  }
  if (hold) await page.waitForTimeout(180);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  let previous = await page.evaluate(() => scrollY),
    stable = 0;
  for (let attempt = 0; attempt < 50 && stable < 3; attempt++) {
    await page.waitForTimeout(80);
    const y = await page.evaluate(() => scrollY);
    stable = Math.abs(y - previous) < 0.5 ? stable + 1 : 0;
    previous = y;
  }
  expect(stable).toBe(3);
}

test("localhost and LAN hydrate identically across desktop, tablet, and phone landscape with live HMR", async ({
  browser,
  baseURL,
  isMobile,
}) => {
  test.skip(isMobile, "paired desktop/tablet contexts are created explicitly");
  test.setTimeout(240000);
  const urls = [new URL(baseURL!).href, networkUrl(baseURL!)];
  for (const viewport of [
    { width: 1366, height: 768 },
    { width: 768, height: 1024 },
    { width: 1440, height: 900 },
    { width: 1920, height: 1080 },
    { width: 1024, height: 768 },
    { width: 844, height: 390 },
  ]) {
    const phoneLandscape = viewport.width === 844;
    const context = await browser.newContext({
      ...(phoneLandscape ? devices["iPhone 13"] : {}),
      viewport,
      reducedMotion: "no-preference",
    });
    let reference: Awaited<ReturnType<typeof snapshot>> | undefined;
    for (const url of urls) {
      const page = await context.newPage();
      const monitor = diagnostics(page);
      await page.goto(url);
      const initial = await initialState(page);
      if (reference) expect(initial).toEqual(reference);
      else reference = initial;
      let cdp: CDPSession | undefined;
      if (phoneLandscape) {
        cdp = await context.newCDPSession(page);
        await touch(page, cdp, -0.24, 800, true);
        await expect(page.locator(".intro-scroll")).toHaveAttribute(
          "data-phase",
          "transition",
        );
        await touch(page, cdp, -0.62, 160);
        await visibleVideo(page);
      }
      await fullFlow(page);
      if (cdp) {
        const target = initial.frontRange + initial.videoRange * 0.6;
        for (
          let swipe = 0;
          swipe < 4 && (await page.evaluate(() => scrollY)) > target;
          swipe++
        )
          await touch(page, cdp, 0.92, 160);
      } else await scrub(page, 0.5);
      await visibleVideo(page);
      await page.evaluate(() => scrollTo({ top: 0, behavior: "instant" }));
      await initialState(page);
      await assertDiagnostics(monitor);
      await test
        .info()
        .attach(`origin-${new URL(url).hostname}-${viewport.width}`, {
          body: JSON.stringify(
            { url, initial, diagnostics: monitor.status() },
            null,
            2,
          ),
          contentType: "application/json",
        });
      monitor.detach();
      await cdp?.detach();
      await page.close();
    }
    await context.close();
  }
});

for (const viewport of [
  { width: 320, height: 760 },
  { width: 375, height: 812 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
]) {
  test(`native slow/fast touch and reverse work on both origins at ${viewport.width}px`, async ({
    page,
    baseURL,
    isMobile,
  }) => {
    test.skip(!isMobile, "requires native touch-enabled mobile context");
    test.setTimeout(60000);
    await page.setViewportSize(viewport);
    let reference: Awaited<ReturnType<typeof snapshot>> | undefined;
    for (const url of [new URL(baseURL!).href, networkUrl(baseURL!)]) {
      const monitor = diagnostics(page);
      await page.goto(url);
      const initial = await initialState(page);
      if (reference) expect(initial).toEqual(reference);
      else reference = initial;
      const cdp = await page.context().newCDPSession(page);
      await touch(page, cdp, -0.24, 800, true);
      await expect(page.locator(".intro-scroll")).toHaveAttribute(
        "data-phase",
        "transition",
      );
      await expect(page.locator(".intro-scroll")).toHaveAttribute(
        "data-frame",
        "0",
      );
      await touch(page, cdp, -0.62, 160);
      await visibleVideo(page);
      await expect
        .poll(async () =>
          Number(
            await page.locator(".intro-scroll").getAttribute("data-frame"),
          ),
        )
        .toBeGreaterThan(0);
      await expect
        .poll(async () =>
          Number(
            await page.locator(".intro-scroll").getAttribute("data-frame"),
          ),
        )
        .toBeLessThan(metadata.frameCount * 0.78);
      await fullFlow(page);
      const target = initial.frontRange + initial.videoRange * 0.6;
      for (
        let swipe = 0;
        swipe < 4 && (await page.evaluate(() => scrollY)) > target;
        swipe++
      )
        await touch(page, cdp, 0.92, 160);
      await visibleVideo(page);
      await expect
        .poll(async () =>
          Number(
            await page.locator(".intro-scroll").getAttribute("data-frame"),
          ),
        )
        .toBeLessThan(metadata.frameCount * 0.78);
      await page.evaluate(() => scrollTo({ top: 0, behavior: "instant" }));
      await initialState(page);
      await assertDiagnostics(monitor);
      await test
        .info()
        .attach(`origin-${new URL(url).hostname}-${viewport.width}`, {
          body: JSON.stringify(
            { url, initial, diagnostics: monitor.status() },
            null,
            2,
          ),
          contentType: "application/json",
        });
      await cdp.detach();
      monitor.detach();
    }
  });
}
