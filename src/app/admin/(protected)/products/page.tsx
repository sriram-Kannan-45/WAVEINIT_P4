import Link from "next/link";
import { Plus } from "lucide-react";
import { z } from "zod";
import { requireAdmin } from "@/lib/supabase/server";
import { adminTaxonomies } from "@/lib/admin-data";
import { ProductTable } from "@/components/admin/product-table";
import type { Product } from "@/types";

export default async function Products({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const s = await searchParams;
  const db = await requireAdmin();
  const page = Math.max(1, Number(s.page) || 1);

  const [result, categories] = await Promise.all([
    db.rpc("admin_product_list", {
      p_query: s.q || "",
      p_category: s.category || null,
      p_status: s.status || "",
      p_stock: s.stock || "",
      p_page: page,
    }),
    adminTaxonomies("categories"),
  ]);

  let data: { count: number; products: (Product & { total_stock: number })[] };

  if (!result.error && result.data) {
    data = result.data;
  } else {
    // Direct service-role fallback
    let q = db
      .from("products")
      .select(
        "*, categories(name,slug), product_images(storage_path,alt_text,sort_order,is_cover), product_variants(id,size,stock_quantity,active,price)",
        { count: "exact" },
      );

    if (s.q) q = q.ilike("name", `%${s.q.slice(0, 200)}%`);
    if (s.category && z.uuid().safeParse(s.category).success) {
      q = q.eq("category_id", s.category);
    }
    if (s.status && ["active", "draft", "hidden"].includes(s.status)) {
      q = q.eq("status", s.status);
    }

    const { data: prods, count, error } = await q
      .order("updated_at", { ascending: false })
      .range((page - 1) * 30, page * 30 - 1);

    if (error) throw new Error("Unable to load products.");

    const mapped = (prods || []).map((p) => {
      const vars = (p.product_variants || []) as {
        stock_quantity: number;
        active: boolean;
      }[];
      const total_stock = vars
        .filter((v) => v.active)
        .reduce((sum, v) => sum + (v.stock_quantity || 0), 0);
      return {
        ...p,
        total_stock,
      };
    });

    data = {
      count: count || 0,
      products: mapped as unknown as (Product & { total_stock: number })[],
    };
  }
  const pages = Math.ceil(data.count / 30);
  function url(p: number) {
    const params = new URLSearchParams(s as Record<string, string>);
    params.set("page", String(p));
    return `/admin/products?${params}`;
  }
  return (
    <>
      <div className="admin-page-title">
        <div>
          <h1>Your collection</h1>
          <p>
            {data.count} products · Manage the details that make every piece
            yours.
          </p>
        </div>
        <Link className="button" href="/admin/products/new">
          <Plus size={15} />
          Add product
        </Link>
      </div>
      <form className="admin-filters">
        <input
          name="q"
          aria-label="Search products"
          placeholder="Search products…"
          defaultValue={s.q || ""}
        />
        <select
          name="category"
          aria-label="Filter category"
          defaultValue={s.category || ""}
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          name="status"
          aria-label="Filter status"
          defaultValue={s.status || ""}
        >
          <option value="">All statuses</option>
          <option value="active">Published</option>
          <option value="draft">Draft</option>
          <option value="hidden">Hidden</option>
        </select>
        <select
          name="stock"
          aria-label="Filter stock"
          defaultValue={s.stock || ""}
        >
          <option value="">All stock</option>
          <option value="low">Low stock</option>
          <option value="out">Out of stock</option>
        </select>
        <button className="button outline">Apply</button>
      </form>
      <div className="admin-panel" style={{ marginTop: 0 }}>
        <ProductTable products={data.products} />
      </div>
      {pages > 1 && (
        <div className="pagination">
          {page > 1 && (
            <Link className="button outline" href={url(page - 1)}>
              Previous
            </Link>
          )}
          <span>
            {page} / {pages}
          </span>
          {page < pages && (
            <Link className="button outline" href={url(page + 1)}>
              Next
            </Link>
          )}
        </div>
      )}
    </>
  );
}
