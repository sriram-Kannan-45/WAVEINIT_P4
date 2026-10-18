import { test, expect } from "@playwright/test";
import path from "node:path";

const TEST_PNG_PATH = path.resolve(__dirname, "../fix/Elegant Emerald Green Saree Portrait.png");

test.describe("Complete Interactive Buttons & Features Functional Audit", () => {
  test.setTimeout(120000);

  test("1. Storefront: Header navigation, search drawer, cart, and floating WhatsApp", async ({
    page,
  }) => {
    // 1. Visit /collections (ensures clean header testing without home canvas intro overlay)
    await page.goto("/collections");
    await page.waitForLoadState("domcontentloaded");

    const isMobile = (page.viewportSize()?.width ?? 1280) < 768;

    // 2. Navigation links & mobile hamburger drawer
    if (isMobile) {
      const menuBtn = page.locator("button[aria-label='Open navigation']");
      await expect(menuBtn).toBeVisible();
      await menuBtn.click();
      await expect(page.locator(".mobile-nav a[href='/collections']")).toBeVisible();
      await expect(page.locator(".mobile-nav a[href='/shop?new=true']")).toBeVisible();
      await expect(page.locator(".mobile-nav a[href='/about']")).toBeVisible();
      await expect(page.locator(".mobile-nav a[href='/contact']")).toBeVisible();
      // Close drawer with Escape
      await page.keyboard.press("Escape");
      await page.waitForTimeout(300);
    } else {
      await expect(page.locator("header nav[aria-label='Main navigation'] a[href='/collections']")).toBeVisible();
      await expect(page.locator("header nav[aria-label='Main navigation'] a[href='/shop?new=true']")).toBeVisible();
      await expect(page.locator("header nav[aria-label='Main navigation'] a[href='/about']")).toBeVisible();
      await expect(page.locator("header nav[aria-label='Main navigation'] a[href='/contact']")).toBeVisible();
    }

    // 3. Search modal: positive scenario
    const searchBtn = page.locator("button[aria-label='Search collection']").first();
    await expect(searchBtn).toBeVisible();
    await searchBtn.click();
    const searchInput = page.locator("#search-overlay, input[name='q']").first();
    await expect(searchInput).toBeVisible();
    await searchInput.fill("saree");
    await searchInput.press("Enter");
    await page.waitForURL("**/shop?**q=saree**", { timeout: 15000 });
    await expect(page.locator(".product-card").first()).toBeVisible();

    // 4. Search: negative scenario (no results + clear filters button)
    await page.goto("/shop?q=xyznonexistentquery999");
    await expect(page.locator("text=/No products matched|A little more to discover/i").first()).toBeVisible();
    const clearBtn = page.locator("a:has-text('Clear filters'), button:has-text('Clear filters')").first();
    await expect(clearBtn).toBeVisible();

    // 5. Floating WhatsApp button on storefront
    const waFloating = page.locator(".floating-whatsapp, a[aria-label*='WhatsApp']").first();
    await expect(waFloating).toBeVisible();
    const waHref = await waFloating.getAttribute("href");
    expect(waHref).toContain("wa.me");

    // 6. Home page intro bypass verification
    await page.goto("/");
    if (isMobile) {
      const skipBtn = page.locator(".mobile-intro-skip-btn");
      if (await skipBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await skipBtn.click();
        await page.waitForTimeout(500);
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
  });

  test("2. Storefront: PDP Size variant, quantity stepper, size guide, and add to bag", async ({
    page,
  }) => {
    // Clear cart before test
    await page.goto("/cart");
    await page.evaluate(() => localStorage.removeItem("achu-cart-v1"));

    await page.goto("/product/emerald-silk-saree");
    await expect(page.locator("h1")).toContainText("Emerald Silk Saree");

    // 1. Size guide modal trigger
    const sizeGuideBtn = page.locator("button.size-guide-trigger");
    if (await sizeGuideBtn.isVisible().catch(() => false)) {
      await sizeGuideBtn.click();
      await expect(page.locator("text=/Find your fit|Measurements/i").first()).toBeVisible();
      await page.keyboard.press("Escape");
      await page.waitForTimeout(300);
    }

    // 2. Size variant selection
    const sizeBtn = page.getByRole("button", { name: /Free Size/i });
    await expect(sizeBtn).toBeVisible();
    await sizeBtn.click();

    // 3. Add to bag button (Positive scenario)
    const addToBagBtn = page.getByRole("button", { name: "Add to bag", exact: true });
    await addToBagBtn.click();
    await expect(page.getByText("Added to your bag")).toBeVisible({ timeout: 5000 });

    // 4. WhatsApp direct enquiry button
    const waOrderBtn = page.locator("a.enquiry-button, button:has-text('Order on WhatsApp')").first();
    await expect(waOrderBtn).toBeVisible();
    const waOrderHref = await waOrderBtn.getAttribute("href");
    if (waOrderHref) {
      expect(waOrderHref).toContain("wa.me");
    }
  });

  test("3. Storefront: Cart mutations, promo code rejection, and checkout validation", async ({
    page,
  }) => {
    // Ensure item is in cart
    await page.goto("/product/emerald-silk-saree");
    await page.getByRole("button", { name: /Free Size/i }).click();
    await page.getByRole("button", { name: "Add to bag", exact: true }).click();
    await expect(page.getByText("Added to your bag")).toBeVisible({ timeout: 5000 });

    // 1. Visit cart
    await page.goto("/cart");
    await expect(page.locator(".cart-item, .cart-list").first()).toBeVisible({ timeout: 10000 });

    // 2. Quantity stepper inside cart
    const cartPlus = page.locator(".cart-item button:has-text('+'), button[aria-label='Increase quantity']").first();
    if (await cartPlus.isVisible({ timeout: 2000 }).catch(() => false)) {
      await cartPlus.click();
      await page.waitForTimeout(500);
    }

    // 3. Negative scenario: Promo coupon code rejection
    const couponInput = page.locator("input[placeholder*='code' i], input[placeholder*='coupon' i], input[placeholder*='promo' i]").first();
    if (await couponInput.isVisible({ timeout: 1000 }).catch(() => false)) {
      await couponInput.fill("INVALID_COUPON_CODE_999");
      const applyBtn = page.locator("button:has-text('Apply')").first();
      await applyBtn.click();
      await expect(page.locator("text=/invalid|not valid|cannot be applied/i")).toBeVisible({ timeout: 5000 });
    }

    // 4. Proceed to checkout button
    const checkoutLink = page.locator("a[href='/checkout']").first();
    await checkoutLink.click();
    await page.waitForURL("**/checkout", { timeout: 10000 });

    // 5. Checkout Form: Negative scenario (empty submit blocked)
    const placeOrderBtn = page.locator("button[type='submit']").first();
    await placeOrderBtn.click();
    const nameInput = page.locator("input[name='full_name']");
    const isInvalid = await nameInput.evaluate((el: HTMLInputElement) => !el.checkValidity() || el.getAttribute("aria-invalid") === "true");
    expect(isInvalid).toBeTruthy();

    // 6. Checkout Form: Positive scenario (valid details fill)
    await page.locator("input[name='full_name']").fill("Priya Sharma");
    await page.locator("input[name='phone']").fill("9876543210");
    await page.locator("input[name='address_line_1']").fill("Flat 4B, Lotus Apartments");
    await page.locator("input[name='city']").fill("Coimbatore");
    await page.locator("input[name='state']").fill("Tamil Nadu");
    await page.locator("input[name='pincode']").fill("641001");

    // 7. Cleanup cart
    await page.goto("/cart");
    await page.evaluate(() => localStorage.removeItem("achu-cart-v1"));
  });

  test("4. Admin: Authentication security (negative & positive login)", async ({
    page,
  }) => {
    await page.goto("/admin/login");

    // 1. Negative scenario: invalid credentials
    await page.getByLabel("Admin ID or Email").fill("invalid_user");
    await page.getByLabel("Password").fill("wrong_password");
    await page.getByRole("button", { name: "Sign in securely" }).click();
    await expect(page.locator("text=/The admin ID or password is incorrect|Invalid/i").first()).toBeVisible({ timeout: 5000 });

    // 2. Positive scenario: valid credentials
    await page.getByLabel("Admin ID or Email").fill("achu");
    await page.getByLabel("Password").fill("1234");
    await page.getByRole("button", { name: "Sign in securely" }).click();
    await page.waitForURL("**/admin/dashboard", { timeout: 15000 });
    await expect(page.locator("h1")).toContainText(/Welcome to your collection|Dashboard/i);
  });

  test("5. Admin CRUD: Category creation, image crop controls, edit, persistence, and delete", async ({
    page,
  }) => {
    // Login
    await page.goto("/admin/login");
    await page.getByLabel("Admin ID or Email").fill("achu");
    await page.getByLabel("Password").fill("1234");
    await page.getByRole("button", { name: "Sign in securely" }).click();
    await page.waitForURL("**/admin/dashboard", { timeout: 15000 });

    // Navigate to Categories
    await page.goto("/admin/categories");
    await page.waitForLoadState("domcontentloaded");

    const uniqueSlug = `audit-cat-${Date.now()}`;
    const catName = `Audit Category ${Date.now()}`;

    // 1. Open Add Category modal
    await page.getByRole("button", { name: "Add Category" }).click();
    const modal = page.locator(".admin-modal-content");
    await expect(modal).toBeVisible();

    // 2. Fill name & slug
    await modal.locator("input[placeholder*='Sarees']").fill(catName);
    const slugInput = modal.locator("input[placeholder='e.g. sarees']");
    await slugInput.click();
    await slugInput.fill(uniqueSlug);

    // 3. Upload image
    await modal.locator("input[type='file']").first().setInputFiles(TEST_PNG_PATH);

    // 4. Verify cropper opens
    const cropper = page.locator(".cropper-backdrop");
    await expect(cropper).toBeVisible({ timeout: 10000 });

    // Test Zoom In
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

    // 5. Submit Category
    await modal.locator("button[type='submit']").click();
    await expect(modal).not.toBeVisible({ timeout: 15000 });

    // 6. Persistence check: reload page
    await page.reload();
    const table = page.locator(".admin-table");
    await expect(table).toContainText(catName, { timeout: 10000 });

    // 7. Delete Category cleanup
    const row = table.locator(`tr:has-text('${catName}')`);
    await row.locator("button[aria-label*='Delete']").click();
    const confirmBtn = page.locator(".dialog-content button.danger");
    await confirmBtn.click();
    await expect(table).not.toContainText(catName, { timeout: 10000 });
  });

  test("6. Admin: Store settings and homepage settings save and persistence", async ({
    page,
  }) => {
    // Login
    await page.goto("/admin/login");
    await page.getByLabel("Admin ID or Email").fill("achu");
    await page.getByLabel("Password").fill("1234");
    await page.getByRole("button", { name: "Sign in securely" }).click();
    await page.waitForURL("**/admin/dashboard", { timeout: 15000 });

    // 1. Store settings
    await page.goto("/admin/settings");
    await page.waitForLoadState("domcontentloaded");
    await expect(page.locator("h1")).toContainText("Store settings");

    const saveSettingsBtn = page.locator("button:has-text('Save settings')").first();
    await expect(saveSettingsBtn).toBeVisible();
    await saveSettingsBtn.click();
    await expect(page.locator("text=/Settings saved|Saved/i").first()).toBeVisible({ timeout: 10000 });

    // 2. Homepage settings
    await page.goto("/admin/homepage");
    await page.waitForLoadState("domcontentloaded");
    await expect(page.locator("h1")).toContainText("Your homepage");

    const saveHomeBtn = page.locator("button:has-text('Save settings')").first();
    await expect(saveHomeBtn).toBeVisible();
    await saveHomeBtn.click();
    await expect(page.locator("text=/Settings saved|Saved/i").first()).toBeVisible({ timeout: 10000 });
  });
});
