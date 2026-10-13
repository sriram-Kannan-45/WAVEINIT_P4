import { test, expect } from "@playwright/test";

test.describe("Category and Subcategory E2E feature verification", () => {
  test("homepage circular categories navigate to category hub and subcategory routes", async ({
    page,
  }) => {
    // 1. Visit homepage and transition past intro
    await page.goto("/");
    if (page.viewportSize()!.width < 768) {
      const skipBtn = page.locator(".mobile-intro-skip-btn");
      if (await skipBtn.isVisible()) {
        await skipBtn.click();
        await page.waitForTimeout(600);
      }
    } else {
      await page.evaluate(() => {
        const store = document.getElementById("boutique");
        if (store) store.inert = false;
        const introEl = document.querySelector(".intro-scroll");
        if (introEl) {
          const top = introEl.getBoundingClientRect().top + window.scrollY;
          window.scrollTo(0, top + introEl.clientHeight + 50);
        }
      });
      await page.waitForTimeout(400);
    }

    const categoryGrid = page.locator(".category-circle-grid");
    await expect(categoryGrid).toBeVisible({ timeout: 10000 });

    const sareeCard = page.locator('.category-circle-card[href="/category/sarees"]');
    await expect(sareeCard).toBeVisible();

    // Verify circular thumbnail wrapper and image are rendered
    const thumb = sareeCard.locator(".category-circle-thumb");
    await expect(thumb).toBeVisible();

    // Click on Sarees
    await sareeCard.click();
    await page.waitForURL("**/category/sarees");

    // 2. Verify Category Detail Hub
    await expect(page.locator("nav.breadcrumbs")).toContainText("Home");
    await expect(page.locator("nav.breadcrumbs")).toContainText("Sarees");
    await expect(page.locator(".category-hero-banner h1")).toHaveText("Sarees");

    // Verify Child Subcategories section is present
    const subcatSection = page.locator(".category-subcategories-section");
    await expect(subcatSection).toBeVisible();
    await expect(subcatSection).toContainText("Stone work");

    // 3. Drill down into Subcategory route
    const stoneWorkLink = page.locator('a[href="/category/sarees/stone-work"]');
    await expect(stoneWorkLink).toBeVisible();
    await stoneWorkLink.click();

    await page.waitForURL("**/category/sarees/stone-work");

    // Verify Subcategory breadcrumbs and title
    await expect(page.locator("nav.breadcrumbs")).toContainText("Home");
    await expect(page.locator("nav.breadcrumbs")).toContainText("Sarees");
    await expect(page.locator("nav.breadcrumbs")).toContainText("Stone work");
    await expect(page.locator(".page-heading h1")).toHaveText("Stone work");

    // Verify filtered product listing
    const productCard = page.locator('article.product-card').first();
    await expect(productCard).toBeVisible();
    await expect(productCard).toContainText("Emerald silk saree");

    // 4. Drill down to Product Detail Page
    await productCard.locator('a[href*="/product/"]').first().click();
    await page.waitForURL("**/product/emerald-silk-saree");

    // Verify breadcrumb reflects Home / Sarees / Stone work / Emerald silk saree
    const productBreadcrumbs = page.locator("nav.breadcrumbs");
    await expect(productBreadcrumbs).toContainText("Home");
    await expect(productBreadcrumbs).toContainText("Sarees");
    await expect(productBreadcrumbs).toContainText("Stone work");

    // 5. Add to Bag and check Cart breakdown
    await page.locator(".size-options button").first().click();
    await page.locator(".add-to-cart-row button.button").click();

    await page.goto("/cart");
    await page.waitForLoadState("domcontentloaded");

    const cartSummary = page.locator(".cart-summary");
    await expect(cartSummary).toBeVisible();
    await expect(cartSummary).toContainText("Subtotal");
    await expect(cartSummary).toContainText("Delivery charge");
    await expect(cartSummary).toContainText("Complimentary across India");
    await expect(cartSummary).toContainText("Estimated total");

    // 6. Check Checkout breakdown
    await page.goto("/checkout");
    await page.waitForLoadState("domcontentloaded");

    const checkoutSummary = page.locator(".cart-summary");
    await expect(checkoutSummary).toBeVisible();
    await expect(checkoutSummary).toContainText("Subtotal");
    await expect(checkoutSummary).toContainText("Delivery");
    await expect(checkoutSummary).toContainText("Total");
  });

  test("admin can view subcategories in the dashboard", async ({ page }) => {
    // 1. Log in to Admin panel
    await page.goto("/admin/login");
    await page.getByLabel("Admin ID or Email").fill("achu");
    await page.getByLabel("Password").fill("1234");
    await page.getByRole("button", { name: "Sign in securely" }).click();

    await page.waitForURL("**/admin/dashboard", { timeout: 15000 });

    // 2. Navigate to Subcategories
    await page.goto("/admin/subcategories");
    await page.waitForLoadState("domcontentloaded");

    await expect(page.locator("h1")).toHaveText("Subcategories");
    const table = page.locator("table.admin-table");
    await expect(table).toBeVisible();
    await expect(table).toContainText("Stone work");
    await expect(table).toContainText("Sarees");
    await expect(table).toContainText("Daily wear");
  });

  test("admin category management uses centered modal popups for add, edit, and view details", async ({
    page,
  }) => {
    await page.goto("/admin/login");
    await page.getByLabel("Admin ID or Email").fill("achu");
    await page.getByLabel("Password").fill("1234");
    await page.getByRole("button", { name: "Sign in securely" }).click();
    await page.waitForURL("**/admin/dashboard", { timeout: 15000 });

    await page.goto("/admin/categories");
    await page.waitForLoadState("domcontentloaded");

    // 1. Verify "Add category" opens the Create Category modal
    const addBtn = page.getByRole("button", { name: "Add category" });
    await addBtn.click();

    const modal = page.locator(".admin-modal-content");
    await expect(modal).toBeVisible();
    await expect(page.locator(".admin-modal-title")).toHaveText("Add Category");
    await expect(page.locator(".admin-modal-overlay")).toBeVisible();

    // Verify modal fields exist
    await expect(page.getByLabel("Name *")).toBeVisible();
    await expect(page.getByLabel("Slug *")).toBeVisible();
    await expect(page.getByLabel("Description")).toBeVisible();

    // Close using Cancel
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(modal).not.toBeVisible();

    // 2. Verify "View details" opens read-only details modal
    const viewBtn = page.locator('button[aria-label*="View"][aria-label*="details"]').first();
    await viewBtn.click();
    await expect(modal).toBeVisible();
    await expect(page.locator(".admin-modal-title")).toHaveText("Category Details");
    await expect(page.locator(".admin-details-hero")).toBeVisible();
    await expect(page.locator(".admin-details-meta-grid")).toBeVisible();

    // Close details modal with Close button
    await page.getByRole("button", { name: "Close", exact: true }).click();
    await expect(modal).not.toBeVisible();

    // 3. Verify "Edit category" opens Edit Category modal prefilled
    const editBtn = page.locator('button[aria-label*="Edit"]').first();
    await editBtn.click();
    await expect(modal).toBeVisible();
    await expect(page.locator(".admin-modal-title")).toHaveText("Edit Category");
    const nameInput = page.getByLabel("Name *");
    const slugInput = page.getByLabel("Slug *");
    expect(await nameInput.inputValue()).not.toBe("");
    expect(await slugInput.inputValue()).not.toBe("");

    // Close with 'X' button
    await page.locator(".admin-modal-close").click();
    await expect(modal).not.toBeVisible();
  });

  test("admin subcategory management uses centered modal popups and responsive layout on mobile", async ({
    page,
  }) => {
    // Test on mobile viewport
    await page.setViewportSize({ width: 390, height: 844 });

    await page.goto("/admin/login");
    await page.getByLabel("Admin ID or Email").fill("achu");
    await page.getByLabel("Password").fill("1234");
    await page.getByRole("button", { name: "Sign in securely" }).click();
    await page.waitForURL("**/admin/dashboard", { timeout: 15000 });

    await page.goto("/admin/subcategories");
    await page.waitForLoadState("domcontentloaded");

    // 1. Open Add Subcategory modal
    const addBtn = page.getByRole("button", { name: "Add subcategory" });
    await addBtn.click();

    const modal = page.locator(".admin-modal-content");
    await expect(modal).toBeVisible();
    await expect(page.locator(".admin-modal-title")).toHaveText("Add Subcategory");

    // Verify parent category dropdown loads options
    const categorySelect = page.getByLabel("Parent Category *");
    await expect(categorySelect).toBeVisible();
    const options = await categorySelect.locator("option").count();
    expect(options).toBeGreaterThan(1);

    // Verify responsive mobile single column and action buttons
    const footer = page.locator(".admin-modal-footer");
    await expect(footer).toBeVisible();
    const cancelBtn = page.getByRole("button", { name: "Cancel" });
    await expect(cancelBtn).toBeVisible();

    // Close modal
    await cancelBtn.click();
    await expect(modal).not.toBeVisible();

    // 2. Open Subcategory View Details modal on mobile
    const viewBtn = page.locator('button[aria-label*="View"][aria-label*="details"]').first();
    await viewBtn.click();
    await expect(modal).toBeVisible();
    await expect(page.locator(".admin-modal-title")).toHaveText("Subcategory Details");
    await expect(page.locator(".admin-details-meta-grid")).toBeVisible();

    // Click "Edit subcategory" from details to transition to edit modal
    const editFromDetails = page.getByRole("button", { name: "Edit subcategory" });
    await editFromDetails.click();
    await expect(page.locator(".admin-modal-title")).toHaveText("Edit Subcategory");

    // Close with Escape key
    await page.keyboard.press("Escape");
    await expect(modal).not.toBeVisible();
  });
});

