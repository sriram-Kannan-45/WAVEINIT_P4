import Link from "next/link";
import { Plus } from "lucide-react";
import { requireAdmin } from "@/lib/supabase/server";
import { adminTaxonomies } from "@/lib/admin-data";
import { ProductTable } from "@/components/admin/product-table";
export default async function Products({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const s = await searchParams;
  const db = await requireAdmin();
  const [result, categories] = await Promise.all([
    db.rpc("admin_product_list", {
      p_query: s.q || "",
      p_category: s.category || null,
      p_status: s.status || "",
      p_stock: s.stock || "",
      p_page: Math.max(1, Number(s.page) || 1),
    }),
    adminTaxonomies("categories"),
  ]);
  if (result.error) throw new Error("Unable to load products.");
  const data = result.data;
  const page = Math.max(1, Number(s.page) || 1);
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
