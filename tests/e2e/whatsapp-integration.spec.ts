import { test, expect } from "@playwright/test";

test("Product page WhatsApp chat and direct order buttons target the correct vendor", async ({
  page,
}) => {
  // 1. Boutique product targeting user's configured store number: 919629660022
  await page.goto("/product/emerald-silk-saree");
  const boutiqueChatBtn = page.locator("a.enquiry-button");
  await expect(boutiqueChatBtn).toBeVisible();
  const boutiqueHref = await boutiqueChatBtn.getAttribute("href");
  expect(boutiqueHref).toMatch(/https:\/\/wa\.me\/(919629660022|916381102874)/);
  expect(boutiqueHref).toContain("Emerald%20Silk%20Saree");

  // Select size and verify direct order button
  await page.getByRole("button", { name: /Free Size/i }).click();
  const boutiqueOrderBtn = page.getByRole("button", { name: /Order on WhatsApp/i });
  await expect(boutiqueOrderBtn).toBeVisible();

  // 2. Second product: Deno targeting configured boutique number
  await page.goto("/product/deno");
  const denoChatBtn = page.locator("a.enquiry-button");
  await expect(denoChatBtn).toBeVisible();
  const denoHref = await denoChatBtn.getAttribute("href");
  expect(denoHref).toMatch(/https:\/\/wa\.me\/(919629660022|916381102874)/);
  expect(denoHref).toContain("Deno");

  // Select size S, increase quantity to 2
  await page.getByRole("button", { name: "S", exact: true }).click();
  await page.getByRole("button", { name: "Increase quantity", exact: true }).click();
  const denoOrderBtn = page.getByRole("button", { name: /Order on WhatsApp/i });
  await expect(denoOrderBtn).toBeVisible();
});

test("Cart handles items and generates WhatsApp order links with product details", async ({
  page,
}) => {
  // Clear cart
  await page.goto("/cart");
  await page.evaluate(() => localStorage.removeItem("achu-cart-v1"));

  // Add Item 1 (Emerald Silk Saree)
  await page.goto("/product/emerald-silk-saree");
  await page.getByRole("button", { name: /Free Size/i }).click();
  await page.getByRole("button", { name: "Add to bag", exact: true }).click();
  await expect(page.getByText("Added to your bag")).toBeVisible();

  // Add Item 2 (Deno, size S)
  await page.goto("/product/deno");
  await page.getByRole("button", { name: "S", exact: true }).click();
  await page.getByRole("button", { name: "Add to bag", exact: true }).click();
  await expect(page.getByText("Added to your bag")).toBeVisible();

  // Open Cart
  await page.goto("/cart");
  await expect(page.getByText(/Emerald Silk Saree/i)).toBeVisible();
  await expect(page.getByText(/Deno/i)).toBeVisible();

  // Verify WhatsApp order link inside cart-summary
  const orderLink = page.locator('.cart-summary a[href*="wa.me"]');
  await expect(orderLink).toBeVisible();
  const orderUrl = await orderLink.getAttribute("href");
  expect(orderUrl).toMatch(/https:\/\/wa\.me\/(919629660022|916381102874)/);
  expect(orderUrl).toContain("Emerald%20Silk%20Saree");
  expect(orderUrl).toContain("Deno");
});
