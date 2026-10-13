import { test, expect } from "@playwright/test";

test("homepage section order and continuous automatic video showcase playback", async ({
  page,
}) => {
  test.setTimeout(60000);

  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1200);

  // Skip intro if present
  const skipBtn = page.locator(".mobile-intro-skip-btn");
  if (await skipBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
    await skipBtn.click();
    await page.waitForTimeout(700);
  } else {
    await page.evaluate(() => {
      const intro = document.querySelector(".intro-scroll");
      if (intro) {
        const top = intro.getBoundingClientRect().top + window.scrollY;
        window.scrollTo({ top: top + intro.clientHeight + 100, behavior: "instant" });
      }
    });
    await page.waitForTimeout(400);
  }

  // 1. Verify exact homepage section order:
  // 1. Intro -> 2. Collections -> 3. Newly Arrived -> 4. Video Animation Section
  const sectionOrder = await page.evaluate(() => {
    const categories = document.querySelector(".categories-section");
    const arrivals = document.querySelector(".arrivals-section");
    const videoSection = document.querySelector(".cinematic-scroll-section");
    if (!categories || !arrivals || !videoSection) return null;

    const catTop = categories.getBoundingClientRect().top + window.scrollY;
    const arrTop = arrivals.getBoundingClientRect().top + window.scrollY;
    const vidTop = videoSection.getBoundingClientRect().top + window.scrollY;

    return {
      catTop,
      arrTop,
      vidTop,
      isCorrectOrder: catTop < arrTop && arrTop < vidTop,
    };
  });

  expect(sectionOrder).not.toBeNull();
  expect(sectionOrder!.isCorrectOrder).toBe(true);

  // 2. Verify Video Section is present with standard responsive height (no 550vh/650vh spacer)
  const videoSection = page.locator(".cinematic-scroll-section");
  await expect(videoSection).toBeAttached();

  const sectionBox = await videoSection.boundingBox();
  expect(sectionBox).not.toBeNull();
  // Height must be standard viewport/section height, not 550vh
  expect(sectionBox!.height).toBeLessThan(1500);

  // 3. Scroll to video section so it is in view
  await videoSection.scrollIntoViewIfNeeded();
  await page.waitForTimeout(600);

  // 4. Verify continuous HTML5 video element is attached with correct native attributes
  const video = page.locator(".luxury-hero-video-element");
  await expect(video).toBeAttached();
  await expect(video).toHaveAttribute("autoplay", "");
  await expect(video).toHaveAttribute("loop", "");
  await expect(video).toHaveAttribute("playsinline", "");

  // 5. Verify correct video source for viewport
  const isMobile = (page.viewportSize()?.width || 1200) < 768;
  const expectedSrc = isMobile ? "Mobile.mp4" : "laptop-resolution.mp4";
  const videoSrc = await page.evaluate(() => {
    const v = document.querySelector(".luxury-hero-video-element") as HTMLVideoElement | null;
    return v ? (v.currentSrc || v.src || v.getAttribute("data-src") || "") : "";
  });
  expect(videoSrc).toContain(expectedSrc);

  // 6. Verify automatic video playback without scrolling
  const initialTime = await page.evaluate(() => {
    const v = document.querySelector(".luxury-hero-video-element") as HTMLVideoElement | null;
    return v ? v.currentTime : 0;
  });

  // Wait 1.5 seconds for video to naturally advance on its own
  await page.waitForTimeout(1500);

  const laterTime = await page.evaluate(() => {
    const v = document.querySelector(".luxury-hero-video-element") as HTMLVideoElement | null;
    return v ? v.currentTime : 0;
  });

  // Video must advance naturally according to its timeline
  expect(laterTime).toBeGreaterThan(initialTime);

  // 7. Verify scrolling page does NOT scrub or hijack video currentTime
  const beforeScrollTime = await page.evaluate(() => {
    const v = document.querySelector(".luxury-hero-video-element") as HTMLVideoElement | null;
    return v ? v.currentTime : 0;
  });

  // Perform normal page scroll down and up
  await page.evaluate(() => window.scrollBy({ top: 150, behavior: "instant" }));
  await page.waitForTimeout(300);
  await page.evaluate(() => window.scrollBy({ top: -150, behavior: "instant" }));
  await page.waitForTimeout(300);

  const afterScrollTime = await page.evaluate(() => {
    const v = document.querySelector(".luxury-hero-video-element") as HTMLVideoElement | null;
    return v ? v.currentTime : 0;
  });

  // Video continued to play forward smoothly regardless of page scrolling
  expect(afterScrollTime).toBeGreaterThanOrEqual(beforeScrollTime);

  // 8. Verify the showcase of 5 pictures from the pic folder above the video
  const cutouts = page.locator(".hero-model-cutout-layer");
  await expect(cutouts).toHaveCount(5);
  const activeCutouts = page.locator(".hero-model-cutout-layer.active");
  await expect(activeCutouts).toHaveCount(1);

  // 9. Verify luxury branding headline, dots, and CTA exist
  const headline = page.locator(".hero-campaign-headline");
  await headline.scrollIntoViewIfNeeded();
  await expect(headline).toBeVisible();

  const dots = page.locator(".pagination-dot");
  await expect(dots).toHaveCount(5);

  const ctaBtn = page.locator(".hero-cta-button");
  await expect(ctaBtn).toBeVisible();

  // 10. Verify right-side message panel with synchronized dress quotes
  const messagePanel = page.locator(".hero-campaign-message-panel");
  await expect(messagePanel).toBeVisible();

  const messageCards = page.locator(".hero-dress-message-card");
  await expect(messageCards).toHaveCount(5);

  const activeMessageCard = page.locator(".hero-dress-message-card.active");
  await expect(activeMessageCard).toHaveCount(1);

  // Active message must have a quote tagline
  const quote = activeMessageCard.locator(".dress-tagline-quote");
  await expect(quote).toBeVisible();
  const quoteText = await quote.textContent();
  expect(quoteText).toBeTruthy();

  // On desktop viewports, verify that the message panel is positioned on the right side
  if (!isMobile) {
    const stageBox = await page.locator(".cinematic-sticky-stage").boundingBox();
    const panelBox = await messagePanel.boundingBox();
    expect(stageBox).not.toBeNull();
    expect(panelBox).not.toBeNull();
    // Panel must be on the right half of the stage
    expect(panelBox!.x + panelBox!.width / 2).toBeGreaterThan(stageBox!.x + stageBox!.width / 2);
  }
});

