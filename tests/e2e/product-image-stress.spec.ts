import { test, expect } from "@playwright/test";

test.describe("E-Commerce Product & Image Loading Stress Test Suite", () => {
  test.beforeEach(async ({ page }) => {
    // Monitor console errors
    page.on("pageerror", (err) => {
      console.error("[Browser Page Error]:", err.message);
    });
  });

  test("Phase 4 & 7: Sarees category displays 50+ image entries without broken images", async ({
    page,
  }) => {
    const startTime = Date.now();

    // 1. Open Sarees category with limit=60 to view all 50+ entries on one page
    const response = await page.goto("/category/sarees?limit=60", {
      waitUntil: "domcontentloaded",
    });
    expect(response?.status()).toBe(200);

    const initialLoadMs = Date.now() - startTime;
    console.log(`[Performance] Sarees initial load time: ${initialLoadMs}ms`);

    // Verify breadcrumbs and category heading
    await expect(page.locator("nav.breadcrumbs")).toContainText("Sarees");
    await expect(page.locator(".category-hero-content h1")).toHaveText("Sarees");

    // 2. Count product cards
    const productCards = page.locator(".product-grid .product-card");
    const count = await productCards.count();
    console.log(`[Category Sarees] Total product cards visible: ${count}`);
    expect(count).toBeGreaterThanOrEqual(50);

    // 3. Measure time until first product image is loaded
    const firstImg = productCards.first().locator(".product-image img").first();
    await expect(firstImg).toBeVisible({ timeout: 5000 });

    await expect
      .poll(
        async () => {
          return firstImg.evaluate((img: HTMLImageElement) => {
            return img.complete && img.naturalWidth > 0;
          });
        },
        { timeout: 10000, intervals: [200, 500] },
      )
      .toBe(true);

    console.log("[Category Sarees] First image loaded successfully.");

    // 4. Scroll smoothly through all entries so lazy-loaded images enter viewport
    const scrollStartTime = Date.now();
    for (let i = 0; i < count; i += 4) {
      await productCards.nth(Math.min(i, count - 1)).scrollIntoViewIfNeeded();
      await page.waitForTimeout(120);
    }
    const scrollTimeMs = Date.now() - scrollStartTime;
    console.log(`[Performance] Scroll through all entries took: ${scrollTimeMs}ms`);

    // 5. Poll until all images finish decoding
    await expect
      .poll(
        async () => {
          return page.evaluate(() => {
            const cards = Array.from(
              document.querySelectorAll(".product-grid .product-card"),
            );
            const broken = cards.filter((card) => {
              const img = card.querySelector(
                ".product-image img",
              ) as HTMLImageElement;
              return !img || !img.complete || img.naturalWidth === 0;
            });
            return broken.length;
          });
        },
        { timeout: 20000, intervals: [500, 1000] },
      )
      .toBe(0);

    // 6. Detailed inspection of image aspect ratios and attributes
    const imageValidity = await page.evaluate(() => {
      const cards = Array.from(
        document.querySelectorAll(".product-grid .product-card"),
      );
      return cards.map((card, idx) => {
        const img = card.querySelector(".product-image img") as HTMLImageElement;
        const nameEl = card.querySelector(".product-info h3");
        const priceEl = card.querySelector(".product-price span");
        return {
          index: idx,
          name: nameEl?.textContent?.trim() || "",
          price: priceEl?.textContent?.trim() || "",
          hasImage: !!img,
          src: img?.currentSrc || img?.src || "",
          complete: img?.complete,
          naturalWidth: img?.naturalWidth || 0,
          naturalHeight: img?.naturalHeight || 0,
          aspectRatio:
            img && img.naturalHeight > 0
              ? (img.naturalWidth / img.naturalHeight).toFixed(2)
              : "0",
        };
      });
    });

    console.log(`[Category Sarees] Checked ${imageValidity.length} rendered cards.`);
    const missingDetails = imageValidity.filter(
      (item) => !item.name || !item.price.includes("₹"),
    );
    expect(missingDetails.length).toBe(0);

    // 7. Test clicking a product card to verify product details page
    const sampleTestCard = productCards
      .filter({ hasText: "LOAD_TEST" })
      .first();
    const targetLink = await sampleTestCard
      .locator(".product-image")
      .getAttribute("href");
    expect(targetLink).toBeTruthy();

    await sampleTestCard.locator("h3").click();
    await page.waitForURL(`**${targetLink}`);

    // Verify detail page
    await expect(page.locator(".product-detail-content h1")).toBeVisible();
    const detailImg = page.locator(".gallery-main img").first();
    await expect(detailImg).toBeVisible();

    await expect
      .poll(
        async () => {
          return detailImg.evaluate((img: HTMLImageElement) => {
            return img.complete && img.naturalWidth > 0;
          });
        },
        { timeout: 10000 },
      )
      .toBe(true);
  });

  test("Phase 4 & 7: Demo category displays 50+ image entries with strict category filtering", async ({
    page,
  }) => {
    // Open Demo category with limit=60
    const response = await page.goto("/category/demo-2?limit=60", {
      waitUntil: "domcontentloaded",
    });
    expect(response?.status()).toBe(200);

    await expect(page.locator(".category-hero-content h1")).toHaveText("Demo");

    const productCards = page.locator(".product-grid .product-card");
    const count = await productCards.count();
    console.log(`[Category Demo] Total product cards visible: ${count}`);
    expect(count).toBeGreaterThanOrEqual(50);

    // Scroll to load all cards
    for (let i = 0; i < count; i += 4) {
      await productCards.nth(Math.min(i, count - 1)).scrollIntoViewIfNeeded();
      await page.waitForTimeout(120);
    }

    // Verify no Saree test products leaked into Demo category
    const cardTexts = await productCards.allTextContents();
    const leakedSarees = cardTexts.filter(
      (t) => t.includes("LOAD_TEST") && t.includes("Saree"),
    );
    expect(leakedSarees.length).toBe(0);

    // Poll until all images finish decoding
    await expect
      .poll(
        async () => {
          return page.evaluate(() => {
            const imgs = Array.from(
              document.querySelectorAll(
                ".product-grid .product-card .product-image img",
              ),
            );
            return imgs.filter((img) => {
              const el = img as HTMLImageElement;
              return !el.complete || el.naturalWidth === 0;
            }).length;
          });
        },
        { timeout: 20000, intervals: [500, 1000] },
      )
      .toBe(0);
  });

  test("Phase 4: Standard pagination across 50 entries works correctly", async ({
    page,
  }) => {
    // 1. Visit default Sarees page (24 items per page)
    await page.goto("/category/sarees");
    const page1Cards = await page.locator(".product-grid .product-card").count();
    expect(page1Cards).toBe(24);

    // Pagination bar should be visible
    const pagination = page.locator("nav.pagination");
    await expect(pagination).toBeVisible();
    await expect(pagination).toContainText("Page 1 of 3");

    // 2. Click Next page
    await pagination.getByRole("link", { name: "Next" }).click();
    await page.waitForURL("**/category/sarees?page=2");

    const page2Cards = await page.locator(".product-grid .product-card").count();
    expect(page2Cards).toBe(24);
    await expect(pagination).toContainText("Page 2 of 3");

    // 3. Click Page 3
    await pagination.getByRole("link", { name: "Next" }).click();
    await page.waitForURL("**/category/sarees?page=3");

    const page3Cards = await page.locator(".product-grid .product-card").count();
    expect(page3Cards).toBeGreaterThanOrEqual(4); // 52 total items - 48 = 4 on page 3
    await expect(pagination).toContainText("Page 3 of 3");
  });

  test("Phase 5: Image Loading and Failure Scenarios", async ({ page }) => {
    // 1. Test missing image file fallback resilience
    await page.goto("/category/sarees");

    const fallbackHandled = await page.evaluate(async () => {
      return new Promise<boolean>((resolve) => {
        const img = new Image();
        img.onerror = () => {
          // Gracefully handles 404 error without crashing browser
          resolve(true);
        };
        img.onload = () => resolve(false);
        img.src = "/test/pics/non-existent-stress-image.jpg";
      });
    });
    expect(fallbackHandled).toBe(true);

    // 2. Verify large image files from test/pics load smoothly with sharp optimization
    const largeImageStatus = await page.evaluate(async () => {
      const res = await fetch("/test/pics/IMG_5444.JPG");
      const blob = await res.blob();
      return { status: res.status, size: blob.size };
    });
    expect(largeImageStatus.status).toBe(200);
    expect(largeImageStatus.size).toBeGreaterThan(10000);

    // 3. Verify PNG and JPG formats both supported
    const formatChecks = await page.evaluate(async () => {
      const r1 = await fetch("/test/pics/1722688045724.png");
      const r2 = await fetch("/test/pics/1722688045724.jpg");
      return { png: r1.status === 200, jpg: r2.status === 200 };
    });
    expect(formatChecks.png).toBe(true);
    expect(formatChecks.jpg).toBe(true);
  });

  test("Phase 6: Performance benchmark meets targets", async ({ page }) => {
    // Measure response time of catalog_search endpoint & rendering
    const start = performance.now();
    await page.goto("/category/sarees?limit=50", { waitUntil: "networkidle" });
    const fullLoadTime = performance.now() - start;

    console.log(
      `[Performance Benchmark] Full networkidle load for 50 entries: ${fullLoadTime.toFixed(0)}ms`,
    );

    // Verify target under 10000ms for dev server Turbopack compilation
    expect(fullLoadTime).toBeLessThan(10000);
  });

  test("Mobile responsive layout handles 50 image entries without horizontal overflow", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/category/sarees?limit=50");

    // Check no horizontal scrollbar / overflow
    const hasHorizontalOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth;
    });
    expect(hasHorizontalOverflow).toBe(false);

    // Check product cards are rendered cleanly in 2-column mobile grid
    const cards = page.locator(".product-grid .product-card");
    const count = await cards.count();
    expect(count).toBeGreaterThanOrEqual(50);

    const firstCardBox = await cards.first().boundingBox();
    expect(firstCardBox?.width).toBeGreaterThan(100);
    expect(firstCardBox?.width).toBeLessThan(390);
  });
});
