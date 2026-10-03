import type { MetadataRoute } from "next";
import { configured, supabasePublic } from "@/lib/supabase/server";
import { siteUrl } from "@/lib/utils";
export const dynamic = "force-dynamic";
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const routes = [
    "",
    "/shop",
    "/collections",
    "/about",
    "/contact",
    "/shipping-policy",
    "/return-exchange",
    "/privacy-policy",
    "/terms",
  ];
  const entries: MetadataRoute.Sitemap = routes.map((path) => ({
    url: siteUrl + path,
    changeFrequency: path === "" ? "weekly" : "monthly",
    priority: path === "" ? 1 : 0.6,
  }));
  if (configured()) {
    const db = supabasePublic();
    for (const [table, path] of [
      ["products", "product"],
      ["categories", "category"],
      ["collections", "collections"],
    ] as const) {
      let from = 0;
      for (;;) {
        let q = db
          .from(table)
          .select("slug,updated_at")
          .range(from, from + 999)
          .order("id");
        q =
          table === "products"
            ? q.eq("status", "active")
            : q.eq("active", true);
        const { data, error } = await q;
        if (error) throw new Error("Sitemap could not be loaded.");
        entries.push(
          ...(data || []).map((row) => ({
            url: `${siteUrl}/${path}/${row.slug}`,
            lastModified: row.updated_at,
          })),
        );
        if (!data || data.length < 1000) break;
        from += 1000;
      }
    }
  }
  return entries;
}
