import { createClient } from "@supabase/supabase-js";
import { readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { productSchema } from "../src/lib/validations";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const sb = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false },
});

const TEST_PICS_DIR = join(process.cwd(), "test", "pics");
const availableImages = readdirSync(TEST_PICS_DIR).filter((f) => {
  const ext = f.slice(f.lastIndexOf(".")).toLowerCase();
  return [".jpg", ".jpeg", ".png", ".webp"].includes(ext);
});

if (availableImages.length === 0) {
  console.error("No test images found in", TEST_PICS_DIR);
  process.exit(1);
}

console.log(`Found ${availableImages.length} test images in ${TEST_PICS_DIR}`);

const SAREE_FABRICS = [
  "Banarasi Katan Silk",
  "Kanjivaram Pure Silk",
  "Chanderi Zari Tissue",
  "Handloom Tussar Silk",
  "Organza Embroidered",
  "Raw Silk Handwoven",
  "Georgette Chikankari",
  "Paithani Border Silk",
  "Mysore Crepe Silk",
  "Chiffon Resham Draped",
];

const DEMO_FABRICS = [
  "Embroidered Silk Blend",
  "Handcrafted Chikankari Cotton",
  "Velvet Zardozi Couture",
  "Pastel Organza Ensemble",
  "Festive Brocade Jacquard",
  "Pure Linen Handloom",
  "Georgette Mirror Work",
  "Tussar Hand-Block Print",
];

const COLORS = [
  "Emerald Green",
  "Royal Crimson",
  "Peacock Blue",
  "Ivory Gold",
  "Dusty Rose",
  "Deep Plum",
  "Midnight Navy",
  "Marigold Amber",
  "Sage Whisper",
  "Blush Peach",
  "Copper Bronze",
  "Sapphire Azure",
];

async function seed() {
  console.log("Fetching categories from database...");
  const { data: categories, error: catError } = await sb
    .from("categories")
    .select("id, name, slug, active");

  if (catError || !categories) {
    throw new Error(`Failed to fetch categories: ${catError?.message}`);
  }

  const sareeCategory = categories.find((c) => c.slug === "sarees");
  const demoCategory = categories.find(
    (c) => c.slug === "demo-2" || c.name.toLowerCase() === "demo",
  );

  if (!sareeCategory || !demoCategory) {
    throw new Error(
      `Required categories not found: sarees=${!!sareeCategory}, demo=${!!demoCategory}`,
    );
  }

  console.log(
    `Target categories: Sarees (${sareeCategory.id}), Demo (${demoCategory.id})`,
  );

  // Check for any prior LOAD_TEST products to safely clean them before reseeding
  console.log("Checking for existing LOAD_TEST products...");
  const { data: existingLoadTest } = await sb
    .from("products")
    .select("id")
    .like("sku", "LOAD_TEST_%");

  if (existingLoadTest && existingLoadTest.length > 0) {
    console.log(
      `Removing ${existingLoadTest.length} existing LOAD_TEST products for clean repeatable run...`,
    );
    const ids = existingLoadTest.map((p) => p.id);
    for (let i = 0; i < ids.length; i += 20) {
      const chunk = ids.slice(i, i + 20);
      await sb.from("product_images").delete().in("product_id", chunk);
      await sb.from("product_variants").delete().in("product_id", chunk);
      await sb.from("product_collections").delete().in("product_id", chunk);
      await sb.from("products").delete().in("id", chunk);
    }
  }

  // Generate 50 Sarees products and 50 Demo products = 100 products total
  const generatedProducts: Array<{
    productPayload: any;
    variants: any[];
    images: any[];
    rawInput: any;
  }> = [];

  const manifestRecords: Array<{
    id: string;
    name: string;
    slug: string;
    category_id: string;
    category_name: string;
    category_slug: string;
    sku: string;
    selling_price: number;
    original_price: number | null;
    images: Array<{
      storage_path: string;
      file_name: string;
      file_size_bytes: number;
      is_cover: boolean;
      sort_order: number;
    }>;
  }> = [];

  // 1. Generate 50 Sarees products
  for (let i = 1; i <= 50; i++) {
    const pad = String(i).padStart(2, "0");
    const pad3 = String(i).padStart(3, "0");
    const fabric = SAREE_FABRICS[(i - 1) % SAREE_FABRICS.length];
    const colour = COLORS[(i - 1) % COLORS.length];
    const name = `LOAD_TEST ${fabric} Saree in ${colour} #${pad}`;
    const slug = `load-test-saree-${pad}`;
    const sku = `LOAD_TEST_SAR_${pad3}`;
    const sellingPrice = 3999 + ((i * 350) % 18000);
    const originalPrice = sellingPrice + 2000;
    const pid = randomUUID();

    // Pick image from test/pics deterministically
    const primaryImgName = availableImages[(i - 1) % availableImages.length];
    const primaryImgStat = statSync(join(TEST_PICS_DIR, primaryImgName));
    const images: any[] = [
      {
        storage_path: `/test/pics/${primaryImgName}`,
        alt_text: `${name} Front View`,
        sort_order: 0,
        is_cover: true,
      },
    ];

    // Add secondary image to every 3rd product
    if (i % 3 === 0) {
      const secImgName =
        availableImages[(i + 25) % availableImages.length];
      images.push({
        storage_path: `/test/pics/${secImgName}`,
        alt_text: `${name} Detailed Zari Pallu View`,
        sort_order: 1,
        is_cover: false,
      });
    }

    const variants = [
      {
        size: "Free Size",
        stock_quantity: 10 + (i % 15),
        active: true,
        sku: `${sku}_FS`,
        price: null,
      },
    ];

    const rawInput = {
      name,
      slug,
      category_id: sareeCategory.id,
      subcategory_id: null,
      short_description: `Exquisite ${fabric} handcrafted in authentic drape with shimmering ${colour} tones.`,
      description: `Celebrate timeless Indian heritage with this magnificent ${fabric}. Handwoven by master artisans, finished with intricate borders, and tailored for heirloom elegance.`,
      fabric,
      colour,
      care_instructions: "Dry clean only. Store in pure cotton muslin.",
      sku,
      keywords: `LOAD_TEST saree ${fabric.toLowerCase()} ${colour.toLowerCase()} boutique wedding`,
      original_price: originalPrice,
      selling_price: sellingPrice,
      status: "active" as const,
      is_featured: i <= 5,
      is_new_arrival: i % 2 === 0,
      is_best_seller: i % 4 === 0,
      meta_title: `${name} | Achu Designer Boutique`,
      meta_description: `Explore the luxurious ${name}. Premium handcrafted boutique creation.`,
      variants,
      images,
      collection_ids: [],
    };

    // Strict validation check against application productSchema
    productSchema.parse(rawInput);

    generatedProducts.push({
      productPayload: {
        id: pid,
        name: rawInput.name,
        slug: rawInput.slug,
        category_id: rawInput.category_id,
        subcategory_id: null,
        short_description: rawInput.short_description,
        description: rawInput.description,
        fabric: rawInput.fabric,
        colour: rawInput.colour,
        care_instructions: rawInput.care_instructions,
        sku: rawInput.sku,
        keywords: rawInput.keywords,
        original_price: rawInput.original_price,
        selling_price: rawInput.selling_price,
        status: rawInput.status,
        is_featured: rawInput.is_featured,
        is_new_arrival: rawInput.is_new_arrival,
        is_best_seller: rawInput.is_best_seller,
        meta_title: rawInput.meta_title,
        meta_description: rawInput.meta_description,
      },
      variants,
      images,
      rawInput,
    });

    manifestRecords.push({
      id: pid,
      name,
      slug,
      category_id: sareeCategory.id,
      category_name: sareeCategory.name,
      category_slug: sareeCategory.slug,
      sku,
      selling_price: sellingPrice,
      original_price: originalPrice,
      images: images.map((img) => ({
        storage_path: img.storage_path,
        file_name: img.storage_path.replace("/test/pics/", ""),
        file_size_bytes: statSync(
          join(TEST_PICS_DIR, img.storage_path.replace("/test/pics/", "")),
        ).size,
        is_cover: img.is_cover,
        sort_order: img.sort_order,
      })),
    });
  }

  // 2. Generate 50 Demo products
  for (let i = 1; i <= 50; i++) {
    const pad = String(i).padStart(2, "0");
    const pad3 = String(i).padStart(3, "0");
    const fabric = DEMO_FABRICS[(i - 1) % DEMO_FABRICS.length];
    const colour = COLORS[(i + 4) % COLORS.length];
    const name = `LOAD_TEST ${fabric} Demo Ensemble in ${colour} #${pad}`;
    const slug = `load-test-demo-${pad}`;
    const sku = `LOAD_TEST_DEM_${pad3}`;
    const sellingPrice = 2999 + ((i * 420) % 15000);
    const originalPrice = sellingPrice + 1500;
    const pid = randomUUID();

    // Pick image from test/pics with an offset to diversify
    const primaryImgName =
      availableImages[(i + 15) % availableImages.length];
    const primaryImgStat = statSync(join(TEST_PICS_DIR, primaryImgName));
    const images: any[] = [
      {
        storage_path: `/test/pics/${primaryImgName}`,
        alt_text: `${name} Ensemble View`,
        sort_order: 0,
        is_cover: true,
      },
    ];

    if (i % 3 === 0) {
      const secImgName =
        availableImages[(i + 40) % availableImages.length];
      images.push({
        storage_path: `/test/pics/${secImgName}`,
        alt_text: `${name} Close-up Embroidery`,
        sort_order: 1,
        is_cover: false,
      });
    }

    const variants = [
      {
        size: "S",
        stock_quantity: 5 + (i % 8),
        active: true,
        sku: `${sku}_S`,
        price: null,
      },
      {
        size: "M",
        stock_quantity: 8 + (i % 10),
        active: true,
        sku: `${sku}_M`,
        price: null,
      },
      {
        size: "L",
        stock_quantity: 6 + (i % 6),
        active: true,
        sku: `${sku}_L`,
        price: null,
      },
    ];

    const rawInput = {
      name,
      slug,
      category_id: demoCategory.id,
      subcategory_id: null,
      short_description: `Contemporary ${fabric} design with handcrafted detailing in radiant ${colour}.`,
      description: `A masterclass in modern Indian silhouette styling. Made with breathable ${fabric}, finished with artisanal needlecraft, and styled for effortless grace.`,
      fabric,
      colour,
      care_instructions: "Dry clean recommended or gentle handwash.",
      sku,
      keywords: `LOAD_TEST demo ${fabric.toLowerCase()} ${colour.toLowerCase()} luxury suit kurta`,
      original_price: originalPrice,
      selling_price: sellingPrice,
      status: "active" as const,
      is_featured: i <= 5,
      is_new_arrival: i % 2 !== 0,
      is_best_seller: i % 3 === 0,
      meta_title: `${name} | Achu Designer Boutique`,
      meta_description: `Explore ${name}. Handcrafted designer boutique piece.`,
      variants,
      images,
      collection_ids: [],
    };

    productSchema.parse(rawInput);

    generatedProducts.push({
      productPayload: {
        id: pid,
        name: rawInput.name,
        slug: rawInput.slug,
        category_id: rawInput.category_id,
        subcategory_id: null,
        short_description: rawInput.short_description,
        description: rawInput.description,
        fabric: rawInput.fabric,
        colour: rawInput.colour,
        care_instructions: rawInput.care_instructions,
        sku: rawInput.sku,
        keywords: rawInput.keywords,
        original_price: rawInput.original_price,
        selling_price: rawInput.selling_price,
        status: rawInput.status,
        is_featured: rawInput.is_featured,
        is_new_arrival: rawInput.is_new_arrival,
        is_best_seller: rawInput.is_best_seller,
        meta_title: rawInput.meta_title,
        meta_description: rawInput.meta_description,
      },
      variants,
      images,
      rawInput,
    });

    manifestRecords.push({
      id: pid,
      name,
      slug,
      category_id: demoCategory.id,
      category_name: demoCategory.name,
      category_slug: demoCategory.slug,
      sku,
      selling_price: sellingPrice,
      original_price: originalPrice,
      images: images.map((img) => ({
        storage_path: img.storage_path,
        file_name: img.storage_path.replace("/test/pics/", ""),
        file_size_bytes: statSync(
          join(TEST_PICS_DIR, img.storage_path.replace("/test/pics/", "")),
        ).size,
        is_cover: img.is_cover,
        sort_order: img.sort_order,
      })),
    });
  }

  console.log(`Generated ${generatedProducts.length} validated products.`);

  // Insert in chunks of 10
  console.log("Inserting products, variants, and images into Supabase database...");
  for (let i = 0; i < generatedProducts.length; i += 10) {
    const chunk = generatedProducts.slice(i, i + 10);
    const productRows = chunk.map((c) => c.productPayload);
    const { error: pErr } = await sb.from("products").insert(productRows);
    if (pErr) {
      throw new Error(`Failed to insert products chunk ${i}: ${pErr.message}`);
    }

    const variantRows = chunk.flatMap((c) =>
      c.variants.map((v) => ({
        product_id: c.productPayload.id,
        size: v.size,
        stock_quantity: v.stock_quantity,
        active: v.active,
        sku: v.sku,
        price: v.price,
      })),
    );
    const { error: vErr } = await sb
      .from("product_variants")
      .insert(variantRows);
    if (vErr) {
      throw new Error(`Failed to insert variants chunk ${i}: ${vErr.message}`);
    }

    const imageRows = chunk.flatMap((c) =>
      c.images.map((img) => ({
        product_id: c.productPayload.id,
        storage_path: img.storage_path,
        alt_text: img.alt_text,
        sort_order: img.sort_order,
        is_cover: img.is_cover,
      })),
    );
    const { error: iErr } = await sb.from("product_images").insert(imageRows);
    if (iErr) {
      throw new Error(`Failed to insert images chunk ${i}: ${iErr.message}`);
    }

    process.stdout.write(`Inserted ${Math.min(i + 10, generatedProducts.length)} / ${generatedProducts.length}\r`);
  }

  console.log("\nAll 100 test products successfully inserted into database!");

  // Write manifest
  const manifestPath = join(process.cwd(), "scripts", "load-test-manifest.json");
  writeFileSync(
    manifestPath,
    JSON.stringify(
      {
        generated_at: new Date().toISOString(),
        total_products: manifestRecords.length,
        categories: {
          sarees: {
            id: sareeCategory.id,
            slug: sareeCategory.slug,
            count: manifestRecords.filter((r) => r.category_slug === "sarees").length,
          },
          demo: {
            id: demoCategory.id,
            slug: demoCategory.slug,
            count: manifestRecords.filter((r) => r.category_slug === demoCategory.slug).length,
          },
        },
        unique_source_images_used: [
          ...new Set(
            manifestRecords.flatMap((r) => r.images.map((i) => i.file_name)),
          ),
        ].length,
        products: manifestRecords,
      },
      null,
      2,
    ),
  );
  console.log(`Saved manifest to ${manifestPath}`);
}

seed()
  .then(() => {
    console.log("Seed process completed successfully.");
    process.exit(0);
  })
  .catch((err) => {
    console.error("Seed error:", err);
    process.exit(1);
  });
