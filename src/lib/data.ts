import "server-only";
import { cache } from "react";
import { configured, previewMode, supabasePublic } from "./supabase/server";
import { defaultHomepage, defaultStore } from "./defaults";
import {
  demoCategories,
  demoCollections,
  demoHomepage,
  demoProducts,
} from "./demo";
import type {
  Product,
  Taxonomy,
  Policy,
  Homepage,
  StoreSettings,
} from "@/types";
export const productSelect =
  "*, product_images(*), product_variants(*), product_collections(collection_id), categories(name,slug)";
export const getStore = cache(async (): Promise<StoreSettings> => {
  if (!configured()) return defaultStore;
  const db = supabasePublic();
  const { data, error } = await db
    .from("store_settings")
    .select("*")
    .eq("id", 1)
    .maybeSingle();
  if (error) throw new Error("Store settings could not be loaded.");
  return data ? { ...defaultStore, ...data } : defaultStore;
});
export const getHomepage = cache(async (): Promise<Homepage> => {
  if (!configured()) return previewMode() ? demoHomepage : defaultHomepage;
  const db = supabasePublic();
  const { data, error } = await db
    .from("homepage_settings")
    .select("*")
    .eq("id", 1)
    .maybeSingle();
  if (error) throw new Error("Homepage could not be loaded.");
  return data ? { ...defaultHomepage, ...data } : defaultHomepage;
});
export const getTaxonomies = cache(
  async (table: "categories" | "collections"): Promise<Taxonomy[]> => {
    if (!configured())
      return previewMode()
        ? table === "categories"
          ? demoCategories
          : demoCollections
        : [];
    const db = supabasePublic();
    const { data, error } = await db
      .from(table)
      .select("*")
      .eq("active", true)
      .order("display_order");
    if (error) throw new Error("Collections could not be loaded.");
    return data || [];
  },
);
export type CatalogFilter = {
  q?: string;
  category?: string;
  collection?: string;
  size?: string;
  min?: string;
  max?: string;
  availability?: string;
  sort?: string;
  new?: string;
  best?: string;
  page?: string;
};
export async function getProducts(
  filter: CatalogFilter = {},
  limit = 24,
): Promise<{ products: Product[]; count: number }> {
  if (!configured()) {
    let p = previewMode() ? [...demoProducts] : [];
    if (filter.q)
      p = p.filter((p) =>
        `${p.name} ${p.keywords}`
          .toLowerCase()
          .includes(filter.q!.toLowerCase()),
      );
    if (filter.category)
      p = p.filter((p) => p.categories?.slug === filter.category);
    if (filter.collection) {
      const c = demoCollections.find((c) => c.slug === filter.collection);
      p = p.filter((p) =>
        p.product_collections.some((pc) => pc.collection_id === c?.id),
      );
    }
    if (filter.size)
      p = p.filter((p) =>
        p.product_variants.some(
          (v) =>
            v.active &&
            v.size === filter.size &&
            (filter.availability === "out-of-stock"
              ? v.stock_quantity === 0
              : v.stock_quantity > 0),
        ),
      );
    if (filter.min) p = p.filter((p) => p.selling_price >= Number(filter.min));
    if (filter.max) p = p.filter((p) => p.selling_price <= Number(filter.max));
    if (filter.availability)
      p = p.filter((p) =>
        filter.availability === "in-stock"
          ? p.product_variants.some((v) => v.active && v.stock_quantity > 0)
          : !p.product_variants.some((v) => v.active && v.stock_quantity > 0),
      );
    if (filter.new) p = p.filter((p) => p.is_new_arrival);
    if (filter.best) p = p.filter((p) => p.is_best_seller);
    if (filter.sort === "price-asc")
      p.sort((a, b) => a.selling_price - b.selling_price);
    if (filter.sort === "price-desc")
      p.sort((a, b) => b.selling_price - a.selling_price);
    const page = Math.max(1, Number(filter.page) || 1);
    return {
      products: p.slice((page - 1) * limit, page * limit),
      count: p.length,
    };
  }
  const db = supabasePublic();
  const { data, error } = await db.rpc("catalog_search", {
    p_query: filter.q || null,
    p_category: filter.category || null,
    p_collection: filter.collection || null,
    p_size: filter.size || null,
    p_min: filter.min ? Number(filter.min) : null,
    p_max: filter.max ? Number(filter.max) : null,
    p_availability: filter.availability || null,
    p_sort: filter.sort || "newest",
    p_new: filter.new === "true",
    p_best: filter.best === "true",
    p_page: Math.max(1, Number(filter.page) || 1),
    p_limit: limit,
  });
  if (error)
    throw new Error("The collection could not be loaded. Please try again.");
  return { products: data?.products || [], count: data?.count || 0 };
}
export async function getProduct(slug: string): Promise<Product | null> {
  if (!configured())
    return previewMode()
      ? demoProducts.find((p) => p.slug === slug) || null
      : null;
  const db = supabasePublic();
  const { data, error } = await db
    .from("products")
    .select(productSelect)
    .eq("slug", slug)
    .eq("status", "active")
    .maybeSingle();
  if (error) throw new Error("Product could not be loaded.");
  return data as Product | null;
}
export async function getPolicy(slug: string): Promise<Policy | null> {
  if (!configured()) return null;
  const db = supabasePublic();
  const { data, error } = await db
    .from("policies")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error("Policy could not be loaded.");
  return data;
}
