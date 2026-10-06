import { test, expect } from "@playwright/test";

test("cinematic scroll dynamics: master video timeline, campaign outfit progression, reverse scrolling", async ({
  page,
}) => {
  test.setTimeout(60000);

  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);

  // Scroll past peacock intro
  await page.evaluate(() => {
    const intro = document.querySelector(".intro-scroll");
    if (intro) {
      const top = intro.getBoundingClientRect().top + window.scrollY;
      window.scrollTo({ top: top + intro.clientHeight + 100, behavior: "instant" });
    }
  });
  await page.waitForTimeout(400);

  const cinematicSection = page.locator(".cinematic-scroll-section");
  await expect(cinematicSection).toBeAttached();

  const box = await cinematicSection.boundingBox();
  expect(box).not.toBeNull();
  const startY = box!.y + (await page.evaluate(() => window.scrollY));
  const viewportH = page.viewportSize()?.height || 800;
  const totalH = box!.height;
  const maxScroll = totalH - viewportH;

  // Verify continuous video element is attached
  const videoLocator = page.locator(".luxury-hero-video-element");
  await expect(videoLocator).toBeAttached();

  // Helper to get active outfit index
  const getActiveOutfit = async () => {
    return await page.evaluate(() => {
      const el = document.querySelector(".cinematic-scroll-section");
      return el ? el.getAttribute("data-active-outfit") : null;
    });
  };

  // Helper to get video currentTime
  const getVideoTime = async () => {
    return await page.evaluate(() => {
      const v = document.querySelector(".luxury-hero-video-element") as HTMLVideoElement | null;
      return v ? v.currentTime : 0;
    });
  };

  // 1. Initial position (p = 0.05) -> Outfit 0 (Sarees)
  await page.evaluate((y) => window.scrollTo(0, y), startY + 0.05 * maxScroll);
  await page.waitForTimeout(400);
  expect(await getActiveOutfit()).toBe("0");

  // 2. Phase 2 (p = 0.28) -> Outfit 1 (Kurtis)
  const p2ScrollY = startY + 0.28 * maxScroll;
  await page.evaluate((y) => window.scrollTo({ top: y, behavior: "instant" }), p2ScrollY);
  await page.waitForTimeout(400);
  expect(await getActiveOutfit()).toBe("1");
  const timeP2 = await getVideoTime();
  expect(timeP2).toBeGreaterThanOrEqual(1.5);

  // 3. Phase 3 (p = 0.48) -> Outfit 2 (Tops)
  const p3ScrollY = startY + 0.48 * maxScroll;
  await page.evaluate((y) => window.scrollTo({ top: y, behavior: "instant" }), p3ScrollY);
  await page.waitForTimeout(400);
  expect(await getActiveOutfit()).toBe("2");
  const timeP3 = await getVideoTime();
  expect(timeP3).toBeGreaterThan(timeP2);

  // 4. Phase 4 (p = 0.68) -> Outfit 3 (Leggings)
  const p4ScrollY = startY + 0.68 * maxScroll;
  await page.evaluate((y) => window.scrollTo({ top: y, behavior: "instant" }), p4ScrollY);
  await page.waitForTimeout(400);
  expect(await getActiveOutfit()).toBe("3");
  const timeP4 = await getVideoTime();
  expect(timeP4).toBeGreaterThan(timeP3);

  // 5. Phase 5 (p = 0.88) -> Outfit 4 (Ethnic Wear)
  const p5ScrollY = startY + 0.88 * maxScroll;
  await page.evaluate((y) => window.scrollTo({ top: y, behavior: "instant" }), p5ScrollY);
  await page.waitForTimeout(400);
  expect(await getActiveOutfit()).toBe("4");
  const timeP5 = await getVideoTime();
  expect(timeP5).toBeGreaterThan(timeP4);

  // 6. Symmetrical reverse scroll back to Outfit 1 (Kurtis)
  await page.evaluate((y) => window.scrollTo({ top: y, behavior: "instant" }), p2ScrollY);
  await page.waitForTimeout(400);
  expect(await getActiveOutfit()).toBe("1");
  const revTime = await getVideoTime();
  expect(revTime).toBeLessThan(timeP5);

  // 7. Verify Campaign elements
  const activeCutout = page.locator(".hero-model-cutout-layer.active");
  await expect(activeCutout).toHaveCount(1);

  const headline = page.locator(".hero-campaign-headline");
  await expect(headline).toBeVisible();

  // 8. Verify Arrivals Section
  const arrivals = page.locator(".arrivals-section");
  await expect(arrivals).toBeAttached();
});
