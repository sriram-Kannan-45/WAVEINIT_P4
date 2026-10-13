import { test, expect } from "@playwright/test";

test.describe("Mobile-Only Intro Replacement Architecture", () => {
  test("Desktop maintains existing Peacock 3D intro without mobile intro video", async ({
    page,
  }) => {
    // Only run on desktop project
    if (page.viewportSize()!.width < 768) return;

    let requestedMobileVideo = false;
    page.on("request", (req) => {
      if (req.url().includes("achu_mobile.mp4")) {
        requestedMobileVideo = true;
      }
    });

    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1000);

    // Desktop intro component is present
    const desktopIntro = page.locator(".intro-scroll");
    await expect(desktopIntro).toBeVisible();

    // Canvas is present inside desktop intro
    const canvas = desktopIntro.locator("canvas");
    await expect(canvas).toBeAttached();

    // Mobile intro video component is NOT mounted
    const mobileIntro = page.locator(".mobile-intro-container");
    await expect(mobileIntro).toHaveCount(0);

    // No network request for mobile video
    expect(requestedMobileVideo).toBe(false);
  });

  test("Mobile replaces Peacock intro with Achu_mobile video and transitions cleanly into Hero", async ({
    page,
  }) => {
    // Only run on mobile project
    if (page.viewportSize()!.width >= 768) return;

    let requestedFrameWebp = false;
    page.on("request", (req) => {
      if (req.url().includes("/intro/mobile/") || req.url().includes("/intro/desktop/")) {
        requestedFrameWebp = true;
      }
    });

    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(600);

    // Desktop intro component is NOT mounted on mobile
    const desktopIntro = page.locator(".intro-scroll");
    await expect(desktopIntro).toHaveCount(0);

    // Mobile intro video container is mounted and active
    const mobileIntro = page.locator(".mobile-intro-container");
    await expect(mobileIntro).toBeVisible();

    // Achu_mobile video element is rendered with correct attributes
    const video = mobileIntro.locator("video.mobile-intro-video");
    await expect(video).toBeAttached();
    await expect(video).toHaveAttribute("src", "/videos/achu_mobile.mp4");
    await expect(video).toHaveAttribute("playsinline", "");

    // Verify 0 WebP frames were fetched on mobile
    expect(requestedFrameWebp).toBe(false);

    // Controls: sound button and skip button exist
    const soundBtn = page.locator(".mobile-intro-sound-btn");
    await expect(soundBtn).toBeVisible();

    const skipBtn = page.locator(".mobile-intro-skip-btn");
    await expect(skipBtn).toBeVisible();

    // Click skip to test completion & smooth transition into Hero
    await skipBtn.click();
    await page.waitForTimeout(800);

    // Mobile intro is dismissed
    await expect(mobileIntro).toHaveCount(0);

    // Storefront and Hero become visible
    const storefront = page.locator("#boutique");
    await expect(storefront).toBeVisible();

    const heroHeadline = page.locator(".hero-campaign-headline");
    await expect(heroHeadline).toBeVisible();

    // Verify user can scroll through the Hero smoothly
    const cinematicSection = page.locator(".cinematic-scroll-section");
    await expect(cinematicSection).toBeVisible();
  });
});
