import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/supabase/server";
import { adminTaxonomies } from "@/lib/admin-data";
import { getStore, getHomepage } from "@/lib/data";
import { TaxonomyManager } from "@/components/admin/taxonomy-manager";
import { ContentForm, PolicyForm } from "@/components/admin/content-forms";
import {
  InventoryTable,
  type InventoryRow,
} from "@/components/admin/inventory-table";
import { OrdersTable } from "@/components/admin/orders-table";
import { PasswordForm } from "@/components/admin/login-form";
import type { Enquiry } from "@/types";
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
    let q = db
      .from("product_variants")
      .select(
        "id,size,stock_quantity,active,products!inner(id,name,status,product_images(storage_path,is_cover))",
        { count: "exact" },
      )
      .order("updated_at", { ascending: false })
      .range(from, from + 29);
    if (filters.q) q = q.ilike("products.name", `%${filters.q.slice(0, 200)}%`);
    if (filters.product && z.uuid().safeParse(filters.product).success)
      q = q.eq("product_id", filters.product);
    if (filters.stock === "low")
      q = q
        .lte("stock_quantity", store.low_stock_threshold)
        .gt("stock_quantity", 0);
    if (filters.stock === "out") q = q.eq("stock_quantity", 0);
    const { data, error, count } = await q;
    if (error) throw new Error("Unable to load inventory.");
    return (
      <>
        <div className="admin-page-title">
          <div>
            <h1>Care for your stock</h1>
            <p>
              Update availability by size. Changes appear on the storefront
              after saving.
            </p>
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
            name="stock"
            aria-label="Filter inventory"
            defaultValue={filters.stock || ""}
          >
            <option value="">All stock</option>
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
