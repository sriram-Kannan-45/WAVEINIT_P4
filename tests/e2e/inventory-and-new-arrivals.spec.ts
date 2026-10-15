import { test, expect } from "@playwright/test";

test.describe("Dynamic Inventory, Product Management & New Arrivals E2E", () => {
  test.beforeEach(async ({ page }) => {
    // Sign in to owner space
    await page.goto("/admin/login");
    await page.getByLabel("Admin ID or Email").fill("achu");
    await page.getByLabel("Password").fill("1234");
    await page.getByRole("button", { name: "Sign in securely" }).click();
    await page.waitForURL("**/admin/dashboard", { timeout: 15000 });
  });

  test("Phase 2: Product editor provides dynamic size chips, custom sizes, and variant pricing", async ({
    page,
  }) => {
    await page.goto("/admin/products/new");
    await page.waitForLoadState("domcontentloaded");

    // Verify dynamic sizes section exists
    await expect(page.locator("h3:has-text('Sizes & stock management')")).toBeVisible();

    // Verify quick-add chips like + 4XL are present
    const chip4XL = page.locator("button:has-text('+ 4XL')");
    await expect(chip4XL).toBeVisible();

    // Click + 4XL chip and verify a new row for 4XL is added to the variant table
    await chip4XL.click();
    const row4XL = page.locator("tr:has(input[value='4XL'])");
    await expect(row4XL).toBeVisible();

    // Verify fields in the row: Size, Stock, Price (₹), SKU
    await expect(row4XL.locator("input[placeholder='Base price']")).toBeVisible();
    await expect(row4XL.locator("input[placeholder='0']")).toBeVisible();

    // Test Add size button for custom sizes
    const addSizeBtn = page.locator("button:has-text('Add size')");
    await addSizeBtn.click();
    const customRow = page.locator("tr:has(input[placeholder='e.g. M, 4XL'])").last();
    await expect(customRow).toBeVisible();
    await customRow.locator("input[placeholder='e.g. M, 4XL']").fill("CUSTOM-FIT");
    await expect(page.locator("input[value='CUSTOM-FIT']")).toBeVisible();

    // Total stock counter should be visible
    await expect(page.locator("text=Total stock:")).toBeVisible();
  });

  test("Phase 4: Storefront PDP displays size-specific stock availability and disables Add to Bag on out-of-stock sizes", async ({
    page,
  }) => {
    // Go to product page with mixed stock (product Deno has 3XL with 0 stock)
    await page.goto("/product/deno");
    await page.waitForLoadState("domcontentloaded");

    await expect(page.locator("h1")).toContainText(/Deno/i);

    // Verify size buttons container is visible
    const sizeOptions = page.locator(".size-options");
    await expect(sizeOptions).toBeVisible();

    // Check sold out size button (3XL has 0 stock)
    const soldOutBtn = sizeOptions.locator("button.sold-out-size").first();
    await expect(soldOutBtn).toBeVisible();
    await expect(soldOutBtn).toBeDisabled();
    await expect(soldOutBtn.locator(".size-sold-out-tag")).toHaveText("Sold out");

    // Check size S button (in stock)
    const sizeSBtn = sizeOptions.getByRole("button", { name: "S", exact: true });
    await expect(sizeSBtn).toBeVisible();
    await expect(sizeSBtn).not.toBeDisabled();

    // Click size S button and verify Add to Bag button is functional for available size
    await sizeSBtn.click();
    const actionBtn = page.locator(".add-to-cart-row button.button:has-text('Add to bag')");
    await expect(actionBtn).toBeVisible();
    await expect(actionBtn).not.toBeDisabled();
  });

  test("Phase 5: Admin topbar features notifications bell, unread badge, and alert panel", async ({
    page,
  }) => {
    await page.goto("/admin/dashboard");
    await page.waitForLoadState("domcontentloaded");

    // Check notification trigger bell button in topbar
    const bellBtn = page.locator("button.notification-trigger");
    await expect(bellBtn).toBeVisible();

    // Open notifications popover
    await bellBtn.click();

    const popover = page.locator(".notifications-popover");
    await expect(popover).toBeVisible();
    await expect(popover.locator(".notifications-title")).toHaveText("Inventory alerts");

    // Verify alert items with product name, size, and stock status tag
    const alertItems = popover.locator(".notification-item");
    const count = await alertItems.count();
    expect(count).toBeGreaterThan(0);

    const firstItem = alertItems.first();
    await expect(firstItem.locator(".notification-product-name")).toBeVisible();
    await expect(firstItem.locator(".notif-tag.size-tag")).toBeVisible();

    // Mark all as read button
    const markAllBtn = popover.locator("button.mark-all-read-btn");
    if (await markAllBtn.isVisible()) {
      await markAllBtn.click();
      await page.waitForTimeout(300);
    }
  });

  test("Phase 6: Admin inventory dashboard renders summary metrics, category/size filters, and stock controls", async ({
    page,
  }) => {
    await page.goto("/admin/inventory");
    await page.waitForLoadState("domcontentloaded");

    await expect(page.locator("h1")).toHaveText("Inventory & Stock Control");

    // Verify 5 inventory summary metric cards
    const statsGrid = page.locator(".inventory-stats-grid");
    await expect(statsGrid).toBeVisible();
    await expect(statsGrid.locator(".inventory-stat-card")).toHaveCount(5);

    await expect(statsGrid).toContainText("Active Products");
    await expect(statsGrid).toContainText("In Stock");
    await expect(statsGrid).toContainText("Out of Stock");
    await expect(statsGrid).toContainText("Low Stock Variants");
    await expect(statsGrid).toContainText("Total Units");

    // Verify Filter controls
    const filterForm = page.locator("form.admin-filters");
    await expect(filterForm.locator("input[name='q']")).toBeVisible();
    await expect(filterForm.locator("select[name='category']")).toBeVisible();
    await expect(filterForm.locator("select[name='subcategory']")).toBeVisible();
    await expect(filterForm.locator("input[name='size']")).toBeVisible();
    await expect(filterForm.locator("select[name='stock']")).toBeVisible();

    // Verify inventory table with sizes, prices, and stepper inputs
    const inventoryTable = page.locator("table.inventory-admin-table");
    await expect(inventoryTable).toBeVisible();

    const firstRow = inventoryTable.locator("tr.inventory-row").first();
    await expect(firstRow).toBeVisible();
    await expect(firstRow.locator(".size-badge-pill")).toBeVisible();
    await expect(firstRow.locator(".stock-inline-input")).toBeVisible();
    await expect(firstRow.locator(".stock-stepper-btn")).toHaveCount(2);

    // Test filtering by Out of Stock status via stat card click
    const outOfStockCard = page.locator(".inventory-stat-card.alert-card");
    await outOfStockCard.click();
    await page.waitForURL("**/admin/inventory?stock=out");

    const statusSelect = page.locator("select[name='stock']");
    await expect(statusSelect).toHaveValue("out");
  });

  test("Phase 7: New Arrivals admin CRUD features product selection, custom badges, live preview, and modal management", async ({
    page,
  }) => {
    // Navigate to New arrivals
    await page.goto("/admin/new-arrivals");
    await page.waitForLoadState("domcontentloaded");

    await expect(page.locator("h1")).toHaveText("New Arrivals & Spotlights");

    // Verify New Arrivals table
    const table = page.locator("table.admin-table");
    await expect(table).toBeVisible();
    await expect(table).toContainText("Badge");
    await expect(table).toContainText("Display order");

    // Open Add to New Arrivals modal
    const addBtn = page.getByRole("button", { name: "Add to New Arrivals" });
    await expect(addBtn).toBeVisible();
    await addBtn.click();

    const modal = page.locator(".admin-modal-content");
    await expect(modal).toBeVisible();
    await expect(modal.locator(".admin-modal-title")).toHaveText("Feature in New Arrivals");

    // Check product selector and badge presets
    await expect(modal.locator("#na-product-select")).toBeVisible();
    await expect(modal.locator("#na-badge")).toBeVisible();
    await expect(modal.locator("button.notif-tag:has-text('FESTIVE EDIT')")).toBeVisible();

    // Click preset
    await modal.locator("button.notif-tag:has-text('FESTIVE EDIT')").click();
    await expect(modal.locator("#na-badge")).toHaveValue("FESTIVE EDIT");

    // Cancel modal
    await modal.getByRole("button", { name: "Cancel" }).click();
    await expect(modal).not.toBeVisible();

    // Open Live Storefront Preview
    const previewBtn = table.locator("button[title='Preview customer card']").first();
    await previewBtn.click();

    const previewModal = page.locator(".admin-modal-content");
    await expect(previewModal).toBeVisible();
    await expect(previewModal.locator(".admin-modal-title")).toHaveText("Storefront Live Preview");
    await expect(previewModal.locator(".product-card")).toBeVisible();

    await previewModal.getByRole("button", { name: "Done" }).click();
    await expect(previewModal).not.toBeVisible();
  });
});
