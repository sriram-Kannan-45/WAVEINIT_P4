import test from "node:test";
import assert from "node:assert/strict";
import { productSchema } from "../src/lib/validations/index";
import { VIEW_LABEL_OPTIONS, STANDARD_VIEW_LABELS } from "../src/components/admin/image-uploader";
import { createClient } from "@supabase/supabase-js";
import fs from "fs";

// Helper to extract view label from alt_text (mirroring storefront logic)
function extractViewLabel(altText?: string): string {
  if (!altText || !altText.trim()) return "";
  const known = [
    "Front View",
    "Back View",
    "Left View",
    "Right View",
    "Side View",
    "Fabric Detail",
    "Border Detail",
    "Blouse Detail",
    "Detail View",
  ];
  for (const k of known) {
    if (altText.toLowerCase().includes(k.toLowerCase())) return k;
  }
  return altText.length <= 22 ? altText : "";
}

test("PHASE 2 & 3: Category default image mapping and fitting rules", () => {
  const CATEGORY_DEFAULT_IMAGES: Record<string, string> = {
    sarees: "/pic/Elegant Emerald Green Saree Portrait.webp",
    kurtis: "/pic/Elegant Navy Indian Ensemble.webp",
    "designer-wear": "/pic/Lavender Embroidered Anarkali Portrait.webp",
    "occasion-wear": "/pic/Maroon Embroidered Anarkali Portrait.webp",
    "demo-2": "/pic/Elegant Ivory Embroidered Anarkali Portrait.webp",
  };

  assert.equal(
    CATEGORY_DEFAULT_IMAGES["sarees"],
    "/pic/Elegant Emerald Green Saree Portrait.webp",
  );
  assert.equal(
    CATEGORY_DEFAULT_IMAGES["kurtis"],
    "/pic/Elegant Navy Indian Ensemble.webp",
  );
  assert.equal(
    CATEGORY_DEFAULT_IMAGES["designer-wear"],
    "/pic/Lavender Embroidered Anarkali Portrait.webp",
  );
  assert.equal(
    CATEGORY_DEFAULT_IMAGES["occasion-wear"],
    "/pic/Maroon Embroidered Anarkali Portrait.webp",
  );

  // Check that all default asset files physically exist in public/
  for (const [, path] of Object.entries(CATEGORY_DEFAULT_IMAGES)) {
    const fullPath = `d:/WAVEINIT_4/public${path}`;
    assert.equal(fs.existsSync(fullPath), true, `Asset ${path} must exist on disk`);
  }
});

test("PHASE 3.2: Image View Labels & Options", () => {
  assert.ok(STANDARD_VIEW_LABELS.includes("Front View"));
  assert.ok(STANDARD_VIEW_LABELS.includes("Back View"));
  assert.ok(STANDARD_VIEW_LABELS.includes("Left View"));
  assert.ok(STANDARD_VIEW_LABELS.includes("Right View"));
  assert.ok(STANDARD_VIEW_LABELS.includes("Side View"));
  assert.ok(STANDARD_VIEW_LABELS.includes("Fabric Detail"));
  assert.ok(STANDARD_VIEW_LABELS.includes("Border Detail"));
  assert.ok(STANDARD_VIEW_LABELS.includes("Blouse Detail"));

  assert.equal(extractViewLabel("Front View"), "Front View");
  assert.equal(extractViewLabel("Back View"), "Back View");
  assert.equal(extractViewLabel("Fabric Detail - Pure Kanjivaram zari"), "Fabric Detail");
  assert.equal(extractViewLabel("Border Detail"), "Border Detail");
  assert.equal(extractViewLabel(""), "");
});

test("PHASE 3 & 4: Multi-image Product Validation Schema", () => {
  const baseProduct = {
    name: "Royal Heritage Banarasi Saree",
    slug: "royal-heritage-banarasi-saree",
    category_id: "150d3cfb-894c-460c-8440-7585684f3f6d",
    subcategory_id: "982c5aab-68a2-4786-a0ae-0488a2150988",
    short_description: "Exquisite handwoven gold zari work.",
    description: "Detailed description of royal heritage saree.",
    fabric: "Pure Silk",
    colour: "Emerald Green",
    care_instructions: "Dry clean only",
    sku: "TEST-SKU-001",
    keywords: "saree banarasi silk",
    original_price: 5999,
    selling_price: 4499,
    status: "active" as const,
    is_featured: true,
    is_new_arrival: true,
    is_best_seller: false,
    meta_title: "Royal Heritage Saree",
    meta_description: "Discover royal heritage saree.",
    collection_ids: [],
    variants: [
      { size: "Free Size", stock_quantity: 10, active: true, sku: "TEST-VAR-1" },
    ],
  };

  // Case 1: Single image product
  const p1 = productSchema.safeParse({
    ...baseProduct,
    images: [
      {
        storage_path: "/pic/Elegant Emerald Green Saree Portrait.webp",
        alt_text: "Front View",
        sort_order: 0,
        is_cover: true,
      },
    ],
  });
  assert.equal(p1.success, true);

  // Case 2: Five images with distinct view labels
  const p5 = productSchema.safeParse({
    ...baseProduct,
    images: [
      {
        storage_path: "/pic/Elegant Emerald Green Saree Portrait.webp",
        alt_text: "Front View",
        sort_order: 0,
        is_cover: true,
      },
      {
        storage_path: "/pic/Elegant Navy Indian Ensemble.webp",
        alt_text: "Back View",
        sort_order: 1,
        is_cover: false,
      },
      {
        storage_path: "/pic/Lavender Embroidered Anarkali Portrait.webp",
        alt_text: "Side View",
        sort_order: 2,
        is_cover: false,
      },
      {
        storage_path: "/pic/Maroon Embroidered Anarkali Portrait.webp",
        alt_text: "Fabric Detail",
        sort_order: 3,
        is_cover: false,
      },
      {
        storage_path: "/pic/Elegant Ivory Embroidered Anarkali Portrait.webp",
        alt_text: "Border Detail",
        sort_order: 4,
        is_cover: false,
      },
    ],
  });
  assert.equal(p5.success, true);

  // Case 3: Rejection if more than one cover is selected
  const pInvalidCover = productSchema.safeParse({
    ...baseProduct,
    images: [
      {
        storage_path: "/pic/img1.webp",
        alt_text: "Front View",
        sort_order: 0,
        is_cover: true,
      },
      {
        storage_path: "/pic/img2.webp",
        alt_text: "Back View",
        sort_order: 1,
        is_cover: true, // Invalid: Two covers
      },
    ],
  });
  assert.equal(pInvalidCover.success, false);
});

test("PHASE 4 & 5: Database Persistence & Primary Image Sorting", async () => {
  const env = fs.readFileSync("d:/WAVEINIT_4/.env.local", "utf8");
  const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=([^\r\n]+)/)?.[1]?.trim();
  const key = env.match(/SUPABASE_SERVICE_ROLE_KEY=([^\r\n]+)/)?.[1]?.trim();
  assert.ok(url, "Supabase URL must be configured");
  assert.ok(key, "Supabase Key must be configured");

  const supabase = createClient(url!, key!);

  // Find Emerald Silk Saree
  const { data: prod, error } = await supabase
    .from("products")
    .select("*, product_images(*)")
    .eq("slug", "emerald-silk-saree")
    .single();

  assert.equal(error, null);
  assert.ok(prod, "Emerald Silk Saree must exist");
  assert.ok(prod.product_images.length >= 1, "Product must have at least 1 image");

  // Verify that sort rule orders is_cover DESC, sort_order ASC
  const sorted = [...prod.product_images].sort((a, b) => {
    if (a.is_cover && !b.is_cover) return -1;
    if (!a.is_cover && b.is_cover) return 1;
    return (a.sort_order ?? 0) - (b.sort_order ?? 0);
  });

  assert.equal(sorted[0].is_cover, true, "First sorted image must be the primary cover image");
});
