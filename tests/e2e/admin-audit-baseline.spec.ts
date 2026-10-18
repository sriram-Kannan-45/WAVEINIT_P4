import { test, expect } from "@playwright/test";
import path from "node:path";

const TEST_IMAGE_PATH = path.resolve(__dirname, "../fix/Elegant Emerald Green Saree Portrait.png");
const TEST_WEBP_PATH = path.resolve(__dirname, "../fix/Elegant Emerald Green Saree Portrait.webp");

test.describe("Admin Audit Baseline & Diagnostic", () => {
  test("audit three-dot menu, dashboard loading, and image cropper actions", async ({ page }) => {
    const consoleErrors: string[] = [];
    const failedRequests: string[] = [];

    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });

    page.on("requestfailed", (req) => {
      failedRequests.push(`${req.method()} ${req.url()} - ${req.failure()?.errorText}`);
    });

    // 1. Measure login and initial dashboard load time
    const loginStart = Date.now();
    await page.goto("/admin/login");
    await page.getByLabel("Admin ID or Email").fill("achu");
    await page.getByLabel("Password").fill("1234");
    await page.getByRole("button", { name: "Sign in securely" }).click();

    await page.waitForURL("**/admin/dashboard", { timeout: 15000 });
    const dashboardReached = Date.now();
    console.log(`[Baseline] Login to dashboard redirect: ${dashboardReached - loginStart}ms`);

    // Measure time until skeleton is replaced by actual dashboard content
    const heading = page.getByRole("heading", { name: "Welcome to your collection." });
    await expect(heading).toBeVisible({ timeout: 15000 });
    const dashboardLoaded = Date.now();
    console.log(`[Baseline] Time until dashboard content visible: ${dashboardLoaded - dashboardReached}ms`);

    // Check if skeletons are still visible
    const remainingSkeletons = await page.locator(".skeleton").count();
    console.log(`[Baseline] Remaining skeleton count: ${remainingSkeletons}`);

    // 2. Test Mobile Viewport Three-dot menu responsiveness
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(300);

    const threeDotTrigger = page.locator("button.admin-menu-trigger");
    await expect(threeDotTrigger).toBeVisible();

    const menuOpenStart = Date.now();
    await threeDotTrigger.click();
    const drawerContent = page.locator(".dialog-content.drawer");
    await expect(drawerContent).toBeVisible({ timeout: 5000 });
    const menuOpenEnd = Date.now();
    console.log(`[Baseline] Three-dot menu open duration: ${menuOpenEnd - menuOpenStart}ms`);

    // Verify all menu items in drawer
    const menuLinks = drawerContent.locator("nav a");
    const linkCount = await menuLinks.count();
    console.log(`[Baseline] Menu items count in drawer: ${linkCount}`);
    expect(linkCount).toBe(12);

    // Test closing drawer via close button or escape
    const closeBtn = drawerContent.locator(".dialog-close");
    await closeBtn.click();
    await expect(drawerContent).not.toBeVisible();
    console.log(`[Baseline] Three-dot menu closed successfully.`);

    // 3. Test Add Category & Cropper Actions
    await page.goto("/admin/categories");
    await page.waitForLoadState("domcontentloaded");
    await page.setViewportSize({ width: 1366, height: 768 });

    const addCatBtn = page.getByRole("button", { name: "Add Category" });
    await expect(addCatBtn).toBeVisible();

    const modalOpenStart = Date.now();
    await addCatBtn.click();
    const catModal = page.locator(".admin-modal-content");
    await expect(catModal).toBeVisible();
    console.log(`[Baseline] Add Category modal open duration: ${Date.now() - modalOpenStart}ms`);

    // Upload image into cropper
    const fileChooserPromise = page.waitForEvent("filechooser");
    await catModal.locator("input[type='file']").first().click({ force: true });
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(TEST_IMAGE_PATH);

    // Verify cropper opens
    const cropperModal = page.locator(".cropper-backdrop");
    await expect(cropperModal).toBeVisible({ timeout: 10000 });
    console.log("[Baseline] Image cropper opened successfully.");

    // Test Zoom controls
    const zoomInBtn = cropperModal.locator("button[aria-label='Zoom in']");
    const zoomOutBtn = cropperModal.locator("button[aria-label='Zoom out']");
    const zoomVal = cropperModal.locator(".cropper-zoom-val");

    const initialZoomText = await zoomVal.innerText();
    console.log(`[Baseline] Initial zoom: ${initialZoomText}`);

    await zoomInBtn.click();
    const zoomedInText = await zoomVal.innerText();
    console.log(`[Baseline] After zoom in: ${zoomedInText}`);

    await zoomOutBtn.click();
    const zoomedOutText = await zoomVal.innerText();
    console.log(`[Baseline] After zoom out: ${zoomedOutText}`);

    // Test Reset
    const resetBtn = cropperModal.locator("button[aria-label='Reset crop']");
    await resetBtn.click();
    const resetZoomText = await zoomVal.innerText();
    console.log(`[Baseline] After reset: ${resetZoomText}`);

    // Test Overlay Guide toggle
    const rectGuideBtn = cropperModal.locator("button:has-text('Rectangular Guide')");
    if (await rectGuideBtn.isVisible()) {
      await rectGuideBtn.click();
      console.log("[Baseline] Clicked Rectangular Guide.");
    }
    const circleGuideBtn = cropperModal.locator("button:has-text('Circular Guide')");
    if (await circleGuideBtn.isVisible()) {
      await circleGuideBtn.click();
      console.log("[Baseline] Clicked Circular Guide.");
    }

    // Test Confirm & Save Crop
    const confirmCropBtn = cropperModal.locator("button.cropper-confirm-btn");
    const uploadStart = Date.now();
    await confirmCropBtn.click();
    await expect(cropperModal).not.toBeVisible({ timeout: 15000 });
    console.log(`[Baseline] Confirm & crop upload completed in: ${Date.now() - uploadStart}ms`);

    // Close Category Modal without saving to avoid cluttering DB
    const cancelCatBtn = catModal.locator("button.admin-modal-close");
    await cancelCatBtn.click();
    await expect(catModal).not.toBeVisible();

    console.log("[Baseline] Console errors:", consoleErrors);
    console.log("[Baseline] Failed requests:", failedRequests);
  });
});
