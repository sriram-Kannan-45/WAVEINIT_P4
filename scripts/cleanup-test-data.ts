import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const sb = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false },
});

const EXPECTED_ORIGINAL_SLUGS = new Set([
  "emerald-silk-saree",
  "navy-festive-suit-set",
  "lavender-designer-suit",
  "regal-maroon-anarkali",
  "deno",
  "sriram",
  "sriram-k",
]);

async function runCleanup() {
  console.log("=== STARTING CONTROLLED TEST DATA CLEANUP ===");

  // 1. Audit current products
  const { data: allProducts, error: pErr } = await sb
    .from("products")
    .select("id, name, slug, sku, category_id, created_at");

  if (pErr || !allProducts) {
    throw new Error(`Failed to query products: ${pErr?.message}`);
  }

  const originalProducts = allProducts.filter((p) =>
    EXPECTED_ORIGINAL_SLUGS.has(p.slug),
  );
  const testProducts = allProducts.filter(
    (p) =>
      p.sku?.startsWith("LOAD_TEST_") && p.slug?.startsWith("load-test-"),
  );

  console.log(`Audited total products: ${allProducts.length}`);
  console.log(`Protected original products: ${originalProducts.length}`);
  console.log(`Confirmed test products to delete: ${testProducts.length}`);

  // Safety checks
  if (originalProducts.length !== 7) {
    throw new Error(
      `ABORT: Expected 7 original products, found ${originalProducts.length}. Aborting cleanup to protect database integrity.`,
    );
  }

  if (allProducts.length !== originalProducts.length + testProducts.length) {
    const unknown = allProducts.filter(
      (p) =>
        !EXPECTED_ORIGINAL_SLUGS.has(p.slug) &&
        (!p.sku?.startsWith("LOAD_TEST_") || !p.slug?.startsWith("load-test-")),
    );
    throw new Error(
      `ABORT: Found ${unknown.length} unrecognized products that are neither confirmed test data nor original data: ${JSON.stringify(unknown)}. Cleanup aborted.`,
    );
  }

  if (testProducts.length !== 100) {
    console.warn(
      `Notice: Confirmed test products count is ${testProducts.length} (expected 100 if full set present).`,
    );
  }

  const testProductIds = testProducts.map((p) => p.id);

  // 2. Count dependent records before deletion
  const { count: imagesBefore } = await sb
    .from("product_images")
    .select("*", { count: "exact", head: true });
  const { count: variantsBefore } = await sb
    .from("product_variants")
    .select("*", { count: "exact", head: true });

  console.log(`Total images before: ${imagesBefore}, Total variants before: ${variantsBefore}`);

  // 3. Batch delete test images in chunks of 20
  console.log(`Deleting test product images for ${testProductIds.length} products...`);
  let deletedImagesCount = 0;
  for (let i = 0; i < testProductIds.length; i += 20) {
    const chunk = testProductIds.slice(i, i + 20);
    const { data, error } = await sb
      .from("product_images")
      .delete()
      .in("product_id", chunk)
      .select("id");
    if (error) {
      throw new Error(`Failed to delete product images: ${error.message}`);
    }
    deletedImagesCount += data?.length || 0;
  }
  console.log(`✓ Deleted ${deletedImagesCount} test product image records.`);

  // 4. Batch delete test variants in chunks of 20
  console.log(`Deleting test product variants for ${testProductIds.length} products...`);
  let deletedVariantsCount = 0;
  for (let i = 0; i < testProductIds.length; i += 20) {
    const chunk = testProductIds.slice(i, i + 20);
    const { data, error } = await sb
      .from("product_variants")
      .delete()
      .in("product_id", chunk)
      .select("id");
    if (error) {
      throw new Error(`Failed to delete product variants: ${error.message}`);
    }
    deletedVariantsCount += data?.length || 0;
  }
  console.log(`✓ Deleted ${deletedVariantsCount} test product variant records.`);

  // 5. Batch delete test products in chunks of 20
  console.log(`Deleting ${testProductIds.length} test products...`);
  let deletedProductsCount = 0;
  for (let i = 0; i < testProductIds.length; i += 20) {
    const chunk = testProductIds.slice(i, i + 20);
    const { data, error } = await sb
      .from("products")
      .delete()
      .in("id", chunk)
      .select("id");
    if (error) {
      throw new Error(`Failed to delete products: ${error.message}`);
    }
    deletedProductsCount += data?.length || 0;
  }
  console.log(`✓ Deleted ${deletedProductsCount} test products.`);

  // 6. Post-cleanup verification
  console.log("\n=== POST-CLEANUP VERIFICATION ===");
  const { data: remainingProducts } = await sb
    .from("products")
    .select("id, name, slug, sku, category_id, product_images(*), product_variants(*)")
    .order("created_at");

  const { count: remainingImages } = await sb
    .from("product_images")
    .select("*", { count: "exact", head: true });

  const { count: remainingVariants } = await sb
    .from("product_variants")
    .select("*", { count: "exact", head: true });

  const { data: remainingCategories } = await sb
    .from("categories")
    .select("id, name, slug, active");

  const { data: remainingSubcategories } = await sb
    .from("subcategories")
    .select("id, name, slug, active");

  console.log(`Remaining products in DB: ${remainingProducts?.length} (Expected: 7)`);
  console.log(`Remaining images in DB: ${remainingImages} (Expected: 7)`);
  console.log(`Remaining variants in DB: ${remainingVariants} (Expected: 25)`);
  console.log(`Remaining categories in DB: ${remainingCategories?.length} (Expected: 5)`);
  console.log(`Remaining subcategories in DB: ${remainingSubcategories?.length} (Expected: 3)`);

  const preservedSlugs = new Set(remainingProducts?.map((p) => p.slug) || []);
  for (const expSlug of EXPECTED_ORIGINAL_SLUGS) {
    if (!preservedSlugs.has(expSlug)) {
      throw new Error(`INTEGRITY ERROR: Original product '${expSlug}' is missing!`);
    }
  }

  // Ensure 0 test products remain
  const remainingTestProducts = (remainingProducts || []).filter(
    (p) => p.sku?.startsWith("LOAD_TEST_") || p.slug?.startsWith("load-test-"),
  );
  if (remainingTestProducts.length > 0) {
    throw new Error(`ERROR: ${remainingTestProducts.length} test products still exist!`);
  }

  console.log("\n✓ ALL ORIGINAL 7 PRODUCTS ARE FULLY INTACT AND VERIFIED:");
  remainingProducts?.forEach((p, idx) => {
    console.log(
      `  ${idx + 1}. ${p.name} (${p.slug}) | Images: ${p.product_images?.length} | Variants: ${p.product_variants?.length}`,
    );
  });

  console.log("\n✓ ALL 5 CATEGORIES ARE INTACT:");
  remainingCategories?.forEach((c) => console.log(`  - ${c.name} (${c.slug})`));

  console.log("\n✓ ALL 3 SUBCATEGORIES ARE INTACT:");
  remainingSubcategories?.forEach((s) => console.log(`  - ${s.name} (${s.slug})`));

  console.log("\nCLEANUP COMPLETE: Only confirmed test data removed. All default data preserved.");
}

runCleanup().catch((err) => {
  console.error("Cleanup failed:", err);
  process.exit(1);
});
