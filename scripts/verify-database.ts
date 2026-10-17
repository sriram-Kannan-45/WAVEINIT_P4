import { createClient } from "@supabase/supabase-js";
import { existsSync } from "node:fs";
import { join } from "node:path";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const sb = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false },
});

async function verify() {
  console.log("=== PHASE 7: DATABASE VERIFICATION ===");
  const results = {
    testProductsCount: 0,
    nonTestProductsCount: 0,
    sareesTestCount: 0,
    demoTestCount: 0,
    sareesImageCount: 0,
    demoImageCount: 0,
    invalidCategoryRefs: 0,
    invalidImagePaths: 0,
    duplicateSlugs: 0,
    orphanedImages: 0,
    orphanedVariants: 0,
    retrievalWorks: false,
    nonTestUntouched: false,
    errors: [] as string[],
  };

  // 1. Check all products
  const { data: allProducts, error: pErr } = await sb
    .from("products")
    .select("id, name, slug, category_id, sku, status, product_images(*), product_variants(*)");

  if (pErr || !allProducts) {
    results.errors.push(`Failed to select products: ${pErr?.message}`);
    console.error(results);
    process.exit(1);
  }

  const testProducts = allProducts.filter((p) => p.sku?.startsWith("LOAD_TEST_"));
  const nonTestProducts = allProducts.filter((p) => !p.sku?.startsWith("LOAD_TEST_"));

  results.testProductsCount = testProducts.length;
  results.nonTestProductsCount = nonTestProducts.length;

  console.log(`✓ Total test products: ${results.testProductsCount} (Target: 100)`);
  console.log(`✓ Total non-test existing products: ${results.nonTestProductsCount} (Target: 7)`);

  // 2. Categories check
  const { data: categories } = await sb.from("categories").select("id, name, slug");
  const sareeCat = categories?.find((c) => c.slug === "sarees");
  const demoCat = categories?.find((c) => c.slug === "demo-2" || c.name.toLowerCase() === "demo");

  const validCategoryIds = new Set(categories?.map((c) => c.id) || []);

  const sareesProds = testProducts.filter((p) => p.category_id === sareeCat?.id);
  const demoProds = testProducts.filter((p) => p.category_id === demoCat?.id);

  results.sareesTestCount = sareesProds.length;
  results.demoTestCount = demoProds.length;

  console.log(`✓ Sarees test products: ${results.sareesTestCount} (Target: 50)`);
  console.log(`✓ Demo test products: ${results.demoTestCount} (Target: 50)`);

  // Count image entries
  const sareesImages = sareesProds.flatMap((p) => p.product_images || []);
  const demoImages = demoProds.flatMap((p) => p.product_images || []);
  results.sareesImageCount = sareesImages.length;
  results.demoImageCount = demoImages.length;

  console.log(`✓ Sarees image entries: ${results.sareesImageCount} (Target: >= 50)`);
  console.log(`✓ Demo image entries: ${results.demoImageCount} (Target: >= 50)`);

  // 3. Check valid category references
  for (const p of testProducts) {
    if (!validCategoryIds.has(p.category_id)) {
      results.invalidCategoryRefs++;
      results.errors.push(`Product ${p.id} has invalid category_id: ${p.category_id}`);
    }
  }

  // 4. Verify all image paths exist on disk
  const allTestImages = testProducts.flatMap((p) => p.product_images || []);
  for (const img of allTestImages) {
    if (img.storage_path.startsWith("/test/pics/")) {
      const fileName = img.storage_path.replace("/test/pics/", "");
      const fullPath = join(process.cwd(), "test", "pics", fileName);
      if (!existsSync(fullPath)) {
        results.invalidImagePaths++;
        results.errors.push(`Missing image file on disk: ${img.storage_path}`);
      }
    } else {
      results.invalidImagePaths++;
      results.errors.push(`Unexpected storage path format: ${img.storage_path}`);
    }
  }
  console.log(`✓ Valid test images verified on disk: ${allTestImages.length - results.invalidImagePaths} / ${allTestImages.length}`);

  // 5. Check duplicate slugs or IDs
  const slugSet = new Set<string>();
  for (const p of allProducts) {
    if (slugSet.has(p.slug)) {
      results.duplicateSlugs++;
      results.errors.push(`Duplicate slug found: ${p.slug}`);
    }
    slugSet.add(p.slug);
  }
  console.log(`✓ Duplicate slugs: ${results.duplicateSlugs}`);

  // 6. Check orphaned image / variant records
  const allProdIds = new Set(allProducts.map((p) => p.id));
  const { data: allImages } = await sb.from("product_images").select("id, product_id");
  const { data: allVariants } = await sb.from("product_variants").select("id, product_id");

  for (const img of allImages || []) {
    if (!allProdIds.has(img.product_id)) {
      results.orphanedImages++;
      results.errors.push(`Orphaned image ${img.id} referencing missing product ${img.product_id}`);
    }
  }

  for (const v of allVariants || []) {
    if (!allProdIds.has(v.product_id)) {
      results.orphanedVariants++;
      results.errors.push(`Orphaned variant ${v.id} referencing missing product ${v.product_id}`);
    }
  }
  console.log(`✓ Orphaned image records: ${results.orphanedImages}`);
  console.log(`✓ Orphaned variant records: ${results.orphanedVariants}`);

  // 7. Test product retrieval via RPC catalog_search
  const { data: rpcSarees, error: rpcErr1 } = await sb.rpc("catalog_search", {
    p_category: "sarees",
    p_limit: 50,
  });
  const { data: rpcDemo, error: rpcErr2 } = await sb.rpc("catalog_search", {
    p_category: demoCat?.slug,
    p_limit: 50,
  });

  if (!rpcErr1 && !rpcErr2 && rpcSarees?.products?.length && rpcDemo?.products?.length) {
    results.retrievalWorks = true;
    console.log(`✓ catalog_search RPC retrieval verified: Sarees count=${rpcSarees.count}, Demo count=${rpcDemo.count}`);
  } else {
    results.errors.push(`RPC retrieval error: ${rpcErr1?.message || rpcErr2?.message}`);
  }

  // 8. Confirm non-test products untouched
  const expectedNonTestSlugs = [
    "emerald-silk-saree",
    "navy-festive-suit-set",
    "lavender-designer-suit",
    "regal-maroon-anarkali",
    "deno",
    "sriram",
    "sriram-k",
  ];
  const actualNonTestSlugs = nonTestProducts.map((p) => p.slug);
  const allNonTestPresent = expectedNonTestSlugs.every((s) => actualNonTestSlugs.includes(s));
  results.nonTestUntouched = allNonTestPresent && nonTestProducts.length === 7;
  console.log(`✓ Non-test products intact: ${results.nonTestUntouched} (7 original products preserved)`);

  console.log("\n--- VERIFICATION SUMMARY ---");
  const passed =
    results.testProductsCount === 100 &&
    results.sareesTestCount === 50 &&
    results.demoTestCount === 50 &&
    results.invalidCategoryRefs === 0 &&
    results.invalidImagePaths === 0 &&
    results.duplicateSlugs === 0 &&
    results.orphanedImages === 0 &&
    results.orphanedVariants === 0 &&
    results.retrievalWorks &&
    results.nonTestUntouched &&
    results.errors.length === 0;

  console.log(`Status: ${passed ? "ALL CHECKS PASSED ✓" : "FAILURES DETECTED ✗"}`);
  if (!passed) {
    console.error("Errors:", results.errors);
    process.exit(1);
  }
}

verify().catch((e) => {
  console.error("Verification crashed:", e);
  process.exit(1);
});
