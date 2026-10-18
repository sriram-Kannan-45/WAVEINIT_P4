import { test, expect } from "@playwright/test";
import path from "node:path";

const TEST_PNG_PATH = path.resolve(__dirname, "../fix/Elegant Emerald Green Saree Portrait.png");
const TEST_WEBP_PATH = path.resolve(__dirname, "../fix/Elegant Emerald Green Saree Portrait.webp");

test.describe("Full Admin Action Verification", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/admin/login");
    await page.getByLabel("Admin ID or Email").fill("achu");
    await page.getByLabel("Password").fill("1234");
    await page.getByRole("button", { name: "Sign in securely" }).click();
    await page.waitForURL("**/admin/dashboard", { timeout: 15000 });
  });

  test("Action A: Add Category, cropper controls, and persistence", async ({ page }) => {
    await page.goto("/admin/categories");
    await page.waitForLoadState("domcontentloaded");

    const uniqueSlug = `audit-cat-${Date.now()}`;
    const catName = `Audit Category ${Date.now()}`;

    // Open Add Category modal
    await page.getByRole("button", { name: "Add Category" }).click();
    const modal = page.locator(".admin-modal-content");
    await expect(modal).toBeVisible();

    // Fill name & slug
    await modal.locator("input[placeholder*='Sarees']").fill(catName);
    const slugInput = modal.locator("input[placeholder='e.g. sarees']");
    await slugInput.click();
    await slugInput.fill(uniqueSlug);

    // Upload image
    await modal.locator("input[type='file']").first().setInputFiles(TEST_PNG_PATH);

    // Verify cropper opens
    const cropper = page.locator(".cropper-backdrop");
    await expect(cropper).toBeVisible({ timeout: 10000 });

    // Test Zoom
    const zoomVal = cropper.locator(".cropper-zoom-val");
    const zoomIn = cropper.locator("button[aria-label='Zoom in']");
    await zoomIn.click();
    await expect(zoomVal).toHaveText("110%");

    // Test Reset
    const resetBtn = cropper.locator("button[aria-label='Reset crop']");
    await resetBtn.click();
    await expect(zoomVal).toHaveText("100%");

    // Confirm crop
    await cropper.locator("button.cropper-confirm-btn").click();
    await expect(cropper).not.toBeVisible({ timeout: 15000 });

    // Submit Category
    await modal.locator("button[type='submit']").click();
    await expect(modal).not.toBeVisible({ timeout: 15000 });

    // Verify category row exists in table
    const table = page.locator(".admin-table");
    await expect(table).toContainText(catName);

    // Clean up test category
    const row = table.locator(`tr:has-text('${catName}')`);
    await row.locator("button[aria-label*='Delete']").click();
    // Confirm delete dialog
    const confirmBtn = page.locator(".dialog-content button.danger");
    await confirmBtn.click();
    await expect(table).not.toContainText(catName, { timeout: 10000 });
  });

  test("Action B: Add Subcategory, select parent category, image cropper, and persistence", async ({ page }) => {
    await page.goto("/admin/subcategories");
    await page.waitForLoadState("domcontentloaded");

    const uniqueSlug = `audit-sub-${Date.now()}`;
    const subName = `Audit Subcategory ${Date.now()}`;

    // Open Add Subcategory modal
    await page.getByRole("button", { name: "Add Subcategory" }).click();
    const modal = page.locator(".admin-modal-content");
    await expect(modal).toBeVisible();

    // Select parent category (first option after placeholder)
    const select = modal.locator("select");
    const options = await select.locator("option").all();
    expect(options.length).toBeGreaterThan(1);
    await select.selectOption({ index: 1 });

    // Fill name and slug
    await modal.locator("input[placeholder*='Stone work']").fill(subName);
    const slugInput = modal.locator("input[placeholder='e.g. stone-work']");
    await slugInput.click();
    await slugInput.fill(uniqueSlug);

    // Upload image
    await modal.locator("input[type='file']").first().setInputFiles(TEST_PNG_PATH);

    // Cropper opens
    const cropper = page.locator(".cropper-backdrop");
    await expect(cropper).toBeVisible({ timeout: 10000 });

    // Test "Use original uncropped" button
    const skipBtn = cropper.locator("button.cropper-skip-btn");
    await expect(skipBtn).toBeVisible();
    await skipBtn.click();
    await expect(cropper).not.toBeVisible({ timeout: 15000 });

    // Submit subcategory
    await modal.locator("button[type='submit']").click();
    await expect(modal).not.toBeVisible({ timeout: 15000 });

    // Verify subcategory row exists
    const table = page.locator(".admin-table");
    await expect(table).toContainText(subName);

    // Clean up test subcategory
    const row = table.locator(`tr:has-text('${subName}')`);
    await row.locator("button[aria-label*='Delete']").click();
    const confirmBtn = page.locator(".dialog-content button.danger");
    await confirmBtn.click();
    await expect(table).not.toContainText(subName);
  });

  test("Action C: Add Product workflow with variants, image crop, and persistence", async ({ page }) => {
    await page.goto("/admin/products/new");
    await page.waitForLoadState("domcontentloaded");

    const uniqueSlug = `audit-prod-${Date.now()}`;
    const prodName = `Audit Product ${Date.now()}`;

    // Fill product info
    await page.getByLabel("Product name *").fill(prodName);
    const slugInput = page.getByLabel("Slug *");
    await slugInput.fill(uniqueSlug);

    // Select category
    const catSelect = page.locator("select").first();
    await catSelect.selectOption({ index: 1 });

    // Fill prices
    await page.getByLabel("Selling price (₹) *").fill("4999");
    await page.getByLabel("Original price (₹, optional)").fill("6999");

    // Upload image
    const fileChooserPromise = page.waitForEvent("filechooser");
    await page.locator(".uploader input[type='file']").first().click({ force: true });
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(TEST_PNG_PATH);

    // Cropper opens
    const cropper = page.locator(".cropper-backdrop");
    await expect(cropper).toBeVisible({ timeout: 10000 });

    // Confirm crop
    await cropper.locator("button.cropper-confirm-btn").click();
    await expect(cropper).not.toBeVisible({ timeout: 15000 });

    // Verify thumbnail appears with PRIMARY cover tag
    const thumb = page.locator(".upload-thumb-card");
    await expect(thumb).toBeVisible();
    await expect(thumb).toContainText("PRIMARY");

    // Save product
    await page.locator("button[type='submit']:has-text('Save product')").click();
    await page.waitForURL("**/admin/products", { timeout: 15000 });

    // Verify product exists in list
    const productList = page.locator(".admin-table");
    await expect(productList).toContainText(prodName);

    // Clean up test product
    const row = productList.locator(`tr:has-text('${prodName}')`);
    await row.locator("button[aria-label*='Delete']").click();
    const confirmBtn = page.locator(".dialog-content button.danger");
    await confirmBtn.click();
    await expect(productList).not.toContainText(prodName);
  });
});
