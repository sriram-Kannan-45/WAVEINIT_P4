import { test, expect } from "@playwright/test";

test.describe("Technical SEO, Schema & Metadata Verification", () => {
  test("Homepage technical SEO: title, description, canonical, single h1, and Organization/WebSite JSON-LD", async ({
    page,
  }) => {
    const res = await page.goto("/", { waitUntil: "domcontentloaded" });
    expect(res?.status()).toBe(200);

    // 1. Title tag verification
    const title = await page.title();
    expect(title).toContain("Achu Designer Boutique");
    expect(title).toMatch(/(Sarees|Ethnic Wear|Kurtis)/i);

    // 2. Meta description
    const metaDesc = await page
      .locator('meta[name="description"]')
      .getAttribute("content");
    expect(metaDesc).toBeTruthy();
    expect(metaDesc!.length).toBeGreaterThan(30);
    expect(metaDesc).toContain("Achu Designer Boutique");

    // 3. Canonical link tag
    const canonical = await page
      .locator('link[rel="canonical"]')
      .getAttribute("href");
    expect(canonical).toBeTruthy();

    // 4. Exactly one <h1> tag on the homepage
    const h1s = page.locator("h1");
    const h1Count = await h1s.count();
    expect(h1Count).toBe(1);
    const h1Text = (await h1s.first().textContent())?.trim() || "";
    expect(h1Text).toContain("Achu Designer Boutique");

    // 5. OpenGraph & Twitter Cards
    const ogTitle = await page
      .locator('meta[property="og:title"]')
      .getAttribute("content");
    expect(ogTitle).toContain("Achu Designer Boutique");

    const ogSiteName = await page
      .locator('meta[property="og:site_name"]')
      .getAttribute("content");
    expect(ogSiteName).toBe("Achu Designer Boutique");

    const twitterCard = await page
      .locator('meta[name="twitter:card"]')
      .getAttribute("content");
    expect(twitterCard).toBe("summary_large_image");

    // 6. JSON-LD structured data verification
    const jsonLdScripts = page.locator('script[type="application/ld+json"]');
    const scriptCount = await jsonLdScripts.count();
    expect(scriptCount).toBeGreaterThanOrEqual(1);

    let foundOrg = false;
    let foundWebSite = false;

    for (let i = 0; i < scriptCount; i++) {
      const content = await jsonLdScripts.nth(i).innerText();
      try {
        const parsed = JSON.parse(content);
        const nodes = parsed["@graph"] || [parsed];
        for (const node of nodes) {
          const types = Array.isArray(node["@type"])
            ? node["@type"]
            : [node["@type"]];
          if (types.includes("Organization") || types.includes("ClothingStore")) {
            foundOrg = true;
            expect(node.name).toContain("Achu Designer Boutique");
            expect(node.telephone).toBeTruthy();
            expect(node.address).toBeTruthy();
          }
          if (types.includes("WebSite")) {
            foundWebSite = true;
            expect(node.potentialAction).toBeTruthy();
          }
        }
      } catch {
        // Continue checking other tags
      }
    }

    expect(foundOrg).toBe(true);
    expect(foundWebSite).toBe(true);
  });

  test("Category page technical SEO: single h1, BreadcrumbList & CollectionPage JSON-LD", async ({
    page,
  }) => {
    const res = await page.goto("/category/sarees", {
      waitUntil: "domcontentloaded",
    });
    expect(res?.status()).toBe(200);

    // 1. Title & Meta
    const title = await page.title();
    expect(title).toContain("Sarees");
    expect(title).toContain("Achu");

    // 2. Canonical
    const canonical = await page
      .locator('link[rel="canonical"]')
      .getAttribute("href");
    expect(canonical).toContain("/category/sarees");

    // 3. Exactly one <h1> on category page
    const h1s = page.locator("h1");
    const h1Count = await h1s.count();
    expect(h1Count).toBe(1);
    const h1Text = await h1s.first().innerText();
    expect(h1Text).toBe("Sarees");

    // 4. JSON-LD BreadcrumbList & CollectionPage
    const jsonLdScripts = page.locator('script[type="application/ld+json"]');
    let foundBreadcrumbs = false;
    let foundCollection = false;

    for (let i = 0; i < (await jsonLdScripts.count()); i++) {
      const content = await jsonLdScripts.nth(i).innerText();
      try {
        const parsed = JSON.parse(content);
        const nodes = parsed["@graph"] || [parsed];
        for (const node of nodes) {
          if (node["@type"] === "BreadcrumbList") {
            foundBreadcrumbs = true;
            expect(node.itemListElement.length).toBeGreaterThanOrEqual(2);
          }
          if (node["@type"] === "CollectionPage") {
            foundCollection = true;
            expect(node.name).toContain("Sarees");
          }
        }
      } catch {
        // continue
      }
    }

    expect(foundBreadcrumbs).toBe(true);
    expect(foundCollection).toBe(true);
  });

  test("Subcategory page technical SEO: single h1, 3-level BreadcrumbList", async ({
    page,
  }) => {
    const res = await page.goto("/category/sarees/stone-work", {
      waitUntil: "domcontentloaded",
    });
    expect(res?.status()).toBe(200);

    // 1. Title & Canonical
    const title = await page.title();
    expect(title).toContain("Stone work");
    expect(title).toContain("Achu Designer Boutique");

    const canonical = await page
      .locator('link[rel="canonical"]')
      .getAttribute("href");
    expect(canonical).toContain("/category/sarees/stone-work");

    // 2. Exactly one <h1>
    const h1s = page.locator("h1");
    expect(await h1s.count()).toBe(1);
    expect(await h1s.first().innerText()).toBe("Stone work");

    // 3. JSON-LD Breadcrumbs (Home -> Sarees -> Stone work)
    const jsonLdScripts = page.locator('script[type="application/ld+json"]');
    let foundBreadcrumbs = false;

    for (let i = 0; i < (await jsonLdScripts.count()); i++) {
      const content = await jsonLdScripts.nth(i).innerText();
      try {
        const parsed = JSON.parse(content);
        const nodes = parsed["@graph"] || [parsed];
        for (const node of nodes) {
          if (node["@type"] === "BreadcrumbList") {
            foundBreadcrumbs = true;
            expect(node.itemListElement.length).toBe(3);
            expect(node.itemListElement[2].name).toBe("Stone work");
          }
        }
      } catch {
        // continue
      }
    }

    expect(foundBreadcrumbs).toBe(true);
  });

  test("Product detail page technical SEO: single h1, Product schema with offers and breadcrumbs", async ({
    page,
  }) => {
    const res = await page.goto("/product/emerald-silk-saree", {
      waitUntil: "domcontentloaded",
    });
    expect(res?.status()).toBe(200);

    // 1. Title & Canonical
    const title = await page.title();
    expect(title).toContain("Emerald Silk Saree");
    expect(title).toContain("Achu Designer Boutique");

    const canonical = await page
      .locator('link[rel="canonical"]')
      .getAttribute("href");
    expect(canonical).toContain("/product/emerald-silk-saree");

    // 2. Exactly one <h1>
    const h1s = page.locator("h1");
    expect(await h1s.count()).toBe(1);
    expect(await h1s.first().innerText()).toBe("Emerald Silk Saree");

    // 3. JSON-LD Product & BreadcrumbList
    const jsonLdScripts = page.locator('script[type="application/ld+json"]');
    let foundProduct = false;
    let foundBreadcrumbs = false;

    for (let i = 0; i < (await jsonLdScripts.count()); i++) {
      const content = await jsonLdScripts.nth(i).innerText();
      try {
        const parsed = JSON.parse(content);
        const nodes = parsed["@graph"] || [parsed];
        for (const node of nodes) {
          if (node["@type"] === "Product") {
            foundProduct = true;
            expect(node.name).toBe("Emerald Silk Saree");
            expect(node.brand.name).toBe("Achu Designer Boutique");
            expect(node.offers.priceCurrency).toBe("INR");
            expect(node.offers.availability).toContain("schema.org/");
          }
          if (node["@type"] === "BreadcrumbList") {
            foundBreadcrumbs = true;
            expect(node.itemListElement.length).toBeGreaterThanOrEqual(2);
          }
        }
      } catch {
        // continue
      }
    }

    expect(foundProduct).toBe(true);
    expect(foundBreadcrumbs).toBe(true);
  });

  test("Contact page technical SEO: single h1 and LocalBusiness JSON-LD", async ({
    page,
  }) => {
    const res = await page.goto("/contact", {
      waitUntil: "domcontentloaded",
    });
    expect(res?.status()).toBe(200);

    const title = await page.title();
    expect(title).toContain("Contact Us");

    const h1s = page.locator("h1");
    expect(await h1s.count()).toBe(1);

    const jsonLdScripts = page.locator('script[type="application/ld+json"]');
    let foundLocalBusiness = false;

    for (let i = 0; i < (await jsonLdScripts.count()); i++) {
      const content = await jsonLdScripts.nth(i).innerText();
      try {
        const parsed = JSON.parse(content);
        const nodes = parsed["@graph"] || [parsed];
        for (const node of nodes) {
          const types = Array.isArray(node["@type"])
            ? node["@type"]
            : [node["@type"]];
          if (types.includes("ClothingStore") || types.includes("LocalBusiness")) {
            foundLocalBusiness = true;
            expect(node.telephone).toBeTruthy();
            expect(node.address).toBeTruthy();
          }
        }
      } catch {
        // continue
      }
    }

    expect(foundLocalBusiness).toBe(true);
  });

  test("Robots.txt & Sitemap validation", async ({ request }) => {
    // 1. Robots.txt
    const robotsRes = await request.get("/robots.txt");
    expect(robotsRes.status()).toBe(200);
    const robotsText = await robotsRes.text();
    expect(robotsText).toMatch(/User-agent:\s*\*/i);
    expect(robotsText).toContain("Allow: /");
    expect(robotsText).toContain("Disallow: /admin/");
    expect(robotsText).toContain("sitemap.xml");

    // 2. Sitemap.xml
    const sitemapRes = await request.get("/sitemap.xml");
    expect(sitemapRes.status()).toBe(200);
    const sitemapText = await sitemapRes.text();
    expect(sitemapText).toContain("<urlset");
    expect(sitemapText).toContain("/shop");
    expect(sitemapText).toContain("/collections");
    expect(sitemapText).toContain("/category/");
    expect(sitemapText).toContain("/product/");
  });
});
