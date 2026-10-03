import Link from "next/link";
import { Plus, ArrowUpRight } from "lucide-react";
import { requireAdmin } from "@/lib/supabase/server";
import { money } from "@/lib/utils";
type Low = { id: string; name: string; total: number };
export default async function Dashboard() {
  const db = await requireAdmin();
  const [stats, orders, recent] = await Promise.all([
    db.rpc("admin_dashboard"),
    db
      .from("order_enquiries")
      .select("id,order_reference,customer_name,subtotal,status")
      .order("created_at", { ascending: false })
      .limit(5),
    db
      .from("products")
      .select("id,name,status")
      .order("created_at", { ascending: false })
      .limit(5),
  ]);
  if (stats.error || orders.error || recent.error)
    throw new Error("Dashboard could not be loaded.");
  const s = stats.data;
  return (
    <>
      <div className="admin-page-title">
        <div>
          <p className="eyebrow">YOUR BOUTIQUE, AT A GLANCE</p>
          <h1>Welcome to your collection.</h1>
          <p>A little care today, a beautiful experience for your customers.</p>
        </div>
        <Link className="button" href="/admin/products/new">
          <Plus size={15} />
          Add product
        </Link>
      </div>
      <div className="admin-grid">
        {[
          ["Total products", "total_products"],
          ["Published products", "active_products"],
          ["Out of stock", "out_of_stock"],
          ["Low stock", "low_stock"],
          ["Categories", "categories"],
          ["Collections", "collections"],
          ["New enquiries", "new_enquiries"],
        ].map(([name, key]) => (
          <div key={key} className="stat-card">
            <span>{name}</span>
            <strong>{s[key]}</strong>
          </div>
        ))}
      </div>
      <section className="admin-panel">
        <div className="section-heading">
          <h2>A little stock attention</h2>
          <Link href="/admin/inventory?stock=low" className="text-link">
            Manage stock <ArrowUpRight size={14} />
          </Link>
        </div>
        {s.low_stock_products.length ? (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Available stock</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {s.low_stock_products.map((p: Low) => (
                  <tr key={p.id}>
                    <td>{p.name}</td>
                    <td>
                      <span className="status-pill warning">{p.total}</span>
                    </td>
                    <td>
                      <Link
                        className="text-link"
                        href={`/admin/inventory?product=${p.id}`}
                      >
                        Update stock
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="muted">No low-stock products.</p>
        )}
      </section>
      <section className="admin-panel">
        <div className="section-heading">
          <h2>Recent enquiries</h2>
          <Link href="/admin/orders" className="text-link">
            View all <ArrowUpRight size={14} />
          </Link>
        </div>
        {orders.data?.length ? (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Customer</th>
                  <th>Subtotal</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {orders.data.map((o) => (
                  <tr key={o.id}>
                    <td>
                      <Link href="/admin/orders">{o.order_reference}</Link>
                    </td>
                    <td>{o.customer_name}</td>
                    <td>{money(o.subtotal)}</td>
                    <td>
                      <span className="status-pill">{o.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="muted">No enquiries yet.</p>
        )}
      </section>
      <section className="admin-panel">
        <h2>Recently added pieces</h2>
        {recent.data?.length ? (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <tbody>
                {recent.data.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <Link href={`/admin/products/${p.id}/edit`}>
                        {p.name}
                      </Link>
                    </td>
                    <td>{p.status}</td>
                    <td>
                      <Link
                        className="text-link"
                        href={`/admin/products/${p.id}/edit`}
                      >
                        Edit
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="muted">
            Add your first product to begin your collection.
          </p>
        )}
      </section>
    </>
  );
}
