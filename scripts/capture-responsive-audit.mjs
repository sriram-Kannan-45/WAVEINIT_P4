import { chromium } from "playwright";
import fs from "fs";
import path from "path";

const ARTIFACTS_DIR = "C:/Users/user/.gemini/antigravity-ide/brain/55ef8ec7-df19-436a-986b-b94540088b98";
const MEDIA_DIR = path.join(ARTIFACTS_DIR, ".tempmediaStorage");

if (!fs.existsSync(MEDIA_DIR)) {
  fs.mkdirSync(MEDIA_DIR, { recursive: true });
}

async function capture() {
  const browser = await chromium.launch();

  const viewports = [
    { name: "mobile_320", width: 320, height: 568 },
    { name: "mobile_375", width: 375, height: 667 },
    { name: "mobile_430", width: 430, height: 932 },
    { name: "tablet_768", width: 768, height: 1024 },
    { name: "laptop_1366", width: 1366, height: 768 },
    { name: "desktop_1920", width: 1920, height: 1080 },
  ];

  for (const vp of viewports) {
    const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const page = await context.newPage();

    // 1. Category Listing
    await page.goto("http://localhost:3000/category/kurtis");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(500);
    const catFile = path.join(MEDIA_DIR, `cat_kurtis_${vp.name}.png`);
    await page.screenshot({ path: catFile, fullPage: false });
    console.log(`Captured: ${catFile}`);

    // 2. Product Detail Page
    await page.goto("http://localhost:3000/product/ivory-embroidered-kurta-set");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(500);
    const pdpFile = path.join(MEDIA_DIR, `pdp_${vp.name}.png`);
    await page.screenshot({ path: pdpFile, fullPage: false });
    console.log(`Captured: ${pdpFile}`);

    // 3. Admin Inventory & Product Edit (for mobile 375, tablet 768, laptop 1366)
    if (["mobile_375", "tablet_768", "laptop_1366"].includes(vp.name)) {
      await page.goto("http://localhost:3000/admin/login");
      await page.getByLabel("Admin ID or Email").fill("achu");
      await page.getByLabel("Password").fill("1234");
      await page.getByRole("button", { name: "Sign in securely" }).click();
      await page.waitForURL("**/admin/dashboard", { timeout: 15000 });

      await page.goto("http://localhost:3000/admin/inventory");
      await page.waitForLoadState("domcontentloaded");
      await page.waitForTimeout(500);
      const invFile = path.join(MEDIA_DIR, `admin_inventory_${vp.name}.png`);
      await page.screenshot({ path: invFile, fullPage: false });
      console.log(`Captured: ${invFile}`);

      await page.goto("http://localhost:3000/admin/products/new");
      await page.waitForLoadState("domcontentloaded");
      await page.waitForTimeout(500);
      const prodNewFile = path.join(MEDIA_DIR, `admin_product_new_${vp.name}.png`);
      await page.screenshot({ path: prodNewFile, fullPage: false });
      console.log(`Captured: ${prodNewFile}`);

      await page.goto("http://localhost:3000/admin/new-arrivals");
      await page.waitForLoadState("domcontentloaded");
      await page.waitForTimeout(500);
      const newArrFile = path.join(MEDIA_DIR, `admin_new_arrivals_${vp.name}.png`);
      await page.screenshot({ path: newArrFile, fullPage: false });
      console.log(`Captured: ${newArrFile}`);
    }

    await context.close();
  }

  await browser.close();
  console.log("All captures completed successfully!");
}

capture().catch((e) => {
  console.error(e);
  process.exit(1);
});
