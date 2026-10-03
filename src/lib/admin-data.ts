import "server-only";
import { requireAdmin, configured } from "./supabase/server";
import { productSelect } from "./data";
import { demoCategories, demoCollections, demoProducts } from "./demo";
import type { Product, Taxonomy } from "@/types";

export async function adminTaxonomies(
  table: "categories" | "collections",
): Promise<Taxonomy[]> {
  if (!configured()) {
    return table === "categories" ? demoCategories : demoCollections;
  }
  const db = await requireAdmin();
  const { data, error } = await db
    .from(table)
    .select("*")
    .order("display_order");
  if (error) throw new Error("Unable to load records.");
  return data || [];
}

export async function adminProduct(id: string): Promise<Product | null> {
  if (!configured()) {
    return demoProducts.find((p) => p.id === id) || demoProducts[0] || null;
  }
  const db = await requireAdmin();
  const { data, error } = await db
    .from("products")
    .select(productSelect)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error("Unable to load product.");
  return data as Product | null;
}
