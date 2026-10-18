import { test, expect as baseExpect, type Page } from "@playwright/test";
import metadata from "../../public/intro/frames.json";

const expect = baseExpect.configure({ timeout: 20000 });
test.setTimeout(60000);

async function observeReveals(page: Page) {
  await page.evaluate(() => {
    const events: { index: number; time: number }[] = [];
    Object.assign(window, { handoffReveals: events });
    document
      .querySelectorAll(".category-circle-card")
      .forEach((card, index) => {
        new MutationObserver(() => {
          if (
            card.classList.contains("is-visible") &&
            !events.some((event) => event.index === index)
          ) {
            events.push({ index, time: performance.now() });
          }
        }).observe(card, { attributes: true, attributeFilter: ["class"] });
      });
  });
}

async function expectStagger(page: Page) {
  const cards = page.locator(".category-circle-card");
  await expect(cards.nth(1)).toHaveClass(/is-visible/);
  const events = await page.evaluate(
    () =>
      (
        window as unknown as {
          handoffReveals: { index: number; time: number }[];
        }
      ).handoffReveals,
  );
  expect(events[1].time - events[0].time).toBeGreaterThan(120);
  await expect(cards.first()).toHaveCSS("opacity", "1");
  await expect(cards.first()).toHaveCSS("transform", "none");
}

test("mobile keeps the video and waits to reveal categories until its exit", async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, "Mobile video flow");
  const errors: string[] = [];
  const frameRequests: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => {
    if (/\/intro\/(desktop|mobile)\//.test(request.url()))
      frameRequests.push(request.url());
  });
  await page.goto("/");
  const intro = page.locator(".mobile-intro-container");
  await expect(intro).toBeVisible();
  await expect(intro.locator("video")).toHaveAttribute(
    "src",
    "/videos/achu_mobile.mp4",
  );
  await expect(intro.locator("video")).toHaveAttribute("autoplay", "");
  await expect(intro.locator("video")).toHaveJSProperty("muted", true);
  await expect(page.locator(".intro-scroll")).toHaveCount(0);
  await expect(page.locator(".category-circle-card").first()).toHaveAttribute(
    "data-reveal-pending",
    "",
  );
  await page.waitForTimeout(250);
  await expect(page.locator(".category-circle-card.is-visible")).toHaveCount(0);
  await observeReveals(page);
  await page
    .getByRole("button", { name: "Skip intro and enter boutique" })
    .click();
  await expect(intro).toHaveCount(0);
  await expectStagger(page);
  await expect(page.locator(".categories-section h1")).toBeInViewport();
  await expect(page.locator("html")).not.toHaveAttribute(
    "data-mobile-intro",
    "active",
  );
  expect(await page.evaluate(() => document.body.style.overflow)).not.toBe(
    "hidden",
  );
  expect(frameRequests).toEqual([]);
  expect(errors).toEqual([]);
});

test("desktop categories wait for the canvas mounted after hydration", async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, "Desktop canvas flow");
  await page.goto("/");
  const intro = page.locator(".intro-scroll");
  await expect(intro).toHaveAttribute("data-ready", "true");
  await expect(page.locator(".mobile-intro-container")).toHaveCount(0);
  await page.evaluate(() => {
    const intro = document.querySelector<HTMLElement>(".intro-scroll")!;
    const front =
      intro.querySelector<HTMLElement>(".intro-front-range")!.clientHeight;
    const distance =
      intro.querySelector<HTMLElement>(".intro-video-range")!.clientHeight;
    scrollTo(0, front + distance * 0.94);
  });
  await expect(intro).toHaveAttribute(
    "data-frame",
    String(metadata.frameCount - 1),
  );
  await expect(page.locator(".category-circle-card.is-visible")).toHaveCount(0);
  await observeReveals(page);
  await page.evaluate(() => {
    scrollTo(
      0,
      Math.ceil(
        document.getElementById("boutique")!.getBoundingClientRect().top +
          scrollY,
      ),
    );
  });
  await expect(intro).toHaveAttribute("data-active", "false");
  await expectStagger(page);
});

test("mobile reduced motion retains the video artwork and immediate category visibility", async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, "Mobile reduced-motion flow");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.locator(".mobile-intro-container")).toHaveAttribute(
    "data-status",
    "ended",
  );
  await expect(
    page.locator(".category-circle-card[data-reveal-pending]"),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Skip intro and enter boutique" })
    .click();
  await expect(page.locator(".mobile-intro-container")).toHaveCount(0);
  await expect(page.locator(".category-circle-card").first()).toHaveCSS(
    "opacity",
    "1",
  );
});
