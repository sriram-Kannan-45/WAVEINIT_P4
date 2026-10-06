import { test, expect } from "@playwright/test";
test("homepage presents official branding and responsive images", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.evaluate(() => {
    const store = document.getElementById("boutique");
    if (store) store.inert = false;
    const introEl = document.querySelector(".intro-scroll");
    if (introEl) {
      const top = introEl.getBoundingClientRect().top + window.scrollY;
      window.scrollTo(0, top + introEl.clientHeight + 50);
    }
  });
  await expect(
    page.getByRole("heading", { name: /Elegance/i }),
  ).toBeVisible();
  await expect(
    page.getByText("Illustrative pieces & sample prices."),
  ).toBeVisible();
  await page.evaluate(() => {
    const s = document.querySelector(".cinematic-scroll-section");
    if (s) {
      const top = s.getBoundingClientRect().top + window.scrollY;
      window.scrollTo(0, top + s.clientHeight * 0.45);
    }
  });
  await page.waitForTimeout(400);
  const allHeadings = await page.evaluate(() =>
    Array.from(document.querySelectorAll("h1, h2, h3")).map((h) => ({
      tag: h.tagName,
      text: h.textContent?.trim(),
      display: getComputedStyle(h).display,
      visibility: getComputedStyle(h).visibility,
      opacity: getComputedStyle(h).opacity,
      parentDisplay: h.parentElement ? getComputedStyle(h.parentElement).display : "",
      parentVis: h.parentElement ? getComputedStyle(h.parentElement).visibility : "",
      stageVis: h.closest(".cinematic-stage") ? getComputedStyle(h.closest(".cinematic-stage")!).visibility : "",
      stageOp: h.closest(".cinematic-stage") ? getComputedStyle(h.closest(".cinematic-stage")!).opacity : "",
    }))
  );
  console.log("ALL HEADINGS:", JSON.stringify(allHeadings, null, 2));
  await expect(
    page.getByRole("heading", { name: "New & noteworthy." }),
  ).toBeVisible();
  await page
    .locator("img")
    .first()
    .evaluate(async (img: HTMLImageElement) => {
      if (!img.complete)
        await new Promise((r) =>
          img.addEventListener("load", r, { once: true }),
        );
    });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  expect(errors).toEqual([]);
});
test("product size availability, quantity, persistent bag, and checkout", async ({
  page,
}) => {
  await page.goto("/product/ivory-embroidered-kurta-set");
  await expect(
    page.getByRole("button", { name: "M, unavailable", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "S", exact: true }).click();
  await page
    .getByRole("button", { name: "Increase quantity", exact: true })
    .click();
  await page.getByRole("button", { name: "Add to bag", exact: true }).click();
  await expect(
    page.getByText("Added to your bag", { exact: true }),
  ).toBeVisible();
  await page.goto("/cart");
  await expect(
    page.getByRole("heading", { name: "Ivory embroidered kurta set" }),
  ).toBeVisible();
  await expect(page.locator(".cart-item output")).toHaveText("2");
  await page.reload();
  await expect(page.locator(".cart-item output")).toHaveText("2");
  await page.getByRole("link", { name: "Continue to checkout" }).click();
  await expect(
    page.getByRole("button", { name: "Place order via WhatsApp" }),
  ).toBeDisabled();
  await page.getByLabel("Full name *").fill("Asha Kumar");
  await page.getByLabel("Mobile number *", { exact: true }).fill("9876543210");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
});
test("combined filters, empty state, and search", async ({ page }) => {
  await page.goto("/shop?category=kurtis&size=M&availability=in-stock");
  await expect(
    page.getByText("No products matched your search."),
  ).toBeVisible();
  await page.getByRole("link", { name: "Clear filters", exact: true }).click();
  await expect(page.locator(".product-card")).toHaveCount(4);
  await page.goto("/shop?q=ivory&sort=price-asc");
  await expect(page.locator(".product-card")).toHaveCount(1);
  await expect(
    page.getByRole("heading", { name: "Ivory embroidered kurta set" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Search collection" }).click();
  await page.getByLabel("Search our collection", { exact: true }).fill("wine");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(page).toHaveURL(/q=wine/);
  await expect(page.locator(".product-card")).toHaveCount(1);
  await expect(
    page.getByRole("heading", { name: "Wine occasion ensemble" }),
  ).toBeVisible();
});
test("controlled enquiry endpoint rejects foreign origins, invalid input, and unconfigured checkout", async ({
  request,
}) => {
  const foreign = await request.post("/api/enquiries", {
    headers: { Origin: "https://example.invalid" },
    data: {},
  });
  expect(foreign.status()).toBe(403);
  const invalid = await request.post("/api/enquiries", {
    headers: { Origin: "http://localhost:3000" },
    data: {},
  });
  expect(invalid.status()).toBe(400);
  const valid = await request.post("/api/enquiries", {
    headers: { Origin: "http://localhost:3000" },
    data: {
      customer: {
        full_name: "Test Customer",
        phone: "9876543210",
        alternate_phone: "",
        address_line_1: "12 Test Street",
        address_line_2: "",
        city: "Chennai",
        state: "Tamil Nadu",
        pincode: "600001",
        landmark: "",
        note: "Test only",
        consent: true,
      },
      items: [
        {
          product_id: "11111111-1111-4111-8111-111111111111",
          variant_id: "22222222-2222-4222-8222-222222222222",
          quantity: 1,
          expected_price: 1299,
        },
      ],
      idempotency_key: "33333333-3333-4333-8333-333333333333",
    },
  });
  expect(valid.status()).toBe(503);
  expect((await valid.json()).error).toMatch(/not configured/);
});
test("protected admin URLs redirect to login and no public signup exists", async ({
  page,
}) => {
  await page.goto("/admin/products/new");
  await expect(page).toHaveURL(/\/admin\/login/);
  await expect(
    page.getByRole("heading", { name: "Welcome to Achu." }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Sign in securely" }),
  ).toBeVisible();
  await expect(page.getByText("Sign up", { exact: true })).toHaveCount(0);
});
test("policies, collections, product 404, sitemap, and no overflow at 320px", async ({
  page,
  request,
}) => {
  for (const path of [
    "/collections",
    "/about",
    "/contact",
    "/shipping-policy",
    "/return-exchange",
    "/privacy-policy",
    "/terms",
  ]) {
    const response = await page.goto(path);
    expect(response?.status()).toBe(200);
  }
  const missing = await page.goto("/product/does-not-exist");
  // Next.js streaming not-found pages use 200 after headers are sent; they must carry noindex.
  expect([200, 404]).toContain(missing?.status());
  await expect(
    page.getByRole("heading", { name: "We couldn’t find this page." }),
  ).toBeVisible();
  await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute(
    "content",
    /noindex/,
  );
  expect((await request.get("/sitemap.xml")).status()).toBe(200);
  expect((await request.get("/robots.txt")).status()).toBe(200);
  await page.setViewportSize({ width: 320, height: 740 });
  for (const path of [
    "/",
    "/shop",
    "/product/ivory-embroidered-kurta-set",
    "/cart",
    "/checkout",
    "/admin/login",
  ]) {
    await page.goto(path);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
      `Overflow on ${path}`,
    ).toBeTruthy();
  }
});
