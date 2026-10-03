import type { Product, Taxonomy } from "@/types";
import { defaultHomepage } from "./defaults";
// Design-preview fixtures only. Never a fallback after a database error.
export const demoCategories: Taxonomy[] = [
  {
    id: "sample-sarees",
    name: "Sarees",
    slug: "sarees",
    description: "A timeless drape",
    image: "/images/saree.png",
    active: true,
    display_order: 0,
  },
  {
    id: "sample-kurtis",
    name: "Kurtis & sets",
    slug: "kurtis",
    description: "Everyday, elevated",
    image: "/images/kurti.png",
    active: true,
    display_order: 1,
  },
  {
    id: "sample-designer",
    name: "Designer wear",
    slug: "designer-wear",
    description: "A statement of you",
    image: "/images/hero.png",
    active: true,
    display_order: 2,
  },
  {
    id: "sample-occasion",
    name: "Occasion wear",
    slug: "occasion-wear",
    description: "For beautiful moments",
    image: "/images/occasion.png",
    active: true,
    display_order: 3,
  },
];
export const demoCollections: Taxonomy[] = [
  {
    id: "sample-festive",
    name: "The festive edit",
    slug: "festive-edit",
    description:
      "Rich textures. Quiet opulence. Pieces for moments to remember.",
    image: "/images/occasion.png",
    active: true,
    featured: true,
    display_order: 0,
  },
];
export const demoProducts: Product[] = [
  [
    "Emerald silk saree",
    "emerald-silk-saree",
    0,
    3490,
    4490,
    "saree",
    "Emerald",
    "Silk",
    "FREE SIZE",
  ],
  [
    "Ivory embroidered kurta set",
    "ivory-embroidered-kurta-set",
    1,
    2490,
    null,
    "kurti",
    "Ivory",
    "Cotton blend",
    "S,M,L,XL",
  ],
  [
    "Wine occasion ensemble",
    "wine-occasion-ensemble",
    3,
    4990,
    null,
    "occasion",
    "Wine",
    "Silk blend",
    "S,M,L,XL",
  ],
  [
    "The emerald occasion edit",
    "emerald-occasion-edit",
    2,
    3990,
    null,
    "hero",
    "Emerald",
    "Silk blend",
    "S,M,L",
  ],
].map((row, i) => ({
  id: `sample-product-${i}`,
  name: String(row[0]),
  slug: String(row[1]),
  category_id: demoCategories[Number(row[2])].id,
  short_description:
    "Illustrative sample design. This piece is shown for preview and is not actual boutique inventory.",
  description:
    "Replace this sample with your own product description and original photography before launch.",
  fabric: String(row[7]),
  colour: String(row[6]),
  care_instructions: "Care instructions to be provided by the boutique.",
  sku: `PREVIEW-${i + 1}`,
  selling_price: Number(row[3]),
  original_price: row[4] === null ? null : Number(row[4]),
  status: "active",
  is_featured: true,
  is_new_arrival: true,
  is_best_seller: true,
  keywords: "sample preview ethnic designer",
  meta_title: "",
  meta_description: "",
  created_at: "2026-10-02T00:00:00Z",
  product_images: [
    {
      storage_path: `/images/${row[5]}.png`,
      alt_text: String(row[0]),
      sort_order: 0,
      is_cover: true,
    },
  ],
  product_variants: String(row[8])
    .split(",")
    .map((size, j) => ({
      id: `sample-variant-${i}-${j}`,
      product_id: `sample-product-${i}`,
      size,
      stock_quantity: j === 1 ? 0 : 4,
      active: true,
    })),
  product_collections: [{ collection_id: "sample-festive" }],
  categories: {
    name: demoCategories[Number(row[2])].name,
    slug: demoCategories[Number(row[2])].slug,
  },
  sample: true,
}));
// Deliberately centralized image mapping for editorial sample records.
demoProducts.forEach((p, i) => {
  p.product_images[0].storage_path = `/images/${["saree", "kurti", "occasion", "hero"][i]}.png`;
});
export const demoHomepage = {
  ...defaultHomepage,
  hero_image: "/images/hero.png",
  featured_collection_id: "sample-festive",
  featured_image: "/images/occasion.png",
  promo_image: "/images/hero.png",
};
