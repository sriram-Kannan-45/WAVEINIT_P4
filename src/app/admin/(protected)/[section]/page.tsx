import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { Boxes, Package, AlertTriangle, AlertOctagon, Layers } from "lucide-react";
import { requireAdmin, configured } from "@/lib/supabase/server";
import {
  adminTaxonomies,
  adminSubcategories,
  adminInventorySummary,
  adminNewArrivals,
} from "@/lib/admin-data";
import { getStore, getHomepage, productSelect } from "@/lib/data";
import { demoProducts } from "@/lib/demo";
import { TaxonomyManager } from "@/components/admin/taxonomy-manager";
import { SubcategoryManager } from "@/components/admin/subcategory-manager";
import { ContentForm, PolicyForm } from "@/components/admin/content-forms";
import { NewArrivalsManager } from "@/components/admin/new-arrivals-manager";
import {
  InventoryTable,
  type InventoryRow,
} from "@/components/admin/inventory-table";
import { OrdersTable } from "@/components/admin/orders-table";
import { PasswordForm } from "@/components/admin/login-form";
import type { Enquiry, Product } from "@/types";
export default async function Section({
  params,
  searchParams,
}: {
  params: Promise<{ section: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { section } = await params;
  const filters = await searchParams;
  const db = await requireAdmin();
  if (section === "categories" || section === "collections") {
    return (
      <TaxonomyManager
        table={section}
        records={await adminTaxonomies(section)}
      />
    );
  }
  if (section === "subcategories") {
    const [categories, subcategories] = await Promise.all([
      adminTaxonomies("categories"),
      adminSubcategories(),
    ]);
    return (
      <SubcategoryManager
        categories={categories}
        subcategories={subcategories}
      />
    );
  }
  if (section === "settings" || section === "homepage") {
    const values =
      section === "settings" ? await getStore() : await getHomepage();
    return (
      <>
        <div className="admin-page-title">
          <div>
            <h1>
              {section === "settings" ? "Store settings" : "Your homepage"}
            </h1>
            <p>
              {section === "settings"
                ? "Contact details, your story, and fit information."
                : "A considered welcome, curated by you."}
            </p>
          </div>
        </div>
        <ContentForm
          kind={section}
          values={values}
          collections={
            section === "homepage" ? await adminTaxonomies("collections") : []
          }
        />
      </>
    );
  }
  if (section === "policies") {
    const { data, error } = await db.from("policies").select("*");
    if (error) throw new Error("Unable to load policies.");
    return (
      <>
        <div className="admin-page-title">
          <div>
            <h1>Customer policies</h1>
            <p>Publish the details your customers need.</p>
          </div>
        </div>
        <PolicyForm policies={data || []} />
      </>
    );
  }
  if (section === "account")
    return (
      <>
        <div className="admin-page-title">
          <div>
            <h1>Your account</h1>
            <p>Keep your owner access secure.</p>
          </div>
        </div>
        <PasswordForm />
      </>
    );
  if (section === "new-arrivals") {
    const items = await adminNewArrivals();
    let products: Product[] = [];
    if (!configured()) {
      products = demoProducts;
    } else {
      const { data, error } = await db
        .from("products")
        .select(productSelect)
        .eq("status", "active")
        .order("name", { ascending: true });
      if (!error && data) {
        products = data as unknown as Product[];
      } else {
        products = demoProducts;
      }
    }
    return <NewArrivalsManager items={items} products={products} />;
  }
  const page = Math.max(1, Number(filters.page) || 1);
  const from = (page - 1) * 30;
  function pages(count: number | null) {
    const total = Math.ceil((count || 0) / 30);
    const url = (p: number) => {
      const sp = new URLSearchParams();
      Object.entries(filters).forEach(([k, v]) => {
        if (v) sp.set(k, v);
      });
      sp.set("page", String(p));
      return `/admin/${section}?${sp}`;
    };
    return total > 1 ? (
      <div className="pagination">
        {page > 1 && (
          <Link className="button outline" href={url(page - 1)}>
            Previous
          </Link>
        )}
        <span>
          {page} / {total}
        </span>
        {page < total && (
          <Link className="button outline" href={url(page + 1)}>
            Next
          </Link>
        )}
      </div>
    ) : null;
  }
  if (section === "inventory") {
    const store = await getStore();
    const [summary, categories, subcategories] = await Promise.all([
      adminInventorySummary(store.low_stock_threshold),
      adminTaxonomies("categories"),
      adminSubcategories(),
    ]);
    let q = db
      .from("product_variants")
      .select(
        "id,size,stock_quantity,active,price,products!inner(id,name,status,category_id,subcategory_id,selling_price,categories(name,slug),subcategories(name,slug),product_images(storage_path,is_cover))",
        { count: "exact" },
      )
      .order("updated_at", { ascending: false })
      .range(from, from + 29);
    if (filters.q) q = q.ilike("products.name", `%${filters.q.slice(0, 200)}%`);
    if (filters.product && z.uuid().safeParse(filters.product).success)
      q = q.eq("product_id", filters.product);
    if (filters.category) q = q.eq("products.category_id", filters.category);
    if (filters.subcategory)
      q = q.eq("products.subcategory_id", filters.subcategory);
    if (filters.size) q = q.ilike("size", `%${filters.size.slice(0, 20)}%`);
    if (filters.stock === "low")
      q = q
        .lte("stock_quantity", store.low_stock_threshold)
        .gt("stock_quantity", 0);
    if (filters.stock === "out") q = q.eq("stock_quantity", 0);
    if (filters.stock === "in")
      q = q.gt("stock_quantity", store.low_stock_threshold);
    const { data, error, count } = await q;
    if (error) throw new Error("Unable to load inventory.");
    return (
      <>
        <div className="admin-page-title">
          <div>
            <h1>Inventory & Stock Control</h1>
            <p>
              Monitor real-time stock levels, resolve out-of-stock sizes, and adjust
              quantities across your boutique collection.
            </p>
          </div>
        </div>

        <div className="inventory-stats-grid">
          <Link href="/admin/inventory" className="inventory-stat-card">
            <div className="inventory-stat-top">
              <span className="inventory-stat-label">Active Products</span>
              <Boxes size={18} style={{ color: "var(--muted)" }} />
            </div>
            <span className="inventory-stat-value">
              {summary.total_active_products}
            </span>
            <span className="inventory-stat-sub">Across all boutique collections</span>
          </Link>

          <Link
            href="/admin/inventory?stock=in"
            className={`inventory-stat-card success-card ${filters.stock === "in" ? "active-filter" : ""}`}
          >
            <div className="inventory-stat-top">
              <span className="inventory-stat-label">In Stock</span>
              <Package size={18} style={{ color: "var(--green)" }} />
            </div>
            <span
              className="inventory-stat-value"
              style={{ color: "var(--green)" }}
            >
              {summary.in_stock_products}
            </span>
            <span className="inventory-stat-sub">Ready for customer ordering</span>
          </Link>

          <Link
            href="/admin/inventory?stock=out"
            className={`inventory-stat-card alert-card ${filters.stock === "out" ? "active-filter" : ""}`}
          >
            <div className="inventory-stat-top">
              <span className="inventory-stat-label">Out of Stock</span>
              <AlertOctagon size={18} style={{ color: "#c53030" }} />
            </div>
            <span
              className="inventory-stat-value"
              style={{ color: "#c53030" }}
            >
              {summary.out_of_stock_products}
            </span>
            <span className="inventory-stat-sub">Zero units remaining in catalog</span>
          </Link>

          <Link
            href="/admin/inventory?stock=low"
            className={`inventory-stat-card warning-card ${filters.stock === "low" ? "active-filter" : ""}`}
          >
            <div className="inventory-stat-top">
              <span className="inventory-stat-label">Low Stock Variants</span>
              <AlertTriangle size={18} style={{ color: "#d97706" }} />
            </div>
            <span
              className="inventory-stat-value"
              style={{ color: "#d97706" }}
            >
              {summary.low_stock_variants}
            </span>
            <span className="inventory-stat-sub">
              At or under threshold ({store.low_stock_threshold})
            </span>
          </Link>

          <div className="inventory-stat-card">
            <div className="inventory-stat-top">
              <span className="inventory-stat-label">Total Units</span>
              <Layers size={18} style={{ color: "var(--muted)" }} />
            </div>
            <span className="inventory-stat-value">
              {summary.total_inventory_units.toLocaleString()}
            </span>
            <span className="inventory-stat-sub">
              Units across all active variants
            </span>
          </div>
        </div>

        <form className="admin-filters">
          <input
            name="q"
            aria-label="Search stock by product"
            placeholder="Search products…"
            defaultValue={filters.q || ""}
          />
          {filters.product && (
            <input type="hidden" name="product" value={filters.product} />
          )}
          <select
            key={`cat-${filters.category || "all"}`}
            name="category"
            aria-label="Filter by category"
            defaultValue={filters.category || ""}
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select
            key={`sub-${filters.subcategory || "all"}`}
            name="subcategory"
            aria-label="Filter by subcategory"
            defaultValue={filters.subcategory || ""}
          >
            <option value="">All subcategories</option>
            {subcategories.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <input
            key={`size-${filters.size || ""}`}
            name="size"
            aria-label="Filter by size"
            placeholder="Size (e.g. S, XL)"
            defaultValue={filters.size || ""}
            style={{ maxWidth: 110 }}
          />
          <select
            key={`stock-${filters.stock || "all"}`}
            name="stock"
            aria-label="Filter inventory status"
            defaultValue={filters.stock || ""}
          >
            <option value="">All stock status</option>
            <option value="in">In stock</option>
            <option value="low">Low stock</option>
            <option value="out">Out of stock</option>
          </select>
          <button className="button outline">Apply</button>
          <Link className="text-link" href="/admin/inventory">
            Clear
          </Link>
        </form>
        <div className="admin-panel" style={{ marginTop: 0 }}>
          <InventoryTable
            rows={(data || []) as unknown as InventoryRow[]}
            threshold={store.low_stock_threshold}
          />
        </div>
        {pages(count)}
      </>
    );
  }
  if (section === "orders") {
    let q = db
      .from("order_enquiries")
      .select("*,order_enquiry_items(*)", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, from + 29);
    if (
      filters.status &&
      ["new", "contacted", "confirmed", "completed", "cancelled"].includes(
        filters.status,
      )
    )
      q = q.eq("status", filters.status);
    if (filters.q) q = q.ilike("customer_name", `%${filters.q.slice(0, 100)}%`);
    const { data, error, count } = await q;
    if (error) throw new Error("Unable to load enquiries.");
    return (
      <>
        <div className="admin-page-title">
          <div>
            <h1>Your conversations</h1>
            <p>
              {count || 0} enquiries · Expand a reference to view delivery
              details and item snapshots.
            </p>
          </div>
        </div>
        <form className="admin-filters">
          <input
            name="q"
            placeholder="Search customer…"
            aria-label="Search enquiry customer"
            defaultValue={filters.q || ""}
          />
          <select
            name="status"
            aria-label="Filter enquiries"
            defaultValue={filters.status || ""}
          >
            <option value="">All statuses</option>
            {["new", "contacted", "confirmed", "completed", "cancelled"].map(
              (s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ),
            )}
          </select>
          <button className="button outline">Apply</button>
        </form>
        <div className="admin-panel" style={{ marginTop: 0 }}>
          <OrdersTable orders={(data || []) as Enquiry[]} />
        </div>
        {pages(count)}
      </>
    );
  }
  notFound();
}
