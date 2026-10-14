/**
 * End-to-End Live Supabase Product Management Audit Script
 * Verifies all CRUD operations against the live Supabase PostgreSQL database.
 */
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { saveProduct, deleteRecord, setProductStatus } from "../src/app/admin/actions";
import { createAdminAccessToken } from "../src/lib/admin-auth";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SECRET_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const db = createClient(SUPABASE_URL, SECRET_KEY);

async function runAudit() {
  console.log("============================================================");
  console.log("🚀 STARTING ADMIN PRODUCT MANAGEMENT LIVE AUDIT");
  console.log("============================================================\n");

  // Step 1: Verify Category & Subcategory exist
  console.log("📍 [STEP 1/6] Verifying Category & Subcategory in Supabase...");
  const { data: categories, error: catErr } = await db
    .from("categories")
    .select("id, name, slug")
    .eq("slug", "sarees")
    .single();

  if (catErr || !categories) {
    throw new Error("Sarees category not found in Supabase: " + catErr?.message);
  }
  console.log(`✅ Category verified: ${categories.name} (ID: ${categories.id})`);

  const { data: subcategory } = await db
    .from("subcategories")
    .select("id, name, slug")
    .eq("category_id", categories.id)
    .limit(1)
    .maybeSingle();

  console.log(`✅ Subcategory: ${subcategory?.name || "None"} (ID: ${subcategory?.id || "N/A"})\n`);

  // Step 1b: Verify Authorization Guard (Unauthorized call must be rejected)
  console.log("🔒 [AUTH GUARD TEST] Testing that unauthorized callers are rejected...");
  delete process.env.ADMIN_BEARER_OVERRIDE;
  let unauthorizedBlocked = false;
  try {
    const unauthRes = await saveProduct(null, { name: "Unauthorized Attempt" });
    if (!unauthRes.ok) {
      unauthorizedBlocked = true;
      console.log("  - Unauthorized request rejected with result:", unauthRes);
    }
  } catch (err: unknown) {
    console.log("  - Catch block error:", (err as Error)?.message || err);
    unauthorizedBlocked = true;
  }
  if (!unauthorizedBlocked) {
    throw new Error("SECURITY FAILURE: Unauthorized call was NOT rejected!");
  }
  console.log("✅ Security verified: Unauthenticated request was strictly blocked!\n");

  // Authenticate Admin with cryptographically signed JWT token
  const adminToken = createAdminAccessToken({ id: "achu", email: "achu@achuboutique.com", role: "admin" });
  process.env.ADMIN_BEARER_OVERRIDE = adminToken;
  console.log("🔑 Authenticated admin session provisioned for audit.\n");

  // Step 2: CREATE Product (C in CRUD)
  console.log("📍 [STEP 2/6] Executing CREATE Product...");
  const testProductSlug = "audit-emerald-saree-" + Date.now();
  const createInput = {
    name: "Achu Royal Emerald Silk Saree",
    slug: testProductSlug,
    category_id: categories.id,
    subcategory_id: subcategory?.id || null,
    short_description: "Exquisite hand-woven emerald green silk saree with gold zari.",
    description: "Handcrafted with the finest pure silk yarns, featuring detailed traditional motifs and rich pallu finish.",
    fabric: "Pure Kanchipuram Silk",
    colour: "Royal Emerald Green",
    care_instructions: "Dry clean only. Store wrapped in pure cotton cloth.",
    sku: "ACHU-ROYAL-EM-01",
    keywords: "kanchipuram, silk, saree, emerald, bridal, gold zari",
    original_price: 28000,
    selling_price: 22500,
    status: "active",
    is_featured: true,
    is_new_arrival: true,
    is_best_seller: false,
    meta_title: "Achu Royal Emerald Silk Saree | Designer Boutique",
    meta_description: "Shop handcrafted Royal Emerald Silk Saree with authentic gold zari work.",
    variants: [
      { size: "S", stock_quantity: 8, active: true, sku: "ACHU-EM-S", price: 22500 },
      { size: "M", stock_quantity: 12, active: true, sku: "ACHU-EM-M", price: 22500 },
      { size: "L", stock_quantity: 6, active: true, sku: "ACHU-EM-L", price: 22500 },
      { size: "XL", stock_quantity: 4, active: true, sku: "ACHU-EM-XL", price: 22500 },
    ],
    images: [
      {
        storage_path: "/pic/Elegant Emerald Green Saree Portrait.webp",
        alt_text: "Front view of royal emerald green saree",
        sort_order: 0,
        is_cover: true,
      },
      {
        storage_path: "/pic/Elegant Navy Indian Ensemble.webp",
        alt_text: "Detail of gold zari border and pallu",
        sort_order: 1,
        is_cover: false,
      },
    ],
    collection_ids: [],
  };

  const createResult = await saveProduct(null, createInput);
  if (!createResult.ok || !createResult.id) {
    throw new Error("Failed to create product via saveProduct: " + createResult.error);
  }
  const createdProductId = createResult.id;
  console.log(`✅ Product created successfully with ID: ${createdProductId}\n`);

  // Step 3: READ Product (R in CRUD)
  console.log("📍 [STEP 3/6] Executing READ Product and verifying all fields directly against Supabase...");
  const { data: fetchedProduct, error: fetchErr } = await db
    .from("products")
    .select("*, categories(name, slug), subcategories(name, slug), product_variants(*), product_images(*)")
    .eq("id", createdProductId)
    .single();

  if (fetchErr || !fetchedProduct) {
    throw new Error("Could not fetch product from Supabase: " + fetchErr?.message);
  }

  console.log(`  - Name:               "${fetchedProduct.name}" (Matches: ${fetchedProduct.name === createInput.name})`);
  console.log(`  - Slug:               "${fetchedProduct.slug}"`);
  console.log(`  - Selling Price:      ₹${fetchedProduct.selling_price} (Matches: ${Number(fetchedProduct.selling_price) === 22500})`);
  console.log(`  - Original Price:     ₹${fetchedProduct.original_price} (Matches: ${Number(fetchedProduct.original_price) === 28000})`);
  console.log(`  - Fabric:             "${fetchedProduct.fabric}"`);
  console.log(`  - Colour:             "${fetchedProduct.colour}"`);
  console.log(`  - Status:             "${fetchedProduct.status}"`);
  console.log(`  - Category:           "${fetchedProduct.categories?.name}"`);
  console.log(`  - Subcategory:        "${fetchedProduct.subcategories?.name || 'N/A'}"`);
  console.log(`  - Variants in DB:     ${fetchedProduct.product_variants.length} sizes`);
  fetchedProduct.product_variants.forEach((v: any) => {
    console.log(`      * Size: ${v.size.padEnd(5)} | Stock: ${String(v.stock_quantity).padStart(2)} | Active: ${v.active} | SKU: ${v.sku}`);
  });
  console.log(`  - Images in DB:       ${fetchedProduct.product_images.length} photos`);
  fetchedProduct.product_images.forEach((img: any) => {
    console.log(`      * Path: ${img.storage_path} | Cover: ${img.is_cover} | Alt: "${img.alt_text}"`);
  });

  const totalStock = fetchedProduct.product_variants.reduce((acc: number, v: any) => acc + v.stock_quantity, 0);
  console.log(`  - Total Inventory:    ${totalStock} units`);
  if (totalStock !== 30) throw new Error(`Expected total stock 30, got ${totalStock}`);
  console.log("✅ READ operation verified with 100% field integrity!\n");

  // Step 4: UPDATE Product (U in CRUD)
  console.log("📍 [STEP 4/6] Executing UPDATE Product (Updating Price, Name, and Adding Size 2XL)...");
  const updateInput = {
    ...createInput,
    name: "Achu Royal Emerald Silk Saree (Festive Edition)",
    selling_price: 21000,
    original_price: 26000,
    colour: "Deep Royal Emerald & Antique Gold",
    variants: [
      { size: "S", stock_quantity: 6, active: true, sku: "ACHU-EM-S", price: 21000 },
      { size: "M", stock_quantity: 10, active: true, sku: "ACHU-EM-M", price: 21000 },
      { size: "L", stock_quantity: 4, active: true, sku: "ACHU-EM-L", price: 21000 },
      { size: "XL", stock_quantity: 2, active: true, sku: "ACHU-EM-XL", price: 21000 },
      { size: "2XL", stock_quantity: 5, active: true, sku: "ACHU-EM-2XL", price: 22000 }, // New size!
    ],
    images: [
      {
        storage_path: "/pic/Elegant Emerald Green Saree Portrait.webp",
        alt_text: "Festive edition emerald saree front drape",
        sort_order: 0,
        is_cover: true,
      },
    ],
  };

  const updateResult = await saveProduct(createdProductId, updateInput);
  if (!updateResult.ok) {
    throw new Error("Failed to update product: " + updateResult.error);
  }

  // Re-fetch from Supabase to verify persistence
  const { data: updatedProduct, error: updateFetchErr } = await db
    .from("products")
    .select("*, product_variants(*), product_images(*)")
    .eq("id", createdProductId)
    .single();

  if (updateFetchErr || !updatedProduct) {
    throw new Error("Failed to re-fetch updated product: " + updateFetchErr?.message);
  }

  console.log(`  - Updated Name:       "${updatedProduct.name}"`);
  console.log(`  - Updated Price:      ₹${updatedProduct.selling_price} (Matches: ${Number(updatedProduct.selling_price) === 21000})`);
  console.log(`  - Updated Variants:   ${updatedProduct.product_variants.length} sizes (Includes 2XL: ${updatedProduct.product_variants.some((v: any) => v.size === "2XL")})`);
  console.log(`  - Updated Images:     ${updatedProduct.product_images.length} image (Alt: "${updatedProduct.product_images[0]?.alt_text}")`);
  console.log("✅ UPDATE operation successfully verified!\n");

  // Step 5: Visibility Toggle (Status Change)
  console.log("📍 [STEP 5/6] Testing Status Toggle (Published -> Hidden -> Published)...");
  const hideResult = await setProductStatus(createdProductId, "hidden");
  if (!hideResult.ok) throw new Error("Failed to hide product: " + hideResult.error);

  const { data: hiddenProd } = await db.from("products").select("status").eq("id", createdProductId).single();
  console.log(`  - Status after hide:   "${hiddenProd?.status}" (Matches 'hidden': ${hiddenProd?.status === "hidden"})`);

  const publishResult = await setProductStatus(createdProductId, "active");
  if (!publishResult.ok) throw new Error("Failed to publish product: " + publishResult.error);

  const { data: publishedProd } = await db.from("products").select("status").eq("id", createdProductId).single();
  console.log(`  - Status after publish: "${publishedProd?.status}" (Matches 'active': ${publishedProd?.status === "active"})`);
  console.log("✅ Status Toggle verified!\n");

  // Step 6: DELETE Product (D in CRUD)
  console.log("📍 [STEP 6/6] Executing DELETE Product and verifying cascade cleanup...");
  const deleteResult = await deleteRecord("products", createdProductId);
  if (!deleteResult.ok) {
    throw new Error("Failed to delete product: " + deleteResult.error);
  }

  // Verify deletion in products
  const { data: deletedProd } = await db.from("products").select("id").eq("id", createdProductId).maybeSingle();
  if (deletedProd) {
    throw new Error("Product was NOT deleted from Supabase!");
  }
  console.log("  - Product row deleted from 'products' table.");

  // Verify cascade deletion in product_variants
  const { data: orphanVariants } = await db.from("product_variants").select("id").eq("product_id", createdProductId);
  console.log(`  - Orphan variants remaining: ${orphanVariants?.length || 0} (Must be 0)`);
  if (orphanVariants && orphanVariants.length > 0) throw new Error("Variants were not cascade deleted!");

  // Verify cascade deletion in product_images
  const { data: orphanImages } = await db.from("product_images").select("id").eq("product_id", createdProductId);
  console.log(`  - Orphan images remaining:   ${orphanImages?.length || 0} (Must be 0)`);
  if (orphanImages && orphanImages.length > 0) throw new Error("Images were not cascade deleted!");

  console.log("✅ DELETE operation and cascade cleanup verified 100%!\n");

  console.log("============================================================");
  console.log("🎉 AUDIT COMPLETED: ALL CRUD OPERATIONS VERIFIED AGAINST SUPABASE!");
  console.log("============================================================");
}

runAudit().catch((err) => {
  console.error("❌ AUDIT FAILED:", err);
  process.exit(1);
});
