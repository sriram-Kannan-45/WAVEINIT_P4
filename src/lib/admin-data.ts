import "server-only";
import { requireAdmin } from "./supabase/server";
import { productSelect } from "./data";
import type { Product, Taxonomy } from "@/types";
export async function adminTaxonomies(
  table: "categories" | "collections",
): Promise<Taxonomy[]> {
  const db = await requireAdmin();
  const { data, error } = await db
    .from(table)
    .select("*")
    .order("display_order");
  if (error) throw new Error("Unable to load records.");
  return data || [];
}
export async function adminProduct(id: string): Promise<Product | null> {
  const db = await requireAdmin();
  const { data, error } = await db
    .from("products")
    .select(productSelect)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error("Unable to load product.");
  return data as Product | null;
}
