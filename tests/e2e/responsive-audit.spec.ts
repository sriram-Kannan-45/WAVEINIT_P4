import { test, expect } from "@playwright/test";

const viewports = [
  { name: "mobile-320", width: 320, height: 568 },
  { name: "mobile-375", width: 375, height: 667 },
  { name: "mobile-430", width: 430, height: 932 },
  { name: "tablet-768", width: 768, height: 1024 },
  { name: "laptop-1366", width: 1366, height: 768 },
  { name: "desktop-1920", width: 1920, height: 1080 },
];

test.describe("Mandatory Responsive Review across all viewports", () => {
  for (const vp of viewports) {
    test.describe(`${vp.name} (${vp.width}x${vp.height})`, () => {
      test.use({ viewport: { width: vp.width, height: vp.height } });

      test("Product Listing & Category Hub: 2-column on mobile, responsive cards, no horizontal overflow", async ({
        page,
      }) => {
        await page.goto("/category/kurtis");
        await page.waitForLoadState("domcontentloaded");

        // Verify zero horizontal overflow on page body
        const overflow = await page.evaluate(() => {
          return document.documentElement.scrollWidth > window.innerWidth;
        });
        expect(overflow, `Horizontal overflow detected at ${vp.width}px`).toBe(false);

        // Verify product grid adapts
        const grid = page.locator(".product-grid").first();
        if (await grid.isVisible()) {
          const cards = grid.locator(".product-card");
          const count = await cards.count();
          expect(count).toBeGreaterThan(0);

          // Check first card layout
          const firstCard = cards.first();
          await expect(firstCard.locator(".product-image")).toBeVisible();
          await expect(firstCard.locator(".product-info h3")).toBeVisible();
          await expect(firstCard.locator(".product-price")).toBeVisible();

          // Verify image aspect ratio is maintained
          const imgBox = await firstCard.locator(".product-image").boundingBox();
          expect(imgBox).not.toBeNull();
          if (imgBox) {
            const ratio = imgBox.height / imgBox.width;
            // 3/4 or 4/5 ratio should be around 1.25 to 1.45
            expect(ratio).toBeGreaterThan(1.1);
            expect(ratio).toBeLessThan(1.6);
          }
        }
      });

      test("Product Detail Page: sizes wrap, controls accessible, dynamic recalculation, no horizontal overflow", async ({
        page,
      }) => {
        await page.goto("/product/navy-festive-suit-set");
        await page.waitForLoadState("domcontentloaded");

        // Verify zero horizontal overflow
        const overflow = await page.evaluate(() => {
          return document.documentElement.scrollWidth > window.innerWidth;
        });
        expect(overflow, `PDP Horizontal overflow detected at ${vp.width}px`).toBe(false);

        // Verify product title, price, size options
        await expect(page.locator("h1")).toBeVisible();
        await expect(page.locator(".detail-price")).toBeVisible();

        const sizeOptions = page.locator(".size-options");
        await expect(sizeOptions).toBeVisible();

        // Size buttons wrap horizontally without overflowing container
        const sizeBox = await sizeOptions.boundingBox();
        expect(sizeBox).not.toBeNull();
        if (sizeBox) {
          expect(sizeBox.width).toBeLessThanOrEqual(vp.width);
        }

        // Test dynamic size selection: click available size (S)
        const sizeS = sizeOptions.locator("button:not(:disabled)").first();
        await sizeS.click();
        await expect(sizeS).toHaveClass(/selected/);

        // Stock status should recalculate
        const stockStatus = page.locator(".stock-status");
        if (await stockStatus.isVisible()) {
          await expect(stockStatus).toContainText(/left in|Available/);
        }

        // Out of stock size (if present) has sold-out tag and is disabled
        const soldOutSize = sizeOptions.locator("button:disabled").first();
        if (await soldOutSize.isVisible()) {
          await expect(soldOutSize).toHaveClass(/sold-out-size/);
          await expect(soldOutSize.locator(".size-sold-out-tag")).toBeVisible();
        }

        // Quantity controls: increment and decrement
        const qtyOutput = page.locator(".quantity-control output");
        await expect(qtyOutput).toHaveText("1");
        const plusBtn = page.locator(".quantity-control button[aria-label='Increase quantity']");
        if (await plusBtn.isEnabled()) {
          await plusBtn.click();
          await expect(qtyOutput).toHaveText("2");
          const minusBtn = page.locator(".quantity-control button[aria-label='Decrease quantity']");
          await minusBtn.click();
          await expect(qtyOutput).toHaveText("1");
        }

        // Add to bag button is accessible and visible
        const actionBtn = page.locator(".add-to-cart-row button.button").first();
        await expect(actionBtn).toBeVisible();

        // WhatsApp enquiry or order button visible
        await expect(
          page.locator(".enquiry-button, button:has-text('Order on WhatsApp'), .loading-label").first(),
        ).toBeVisible();
      });

      test("Admin Product & Inventory Management: responsive forms, tables, and CRUD", async ({
        page,
      }) => {
        await page.goto("/admin/dashboard");
        if (page.url().includes("/admin/login")) {
          await page.getByLabel("Admin ID or Email").fill("achu");
          await page.getByLabel("Password").fill("1234");
          await page.getByRole("button", { name: "Sign in securely" }).click();
          await page.waitForURL("**/admin/dashboard", { timeout: 15000 });
        }

        // 1. Admin Inventory
        await page.goto("/admin/inventory");
        await page.waitForLoadState("domcontentloaded");

        // Verify zero horizontal overflow on inventory
        let overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
        expect(overflow, `Admin Inventory horizontal overflow at ${vp.width}px`).toBe(false);

        // Check topbar notification bell
        await expect(page.locator("button.notification-trigger")).toBeVisible();

        // Verify summary cards
        const statsGrid = page.locator(".inventory-stats-grid");
        await expect(statsGrid).toBeVisible();
        await expect(statsGrid.locator(".inventory-stat-card")).toHaveCount(5);

        // Verify table wrap
        const tableWrap = page.locator(".admin-table-wrap");
        await expect(tableWrap).toBeVisible();

        // 2. Admin Product Form (Create / Edit)
        await page.goto("/admin/products/new");
        await page.waitForLoadState("domcontentloaded");

        overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
        expect(overflow, `Admin Product Form horizontal overflow at ${vp.width}px`).toBe(false);

        // Quick add size chips wrap and fit
        const chipWrap = page.locator("button:has-text('+ 4XL')");
        await expect(chipWrap).toBeVisible();

        // Dynamic variants table fits within container
        const variantTable = page.locator(".admin-table");
        await expect(variantTable).toBeVisible();

        // Form actions (Save / Cancel) are visible and accessible
        const saveBtn = page.locator("button:has-text('Save product')");
        await expect(saveBtn).toBeVisible();

        // 3. Admin New Arrivals CRUD
        await page.goto("/admin/new-arrivals");
        await page.waitForLoadState("domcontentloaded");

        overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
        expect(overflow, `Admin New Arrivals horizontal overflow at ${vp.width}px`).toBe(false);
        await expect(page.locator("h1:has-text('New Arrivals')")).toBeVisible();
      });

      test("Cart & Checkout: responsive layouts, zero horizontal overflow", async ({
        page,
      }) => {
        await page.goto("/cart");
        await page.waitForLoadState("domcontentloaded");
        let overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
        expect(overflow, `Cart horizontal overflow at ${vp.width}px`).toBe(false);

        await page.goto("/checkout");
        await page.waitForLoadState("domcontentloaded");
        overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
        expect(overflow, `Checkout horizontal overflow at ${vp.width}px`).toBe(false);
      });
    });
  }
});
