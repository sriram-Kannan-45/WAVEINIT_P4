import { test, expect } from "@playwright/test";

test("Product page WhatsApp chat and direct order buttons target the correct vendor", async ({
  page,
}) => {
  // 1. Boutique product targeting user's configured number: 916381102874
  await page.goto("/product/emerald-silk-saree");
  const boutiqueChatBtn = page.locator("a.enquiry-button");
  await expect(boutiqueChatBtn).toBeVisible();
  const boutiqueHref = await boutiqueChatBtn.getAttribute("href");
  expect(boutiqueHref).toContain("https://wa.me/916381102874");
  expect(boutiqueHref).toContain("Emerald%20silk%20saree");

  // Select size and verify direct order button
  await page.getByRole("button", { name: "FREE SIZE", exact: true }).click();
  const boutiqueOrderBtn = page.getByRole("button", { name: /Order on WhatsApp/i });
  await expect(boutiqueOrderBtn).toBeVisible();

  // 2. Specific vendor product targeting: 919876543211 (Varanasi Silk Weavers)
  await page.goto("/product/ivory-embroidered-kurta-set");
  await expect(page.getByText("Varanasi Silk Weavers")).toBeVisible();
  const vendorChatBtn = page.locator("a.enquiry-button");
  await expect(vendorChatBtn).toBeVisible();
  const vendorHref = await vendorChatBtn.getAttribute("href");
  expect(vendorHref).toContain("https://wa.me/919876543211");
  expect(vendorHref).toContain("Ivory%20embroidered%20kurta%20set");

  // Select size S, increase quantity to 2
  await page.getByRole("button", { name: "S", exact: true }).click();
  await page.getByRole("button", { name: "Increase quantity", exact: true }).click();
  const vendorOrderBtn = page.getByRole("button", { name: /Order on WhatsApp/i });
  await expect(vendorOrderBtn).toBeVisible();
});

test("Cart handles multi-vendor items and separates WhatsApp order links per vendor", async ({
  page,
}) => {
  // Clear cart
  await page.goto("/cart");
  await page.evaluate(() => localStorage.removeItem("achu-cart-v1"));

  // Add Item 1 (Boutique piece, 916381102874)
  await page.goto("/product/emerald-silk-saree");
  await page.getByRole("button", { name: "FREE SIZE", exact: true }).click();
  await page.getByRole("button", { name: "Add to bag", exact: true }).click();
  await expect(page.getByText("Added to your bag")).toBeVisible();

  // Add Item 2 (Varanasi Silk Weavers, 919876543211)
  await page.goto("/product/ivory-embroidered-kurta-set");
  await page.getByRole("button", { name: "S", exact: true }).click();
  await page.getByRole("button", { name: "Add to bag", exact: true }).click();
  await expect(page.getByText("Added to your bag")).toBeVisible();

  // Open Cart
  await page.goto("/cart");
  await expect(page.getByText(/Multi-vendor Bag/i)).toBeVisible();

  // Verify separate WhatsApp links per vendor inside cart-summary
  const boutiqueLink = page.locator('.cart-summary a[href*="916381102874"]');
  await expect(boutiqueLink).toBeVisible();
  const boutiqueUrl = await boutiqueLink.getAttribute("href");
  expect(boutiqueUrl).toContain("https://wa.me/916381102874");
  expect(boutiqueUrl).toContain("Emerald%20silk%20saree");
  expect(boutiqueUrl).not.toContain("Ivory%20embroidered%20kurta%20set");

  const vendorLink = page.locator('.cart-summary a[href*="919876543211"]');
  await expect(vendorLink).toBeVisible();
  const vendorUrl = await vendorLink.getAttribute("href");
  expect(vendorUrl).toContain("https://wa.me/919876543211");
  expect(vendorUrl).toContain("Ivory%20embroidered%20kurta%20set");
  expect(vendorUrl).not.toContain("Emerald%20silk%20saree");
});
