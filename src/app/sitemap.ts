import type { MetadataRoute } from "next";
import { configured, previewMode, supabasePublic } from "@/lib/supabase/server";
import {
  demoCategories,
  demoCollections,
  demoProducts,
  demoSubcategories,
} from "@/lib/demo";
import { siteUrl } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: {
    path: string;
    changeFrequency: "daily" | "weekly" | "monthly";
    priority: number;
  }[] = [
    { path: "", changeFrequency: "daily", priority: 1.0 },
    { path: "/shop", changeFrequency: "daily", priority: 0.9 },
    { path: "/collections", changeFrequency: "weekly", priority: 0.8 },
    { path: "/about", changeFrequency: "monthly", priority: 0.6 },
    { path: "/contact", changeFrequency: "monthly", priority: 0.7 },
    { path: "/shipping-policy", changeFrequency: "monthly", priority: 0.3 },
    { path: "/return-exchange", changeFrequency: "monthly", priority: 0.3 },
    { path: "/privacy-policy", changeFrequency: "monthly", priority: 0.3 },
    { path: "/terms", changeFrequency: "monthly", priority: 0.3 },
  ];

  const entries: MetadataRoute.Sitemap = staticRoutes.map((r) => ({
    url: siteUrl + r.path,
    changeFrequency: r.changeFrequency,
    priority: r.priority,
  }));

  if (configured()) {
    const db = supabasePublic();

    // 1. Products
    let from = 0;
    for (;;) {
      const { data, error } = await db
        .from("products")
        .select("slug, updated_at")
        .eq("status", "active")
        .range(from, from + 999)
        .order("id");
      if (error) break;
      if (data) {
        entries.push(
          ...data.map((row) => ({
            url: `${siteUrl}/product/${row.slug}`,
            lastModified: row.updated_at,
            changeFrequency: "daily" as const,
            priority: 0.9,
          })),
        );
      }
      if (!data || data.length < 1000) break;
      from += 1000;
    }

    // 2. Categories
    const { data: categories } = await db
      .from("categories")
      .select("slug, updated_at")
      .eq("active", true)
      .order("display_order");
    if (categories) {
      entries.push(
        ...categories.map((c) => ({
          url: `${siteUrl}/category/${c.slug}`,
          lastModified: c.updated_at,
          changeFrequency: "weekly" as const,
          priority: 0.8,
        })),
      );
    }

    // 3. Subcategories
    const { data: subcategories } = await db
      .from("subcategories")
      .select("slug, updated_at, categories!inner(slug)")
      .eq("active", true)
      .order("display_order");
    if (subcategories) {
      entries.push(
        ...subcategories.map(
          (sub: {
            slug: string;
            updated_at?: string;
            categories: { slug: string }[] | { slug: string } | unknown;
          }) => {
            const cat = sub.categories;
            const categorySlug = Array.isArray(cat)
              ? (cat[0] as { slug: string })?.slug
              : (cat as { slug: string })?.slug;
            return {
              url: `${siteUrl}/category/${categorySlug || "all"}/${sub.slug}`,
              lastModified: sub.updated_at,
              changeFrequency: "weekly" as const,
              priority: 0.7,
            };
          },
        ),
      );
    }

    // 4. Collections
    const { data: collections } = await db
      .from("collections")
      .select("slug, updated_at")
      .eq("active", true)
      .order("display_order");
    if (collections) {
      entries.push(
        ...collections.map((col) => ({
          url: `${siteUrl}/collections/${col.slug}`,
          lastModified: col.updated_at,
          changeFrequency: "weekly" as const,
          priority: 0.8,
        })),
      );
    }
  } else if (previewMode()) {
    // Preview fallback entries
    entries.push(
      ...demoCategories.map((c) => ({
        url: `${siteUrl}/category/${c.slug}`,
        changeFrequency: "weekly" as const,
        priority: 0.8,
      })),
      ...demoSubcategories.map((sub) => {
        const cat = demoCategories.find((c) => c.id === sub.category_id);
        return {
          url: `${siteUrl}/category/${cat?.slug || "all"}/${sub.slug}`,
          changeFrequency: "weekly" as const,
          priority: 0.7,
        };
      }),
      ...demoCollections.map((col) => ({
        url: `${siteUrl}/collections/${col.slug}`,
        changeFrequency: "weekly" as const,
        priority: 0.8,
      })),
      ...demoProducts.map((p) => ({
        url: `${siteUrl}/product/${p.slug}`,
        changeFrequency: "daily" as const,
        priority: 0.9,
      })),
    );
  }

  return entries;
}
