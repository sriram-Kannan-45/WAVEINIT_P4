import "server-only";
import { requireAdmin, configured } from "./supabase/server";
import { productSelect } from "./data";
import {
  demoCategories,
  demoCollections,
  demoProducts,
  demoSubcategories,
  demoNotifications,
  demoNewArrivals,
} from "./demo";
import type {
  Product,
  Subcategory,
  Taxonomy,
  AdminNotification,
  NewArrivalItem,
  InventorySummary,
} from "@/types";

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

export async function adminSubcategories(): Promise<Subcategory[]> {
  if (!configured()) {
    return demoSubcategories;
  }
  const db = await requireAdmin();
  const { data, error } = await db
    .from("subcategories")
    .select("*, categories(name,slug)")
    .order("display_order");
  if (error) throw new Error("Unable to load subcategories.");
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

export async function adminNotifications(): Promise<AdminNotification[]> {
  if (!configured()) {
    return demoNotifications as AdminNotification[];
  }
  const db = await requireAdmin();
  const { data, error } = await db
    .from("admin_notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) {
    console.error("Unable to load notifications:", error);
    return [];
  }
  return (data || []) as AdminNotification[];
}

export async function adminNewArrivals(): Promise<NewArrivalItem[]> {
  if (!configured()) {
    return demoNewArrivals as NewArrivalItem[];
  }
  const db = await requireAdmin();
  const { data, error } = await db
    .from("new_arrivals")
    .select(`
      id,
      product_id,
      display_order,
      badge_text,
      start_date,
      end_date,
      active,
      created_at,
      updated_at,
      products (
        id,
        name,
        slug,
        selling_price,
        original_price,
        status,
        product_images (storage_path, is_cover),
        product_variants (id, size, stock_quantity, active)
      )
    `)
    .order("display_order", { ascending: true });
  if (error) {
    console.error("Unable to load new arrivals:", error);
    return [];
  }
  return (data || []) as unknown as NewArrivalItem[];
}

export async function adminInventorySummary(
  threshold = 3,
): Promise<InventorySummary> {
  if (!configured()) {
    const active = demoProducts.filter((p) => p.status === "active");
    const variants = demoProducts.flatMap((p) => p.product_variants);
    const inStock = active.filter((p) =>
      p.product_variants.some((v) => v.active && v.stock_quantity > 0),
    ).length;
    const outOfStock = active.length - inStock;
    const lowStock = variants.filter(
      (v) => v.active && v.stock_quantity > 0 && v.stock_quantity <= threshold,
    ).length;
    const totalUnits = variants.reduce(
      (sum, v) => sum + (v.active ? v.stock_quantity : 0),
      0,
    );
    return {
      total_active_products: active.length,
      in_stock_products: inStock,
      out_of_stock_products: outOfStock,
      low_stock_variants: lowStock,
      total_inventory_units: totalUnits,
      restock_needed_count: outOfStock + lowStock,
    };
  }
  const db = await requireAdmin();
  const { data: products, error } = await db
    .from("products")
    .select("id, status, product_variants(id, stock_quantity, active)")
    .eq("status", "active");

  if (error || !products) {
    return {
      total_active_products: 0,
      in_stock_products: 0,
      out_of_stock_products: 0,
      low_stock_variants: 0,
      total_inventory_units: 0,
      restock_needed_count: 0,
    };
  }

  let inStockCount = 0;
  let outOfStockCount = 0;
  let lowStockVariantsCount = 0;
  let totalUnits = 0;

  for (const p of products) {
    const activeVariants = (p.product_variants || []).filter(
      (v: { active: boolean; stock_quantity: number }) => v.active,
    );
    const prodStock = activeVariants.reduce(
      (acc: number, v: { stock_quantity: number }) => acc + (v.stock_quantity || 0),
      0,
    );
    if (prodStock > 0) inStockCount++;
    else outOfStockCount++;

    for (const v of activeVariants) {
      totalUnits += v.stock_quantity || 0;
      if (v.stock_quantity > 0 && v.stock_quantity <= threshold) {
        lowStockVariantsCount++;
      }
    }
  }

  return {
    total_active_products: products.length,
    in_stock_products: inStockCount,
    out_of_stock_products: outOfStockCount,
    low_stock_variants: lowStockVariantsCount,
    total_inventory_units: totalUnits,
    restock_needed_count: outOfStockCount + lowStockVariantsCount,
  };
}

