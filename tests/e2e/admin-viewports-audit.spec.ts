import { test, expect } from "@playwright/test";
import path from "node:path";

const TEST_PNG_PATH = path.resolve(__dirname, "../fix/Elegant Emerald Green Saree Portrait.png");

const viewports = [
  { name: "Small mobile", width: 320, height: 700 },
  { name: "Standard mobile", width: 390, height: 844 },
  { name: "Large mobile", width: 430, height: 932 },
  { name: "Tablet", width: 768, height: 1024 },
  { name: "Laptop", width: 1366, height: 768 },
  { name: "Desktop", width: 1440, height: 900 },
];

test.describe("Admin Responsive Viewport & Cropper Interaction Audit", () => {
  for (const vp of viewports) {
    test(`Viewport ${vp.name} (${vp.width}x${vp.height}): Admin Menu, Dashboard, Cropper UI`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });

      const consoleErrors: string[] = [];
      page.on("console", (msg) => {
        if (msg.type() === "error") {
          consoleErrors.push(msg.text());
        }
      });

      // 1. Admin login & session check
      await page.goto("/admin/dashboard");
      if (page.url().includes("/admin/login")) {
        await page.getByLabel("Admin ID or Email").fill("achu");
        await page.getByLabel("Password").fill("1234");
        await page.getByRole("button", { name: "Sign in securely" }).click();
        await page.waitForURL("**/admin/dashboard", { timeout: 15000 });
      }

      // Verify zero horizontal overflow on admin dashboard
      const dashboardOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      );
      expect(
        dashboardOverflow,
        `Admin dashboard horizontal overflow at ${vp.width}px`,
      ).toBe(false);

      // 2. Test Three-Dot Menu (mobile & tablet) vs persistent sidebar (laptop & desktop)
      if (vp.width <= 850) {
        const menuTrigger = page.locator(".admin-menu-trigger");
        await expect(menuTrigger).toBeVisible();
        const t0 = Date.now();
        await menuTrigger.click();
        const drawerSidebar = page.locator(".admin-sidebar.in-drawer");
        await expect(drawerSidebar.first()).toBeVisible({ timeout: 3000 });
        const menuLatency = Date.now() - t0;
        console.log(`[${vp.name}] Three-dot menu open latency: ${menuLatency}ms`);
        expect(menuLatency).toBeLessThan(500);

        // Verify navigation links are visible inside the open drawer
        await expect(
          page.locator(".admin-sidebar.in-drawer a[href='/admin/products']"),
        ).toBeVisible();

        // Close drawer
        const closeBtn = page.locator(".dialog-content.drawer .dialog-close");
        if (await closeBtn.isVisible()) {
          await closeBtn.click();
        } else {
          await page.keyboard.press("Escape");
        }
        await expect(drawerSidebar).not.toBeVisible({ timeout: 3000 });
      } else {
        const sidebar = page.locator(".admin-sidebar");
        await expect(sidebar.first()).toBeVisible();
        await expect(
          page.locator("a[href='/admin/products']").first(),
        ).toBeVisible();
      }

      // 3. Navigate to Category Management
      await page.goto("/admin/categories");
      await page.waitForLoadState("domcontentloaded");

      const categoryOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      );
      expect(
        categoryOverflow,
        `Category page horizontal overflow at ${vp.width}px`,
      ).toBe(false);

      // Open Add Category Modal
      const addCategoryBtn = page.getByRole("button", { name: "Add Category" });
      await expect(addCategoryBtn).toBeVisible();
      const modalT0 = Date.now();
      await addCategoryBtn.click();
      const modal = page.locator(".admin-modal-content");
      await expect(modal).toBeVisible({ timeout: 3000 });
      const modalLatency = Date.now() - modalT0;
      console.log(`[${vp.name}] Add Category modal open latency: ${modalLatency}ms`);
      expect(modalLatency).toBeLessThan(500);

      // 4. Test Cropper Modal via direct file input
      await modal
        .locator("input[type='file']")
        .first()
        .setInputFiles(TEST_PNG_PATH);

      // Cropper modal opens
      const cropperBackdrop = page.locator(".cropper-backdrop");
      await expect(cropperBackdrop).toBeVisible({ timeout: 8000 });

      const cropperModal = page.locator(".cropper-modal-container");
      await expect(cropperModal).toBeVisible();

      // Check cropper fits within viewport without horizontal overflow
      const cropperBox = await cropperModal.boundingBox();
      expect(cropperBox).not.toBeNull();
      if (cropperBox) {
        expect(cropperBox.width).toBeLessThanOrEqual(vp.width);
        expect(cropperBox.height).toBeLessThanOrEqual(vp.height);
      }

      // Test preset button interaction
      const presetButtons = page.locator(".cropper-preset-btn");
      const presetCount = await presetButtons.count();
      expect(presetCount).toBeGreaterThanOrEqual(2);
      await presetButtons.nth(1).click();
      await expect(presetButtons.nth(1)).toHaveClass(/active/);

      // Test zoom controls
      const zoomValue = page.locator(".cropper-zoom-val");
      const initialZoom = await zoomValue.textContent();

      const zoomInBtn = page.locator("button[aria-label='Zoom in']");
      await zoomInBtn.click();
      await page.waitForTimeout(100);

      const zoomedInValue = await zoomValue.textContent();
      expect(zoomedInValue).not.toEqual(initialZoom);

      // Test Reset button
      const resetBtn = page.locator(".cropper-reset-btn");
      await resetBtn.click();
      await page.waitForTimeout(100);
      const resetZoomValue = await zoomValue.textContent();
      expect(resetZoomValue).toEqual("100%");

      // Test Skip / Use Original button (does not abort form)
      const skipBtn = page.locator(".cropper-skip-btn");
      await expect(skipBtn).toBeVisible();
      await skipBtn.click();

      // Cropper modal closes cleanly
      await expect(cropperBackdrop).not.toBeVisible({ timeout: 8000 });
      await expect(modal).toBeVisible();

      // Cancel the category creation modal
      const cancelModalBtn = modal.getByRole("button", {
        name: "Cancel",
      });
      await cancelModalBtn.click();
      await expect(modal).not.toBeVisible({ timeout: 3000 });

      // Check zero critical console errors
      const criticalErrors = consoleErrors.filter(
        (err) =>
          !err.includes("favicon") &&
          !err.includes("Download the React DevTools") &&
          !err.includes("Third-party cookie"),
      );
      expect(criticalErrors).toHaveLength(0);
    });
  }
});
