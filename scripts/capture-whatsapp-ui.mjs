import { chromium } from "playwright";

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Add Item 1: Emerald Silk Saree (Achu Boutique - 916381102874)
  await page.goto("http://localhost:3000/product/emerald-silk-saree");
  await page.getByRole("button", { name: "FREE SIZE", exact: true }).click();
  await page.getByRole("button", { name: "Add to bag", exact: true }).click();
  await page.waitForTimeout(500);

  // Add Item 2: Ivory Embroidered Kurta Set (Varanasi Silk Weavers - 919876543211)
  await page.goto("http://localhost:3000/product/ivory-embroidered-kurta-set");
  await page.getByRole("button", { name: "S", exact: true }).click();
  await page.getByRole("button", { name: "Add to bag", exact: true }).click();
  await page.waitForTimeout(500);

  // Go to Cart
  await page.goto("http://localhost:3000/cart");
  await page.waitForTimeout(500);
  await page.screenshot({
    path: "C:/Users/user/.gemini/antigravity-ide/brain/b2b088be-c23d-48f1-a912-fc90b421c280/cart_multivendor_ui.png",
    fullPage: true,
  });

  // Go to Checkout
  await page.goto("http://localhost:3000/checkout");
  await page.waitForTimeout(500);
  await page.screenshot({
    path: "C:/Users/user/.gemini/antigravity-ide/brain/b2b088be-c23d-48f1-a912-fc90b421c280/checkout_ui.png",
    fullPage: true,
  });

  await browser.close();
  console.log("Screenshots captured successfully");
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
