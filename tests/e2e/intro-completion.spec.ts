import { test, expect as baseExpect, type Page } from "@playwright/test";
import metadata from "../../public/intro/frames.json";

const expect = baseExpect.configure({ timeout: 20000 });
test.setTimeout(60000);

async function boundary(page: Page) {
  return page.evaluate(() => {
    const intro = document.querySelector<HTMLElement>(".intro-scroll")!;
    return Math.ceil(
      intro.getBoundingClientRect().top +
        scrollY +
        intro.querySelector<HTMLElement>(".intro-front-range")!.clientHeight +
        intro.querySelector<HTMLElement>(".intro-video-range")!.clientHeight,
    );
  });
}

test("fast wheel and keyboard input wait for every frame before releasing at the boutique top", async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, "Desktop scroll intro");
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  let resume!: () => void;
  const delivery = new Promise<void>((resolve) => (resume = resolve));
  await page.route("**/intro/desktop/frame-0002.webp*", async (route) => {
    await delivery;
    await route.continue();
  });
  try {
    await page.goto("/");
    const intro = page.locator(".intro-scroll");
    await expect(intro).toHaveAttribute("data-frame", "0");
    const end = await boundary(page);
    await page.mouse.wheel(0, 12000);
    await expect(intro).toHaveAttribute("data-active", "true");
    await expect.poll(() => page.evaluate(() => scrollY)).toBe(end);
    await expect(page.locator(".intro-sticky")).toHaveCSS("position", "fixed");
    const stage = await page.locator(".intro-sticky").evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return { top: rect.top, bottom: rect.bottom, height: innerHeight };
    });
    expect(stage.top).toBe(0);
    expect(stage.bottom).toBe(stage.height);
    await expect(page.locator("#boutique")).toHaveJSProperty("inert", true);
    await expect(page.locator(".category-circle-card.is-visible")).toHaveCount(
      0,
    );

    // More input and lifecycle notifications cannot bypass an undecoded frame.
    await page.keyboard.press("End");
    for (let index = 0; index < 12; index++)
      await page.keyboard.down("ArrowDown");
    await page.keyboard.up("ArrowDown");
    await page.evaluate(() => {
      dispatchEvent(new PageTransitionEvent("pageshow"));
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await expect.poll(() => page.evaluate(() => scrollY)).toBe(end);
    await expect(intro).toHaveAttribute("data-frame", "0");
    await expect(intro).toHaveAttribute("data-active", "true");

    // Upward input remains available while completion is held.
    await page.mouse.wheel(0, -12000);
    await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
    await expect(intro).toHaveAttribute("data-phase", "welcome");
    resume();
    await page.evaluate(() => {
      const values: { frame: number; active: string | undefined }[] = [];
      Object.assign(window, { completionFrames: values });
      const intro = document.querySelector<HTMLElement>(".intro-scroll")!;
      const record = () => {
        values.push({
          frame: Number(intro.dataset.frame),
          active: intro.dataset.active,
        });
        if (intro.dataset.active !== "false") requestAnimationFrame(record);
      };
      requestAnimationFrame(record);
    });
    await page.mouse.wheel(0, 12000);
    await expect(intro).toHaveAttribute(
      "data-frame",
      String(metadata.frameCount - 1),
    );
    await page.screenshot({ path: "output/intro-release/final-logo.png" });
    await expect(intro).toHaveAttribute("data-active", "false");
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            (
              window as unknown as {
                completionFrames: { active: string | undefined }[];
              }
            ).completionFrames.at(-1)?.active,
        ),
      )
      .toBe("false");
    await expect(intro).toHaveAttribute(
      "data-frame",
      String(metadata.frameCount - 1),
    );
    const samples = await page.evaluate(
      () =>
        (
          window as unknown as {
            completionFrames: { frame: number; active: string | undefined }[];
          }
        ).completionFrames,
    );
    for (let index = 1; index < samples.length; index++) {
      expect(
        samples[index].frame - samples[index - 1].frame,
      ).toBeGreaterThanOrEqual(0);
      expect(
        samples[index].frame - samples[index - 1].frame,
      ).toBeLessThanOrEqual(1);
    }
    expect(
      samples
        .filter((sample) => sample.active === "false")
        .every((sample) => sample.frame === metadata.frameCount - 1),
    ).toBe(true);
    await expect.poll(() => page.evaluate(() => scrollY)).toBe(end);
    await expect(page.locator(".categories-section h1")).toBeInViewport();
    await expect(page.locator(".site-header")).toBeInViewport();
    await expect(page.locator("#boutique")).toHaveJSProperty("inert", false);
    await page.screenshot({ path: "output/intro-release/boutique-top.png" });
    await page.mouse.wheel(0, 800);
    await expect
      .poll(() => page.evaluate(() => scrollY))
      .toBeGreaterThan(end + 400);
    await page.evaluate(
      (top) => scrollTo({ top, behavior: "instant" }),
      end * 0.5,
    );
    await expect(intro).toHaveAttribute("data-active", "true");
    await expect
      .poll(async () => Number(await intro.getAttribute("data-frame")))
      .toBeLessThan(metadata.frameCount - 5);
    await expect(page.locator("#boutique")).toHaveJSProperty("inert", true);
    expect(errors).toEqual([]);
  } finally {
    resume();
    await page.unrouteAll({ behavior: "wait" });
  }
});

test("Skip still releases an incomplete desktop intro immediately", async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, "Desktop scroll intro");
  await page.goto("/");
  const intro = page.locator(".intro-scroll");
  await expect(intro).toHaveAttribute("data-frame", "0");
  await page.mouse.wheel(0, 12000);
  await expect(intro).toHaveAttribute("data-active", "true");
  await page
    .getByRole("button", { name: "Skip animation — enter the boutique" })
    .click();
  await expect(intro).toHaveAttribute("data-active", "false");
  await expect(page.locator(".categories-section h1")).toBeInViewport();
  await expect(page.locator("#boutique")).toHaveJSProperty("inert", false);
});

test("desktop reduced motion keeps ordinary document scrolling", async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, "Desktop static intro");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const intro = page.locator(".intro-scroll");
  await expect(intro).toHaveAttribute(
    "data-frame",
    String(metadata.frameCount - 1),
  );
  await expect(page.locator(".intro-sticky")).toHaveCSS("position", "relative");
  await page.mouse.wheel(0, 12000);
  await expect(intro).toHaveAttribute("data-active", "false");
  await expect(page.locator("#boutique")).toHaveJSProperty("inert", false);
  expect(await page.evaluate(() => scrollY)).toBeGreaterThan(2 * 720);
});

test("reloading beyond the completed intro keeps the store accessible without replay", async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, "Desktop scroll restoration");
  await page.goto("/");
  await expect(page.locator(".intro-scroll")).toHaveAttribute(
    "data-ready",
    "true",
  );
  await page
    .getByRole("button", { name: "Skip animation — enter the boutique" })
    .click();
  await expect(page.locator(".intro-scroll")).toHaveAttribute(
    "data-active",
    "false",
  );
  await expect(page.locator("html")).toHaveAttribute(
    "data-store-animate",
    "done",
  );
  const before = (await boundary(page)) + 1000;
  await page.evaluate((top) => scrollTo({ top, behavior: "instant" }), before);
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(before);
  await page.reload();
  await expect(page.locator(".intro-scroll")).toHaveAttribute(
    "data-active",
    "false",
  );
  // Native restoration can stop earlier while server-streamed content is
  // shorter. It must remain beyond the intro and permit further store scroll.
  await expect
    .poll(() => page.evaluate(() => scrollY))
    .toBeGreaterThan(await boundary(page));
  await page.evaluate((top) => scrollTo({ top, behavior: "instant" }), before);
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(before);
});

test("rounded viewport boundary releases categories and allows opening a product", async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, "Desktop viewport rounding");
  await page.setViewportSize({ width: 1532, height: 699 });
  await page.goto("/");
  const intro = page.locator(".intro-scroll");
  await expect(intro).toHaveAttribute("data-ready", "true");
  // Browser zoom/viewport rounding can leave the measured stage a pixel
  // shorter than the native scrollport. Exercise that physical mismatch.
  await page.addStyleTag({
    content: `
      .intro-sticky,.intro-video-stage{height:calc(100dvh - 1.25px)}
      .home-experience:has(.intro-scroll[data-hold="true"]){
        max-height:calc(var(--intro-page-height) - .75px)
      }
    `,
  });
  await expect
    .poll(() =>
      page
        .locator(".intro-video-stage")
        .evaluate((element) => element.clientHeight),
    )
    .toBe(698);
  await page.mouse.wheel(0, 12000);
  await expect(intro).toHaveAttribute(
    "data-frame",
    String(metadata.frameCount - 1),
  );
  await expect(intro).toHaveAttribute("data-active", "false", {
    timeout: 3000,
  });
  await expect(intro).toHaveAttribute("data-hold", "false");
  await expect(page.locator("#boutique")).toHaveJSProperty("inert", false);
  const category = page.locator(".category-circle-card").first();
  await expect(category).toHaveClass(/is-visible/);
  await expect(category).toHaveCSS("opacity", "1");
  const product = page.locator(".arrivals-section .product-card").first();
  await product.scrollIntoViewIfNeeded();
  await expect(product).toBeInViewport();
  await expect
    .poll(() =>
      product
        .locator("img")
        .first()
        .evaluate(
          (image: HTMLImageElement) => image.complete && image.naturalWidth > 0,
        ),
    )
    .toBe(true);
  const link = product.locator(".product-image");
  const href = await link.getAttribute("href");
  await link.click();
  await expect(page).toHaveURL(new RegExp(`${href}$`));
  await expect(page.locator("h1")).toBeVisible();
});
