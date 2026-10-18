import { test, expect } from "@playwright/test";

test.setTimeout(60000);

async function openMenu(page: import("@playwright/test").Page, name: string) {
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page
    .locator(".mobile-nav")
    .getByRole("link", { name, exact: true })
    .click();
}

test("mobile back navigation restores the storefront after Contact and Collections", async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, "Mobile navigation history");
  await page.goto("/");
  await expect(page.locator(".mobile-intro-container")).toBeVisible();
  await page
    .getByRole("button", { name: "Skip intro and enter boutique" })
    .click();
  await expect(page.locator(".mobile-intro-container")).toHaveCount(0);
  await expect(page.locator("html")).toHaveAttribute(
    "data-store-animate",
    "done",
  );
  const product = page.locator(".arrivals-section .product-card").first();
  await product.scrollIntoViewIfNeeded();
  await expect(product).toBeInViewport();
  const savedY = await page.evaluate(() => scrollY);
  expect(savedY).toBeGreaterThan(300);
  for (const [name, path] of [
    ["Contact", "/contact"],
    ["Collections", "/collections"],
  ]) {
    await openMenu(page, name);
    await expect(page).toHaveURL(new RegExp(`${path}$`));
    await page.goBack();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.locator(".intro-shell-placeholder")).toHaveCount(0);
    await expect(page.locator(".mobile-intro-container")).toHaveCount(0, {
      timeout: 1000,
    });
    await expect(page.locator("html")).not.toHaveAttribute(
      "data-mobile-intro",
      "active",
    );
    expect(await page.evaluate(() => document.body.style.overflow)).not.toBe(
      "hidden",
    );
    await expect
      .poll(() => page.evaluate(() => scrollY))
      .toBeCloseTo(savedY, -1);
    await expect(product).toBeInViewport();
  }
});

test("natural mobile video completion survives menu navigation and reload", async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, "Mobile completed video history");
  await page.goto("/");
  const video = page.locator(".mobile-intro-video");
  await expect(video).toBeVisible();
  await expect
    .poll(() =>
      video.evaluate(
        (element: HTMLVideoElement) =>
          Number.isFinite(element.duration) && element.duration > 0,
      ),
    )
    .toBe(true);
  await video.evaluate((element: HTMLVideoElement) => {
    element.currentTime = element.duration - 0.1;
  });
  await expect(page.locator(".mobile-intro-container")).toHaveCount(0);
  await openMenu(page, "Our story");
  await expect(page).toHaveURL(/\/about$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator(".mobile-intro-container")).toHaveCount(0, {
    timeout: 1000,
  });
  await page.reload();
  await expect(page.locator(".category-circle-card").first()).toHaveClass(
    /is-visible/,
  );
  await expect(page.locator(".mobile-intro-container")).toHaveCount(0);
  await expect(page.locator("html")).not.toHaveAttribute(
    "data-mobile-intro",
    "active",
  );
});

test("mobile menu return skips a completed intro when session storage is blocked", async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, "Mobile storage fallback");
  await page.addInitScript(() => {
    Object.defineProperty(window, "sessionStorage", {
      get() {
        throw new DOMException("Storage blocked", "SecurityError");
      },
    });
  });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Skip intro and enter boutique" })
    .click();
  await expect(page.locator(".mobile-intro-container")).toHaveCount(0);
  await openMenu(page, "Contact");
  await expect(page).toHaveURL(/\/contact$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator(".mobile-intro-container")).toHaveCount(0, {
    timeout: 1000,
  });
  await expect(page.locator(".category-circle-card").first()).toHaveClass(
    /is-visible/,
  );
});
