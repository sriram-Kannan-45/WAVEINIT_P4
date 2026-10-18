import { test, expect as baseExpect, type Page } from "@playwright/test";
import metadata from "../../public/intro/frames.json";
import { scrollFrame } from "../../src/components/intro/canvas-utils";

const expect = baseExpect.configure({ timeout: 20000 });
test.setTimeout(60000);

async function scrub(page: Page, progress: number) {
  await page.evaluate((progress) => {
    const intro = document.querySelector<HTMLElement>(".intro-scroll")!;
    const front =
      intro.querySelector<HTMLElement>(".intro-front-range")!.clientHeight;
    const range =
      intro.querySelector<HTMLElement>(".intro-video-range")!.clientHeight;
    scrollTo({
      top:
        intro.getBoundingClientRect().top + scrollY + front + range * progress,
      behavior: "instant",
    });
  }, progress);
}

async function settled(page: Page, progress: number) {
  await expect
    .poll(async () =>
      Math.abs(
        Number(await page.locator(".intro-scroll").getAttribute("data-frame")) -
          Math.round(scrollFrame(progress, metadata)),
      ),
    )
    .toBe(0);
}

async function sample(page: Page, duration = 1200) {
  return page.evaluate(
    (duration) =>
      new Promise<number[]>((resolve) => {
        const start = performance.now();
        const values: number[] = [];
        const tick = () => {
          values.push(
            Number(
              document.querySelector<HTMLElement>(".intro-scroll")!.dataset
                .frame,
            ),
          );
          if (performance.now() - start < duration) requestAnimationFrame(tick);
          else resolve(values);
        };
        tick();
      }),
    duration,
  );
}

test("short scrolls, two long scrolls and reversal retain every displayed frame", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page.locator(".intro-scroll")).toHaveAttribute(
    "data-frame",
    "0",
  );
  for (const progress of [0.08, 0.16]) {
    await scrub(page, progress);
    await settled(page, progress);
  }
  await scrub(page, 0.5);
  const forward = await sample(page);
  expect(forward.at(-1)!).toBeGreaterThan(forward[0]);
  for (let i = 1; i < forward.length; i++)
    expect(forward[i] - forward[i - 1]).toBeGreaterThanOrEqual(0);
  for (let i = 1; i < forward.length; i++)
    expect(forward[i] - forward[i - 1]).toBeLessThanOrEqual(1);
  await settled(page, 0.5);
  const still = await sample(page, 250);
  expect(new Set(still).size).toBe(1);
  await scrub(page, 1);
  await settled(page, 1);
  await expect(page.locator(".intro-scroll")).toHaveAttribute(
    "data-active",
    "false",
  );
  await expect(page.locator(".site-header")).toBeInViewport();
  await scrub(page, 0.5);
  const reverse = await sample(page);
  expect(reverse.at(-1)!).toBeLessThan(reverse[0]);
  for (let i = 1; i < reverse.length; i++)
    expect(reverse[i] - reverse[i - 1]).toBeGreaterThanOrEqual(-1);
  for (let i = 1; i < reverse.length; i++)
    expect(reverse[i] - reverse[i - 1]).toBeLessThanOrEqual(0);
  await settled(page, 0.5);
  await scrub(page, 0);
  const reverseToStart = await sample(page);
  for (let i = 1; i < reverseToStart.length; i++) {
    expect(reverseToStart[i] - reverseToStart[i - 1]).toBeGreaterThanOrEqual(
      -1,
    );
    expect(reverseToStart[i] - reverseToStart[i - 1]).toBeLessThanOrEqual(0);
  }
  expect(reverseToStart.at(-1)!).toBeLessThan(reverseToStart[0]);
  await settled(page, 0);
  expect(errors).toEqual([]);
});

test("rapid changes retain the latest target while a frame is delayed", async ({
  page,
}) => {
  await page.route("**/intro/**/frame-0025.webp*", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 600));
    await route.continue();
  });
  await page.goto("/");
  await expect(page.locator(".intro-scroll")).toHaveAttribute(
    "data-frame",
    "0",
  );
  for (const progress of [0.8, 0.2, 0.9, 0.4, 0.15]) {
    await scrub(page, progress);
    await page.waitForTimeout(40);
  }
  await settled(page, 0.15);
  const stopped = await sample(page, 350);
  expect(new Set(stopped).size).toBe(1);
  await page.reload();
  await settled(page, 0.15);
});

test("native wheel, held Arrow Down and touch input remain mapped to position", async ({
  page,
  isMobile,
}) => {
  await page.goto("/");
  await expect(page.locator(".intro-scroll")).toHaveAttribute(
    "data-frame",
    "0",
  );
  await scrub(page, 0.1);
  await settled(page, 0.1);
  if (isMobile) {
    const session = await page.context().newCDPSession(page);
    const { width, height } = page.viewportSize()!;
    for (let gesture = 0; gesture < 2; gesture++) {
      await session.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [{ x: width / 2, y: height * 0.85 }],
      });
      for (let step = 1; step <= 10; step++) {
        await session.send("Input.dispatchTouchEvent", {
          type: "touchMove",
          touchPoints: [{ x: width / 2, y: height * (0.85 - step * 0.06) }],
        });
        await page.waitForTimeout(30);
      }
      await session.send("Input.dispatchTouchEvent", {
        type: "touchEnd",
        touchPoints: [],
      });
      await page.waitForTimeout(300);
    }
    await session.detach();
  } else {
    await page.mouse.wheel(0, 900);
    for (let i = 0; i < 24; i++) {
      await page.keyboard.down("ArrowDown");
      await page.waitForTimeout(40);
    }
    await page.keyboard.up("ArrowDown");
  }
  await page.waitForTimeout(500);
  const progress = await page.evaluate(() => {
    const intro = document.querySelector<HTMLElement>(".intro-scroll")!;
    return (
      (scrollY -
        (intro.getBoundingClientRect().top + scrollY) -
        intro.querySelector<HTMLElement>(".intro-front-range")!.clientHeight) /
      intro.querySelector<HTMLElement>(".intro-video-range")!.clientHeight
    );
  });
  expect(progress).toBeGreaterThan(0.1);
  await settled(page, progress);
});

test("category reveals wait for intro release and stagger only visible cards", async ({
  page,
}) => {
  await page.goto("/");
  const cards = page.locator(".category-circle-card");
  await expect(cards.first()).toHaveAttribute("data-reveal-pending", "");
  await scrub(page, 0.94);
  await settled(page, 0.94);
  await expect(page.locator(".category-circle-card.is-visible")).toHaveCount(0);
  await page.evaluate(() => {
    const events: { index: number; time: number }[] = [];
    Object.assign(window, { categoryReveals: events });
    document
      .querySelectorAll(".category-circle-card")
      .forEach((card, index) => {
        new MutationObserver(() => {
          if (
            card.classList.contains("is-visible") &&
            !events.some((event) => event.index === index)
          )
            events.push({ index, time: performance.now() });
        }).observe(card, { attributes: true, attributeFilter: ["class"] });
      });
  });
  await scrub(page, 1);
  await expect(cards.first()).toHaveClass(/is-visible/);
  await expect(cards.nth(1)).toHaveClass(/is-visible/);
  const events = await page.evaluate(
    () =>
      (
        window as unknown as {
          categoryReveals: { index: number; time: number }[];
        }
      ).categoryReveals,
  );
  expect(events[1].time - events[0].time).toBeGreaterThan(120);
  await cards.last().scrollIntoViewIfNeeded();
  await expect(cards.last()).toHaveClass(/is-visible/);
  await expect(cards.last()).toHaveCSS("opacity", "1");
  await expect(cards.last()).toHaveCSS("transform", "none");
  await cards.first().scrollIntoViewIfNeeded();
  await expect(cards.first()).toHaveCSS("opacity", "1");
  await expect(cards.first()).toHaveAttribute("href", /\/category\//);
});

test("skip lands at the first collection and reduced motion reveals cards without animation", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Skip animation" }).click();
  await expect(page.locator(".intro-scroll")).toHaveAttribute(
    "data-active",
    "false",
  );
  await expect(page.locator(".categories-section h1")).toBeInViewport();
  await expect(page.locator(".category-circle-card").first()).toBeInViewport();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(
    page.locator(".category-circle-card[data-reveal-pending]"),
  ).toHaveCount(0);
  await expect(page.locator(".category-circle-card").last()).toHaveCSS(
    "opacity",
    "1",
  );
  await page.reload();
  await expect(page.locator(".intro-scroll")).toHaveAttribute(
    "data-frame",
    String(metadata.frameCount - 1),
  );
  await expect(
    page.locator(".category-circle-card[data-reveal-pending]"),
  ).toHaveCount(0);
});

test("reloading with the opening frame still in flight recovers without locking the store", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  let release!: () => void;
  let requested!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  const pending = new Promise<void>((resolve) => {
    requested = resolve;
  });
  await page.route("**/intro/**/frame-0001.webp*", async (route) => {
    requested();
    await held;
    // The original navigation's image request is intentionally cancelled.
    await route.continue().catch(() => {});
  });
  try {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await pending;
    await expect(page.locator(".intro-scroll")).not.toHaveAttribute(
      "data-ready",
      "true",
    );
    await page.reload({ waitUntil: "domcontentloaded" });
  } finally {
    release();
  }
  await expect(page.locator(".intro-scroll")).toHaveAttribute(
    "data-ready",
    "true",
  );
  await expect(page.locator(".intro-scroll")).toHaveAttribute(
    "data-frame",
    "0",
  );
  await page.getByRole("button", { name: "Skip animation" }).click();
  await expect(page.locator(".intro-scroll")).toHaveAttribute(
    "data-active",
    "false",
  );
  await expect(page.locator(".categories-section h1")).toBeInViewport();
  expect(errors).toEqual([]);
});
