import { Suspense } from "react";
import Link from "next/link";
import { Plus, ArrowUpRight } from "lucide-react";
import { requireAdmin } from "@/lib/supabase/server";
import { money } from "@/lib/utils";

type Low = { id: string; name: string; total: number };
type OrderPreview = {
  id: string;
  order_reference: string;
  customer_name: string;
  subtotal: number;
  status: string;
};
type ProductPreview = { id: string; name: string; status: string };

type DashboardStats = {
  total_products: number;
  active_products: number;
  out_of_stock: number;
  low_stock: number;
  categories: number;
  collections: number;
  new_enquiries: number;
  low_stock_products: Low[];
  [key: string]: unknown;
};

// 1. Granular Skeletons
function StatsGridSkeleton() {
  return (
    <div className="admin-grid" aria-label="Loading dashboard statistics" aria-busy="true">
      {[
        "Total products",
        "Published products",
        "Out of stock",
        "Low stock",
        "Categories",
        "Collections",
        "New enquiries",
      ].map((label, i) => (
        <div key={i} className="stat-card skeleton-card">
          <span>{label}</span>
          <div className="skeleton" style={{ height: 32, width: "50%", marginTop: 8 }} />
        </div>
      ))}
    </div>
  );
}

function SectionTableSkeleton({ rows = 4, title }: { rows?: number; title: string }) {
  return (
    <section className="admin-panel" aria-busy="true">
      <div className="section-heading">
        <h2>{title}</h2>
      </div>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <tbody>
            {Array.from({ length: rows }).map((_, i) => (
              <tr key={i}>
                <td style={{ width: "40%" }}>
                  <div className="skeleton skeleton-line" style={{ height: 16 }} />
                </td>
                <td style={{ width: "30%" }}>
                  <div className="skeleton skeleton-line" style={{ height: 16, width: "60%" }} />
                </td>
                <td style={{ width: "30%" }}>
                  <div className="skeleton skeleton-line" style={{ height: 16, width: "40%" }} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// 2. Streamed Subcomponents
async function DashboardStatsSection() {
  const db = await requireAdmin();
  let s: DashboardStats;

  try {
    const stats = await db.rpc("admin_dashboard");
    if (!stats.error && stats.data) {
      s = stats.data as DashboardStats;
    } else {
      // Fallback calculation
      const [
        { count: total_products },
        { count: active_products },
        { count: categories },
        { count: collections },
        { count: new_enquiries },
        { data: variants },
      ] = await Promise.all([
        db.from("products").select("id", { count: "exact", head: true }),
        db
          .from("products")
          .select("id", { count: "exact", head: true })
          .eq("status", "active"),
        db.from("categories").select("id", { count: "exact", head: true }),
        db.from("collections").select("id", { count: "exact", head: true }),
        db
          .from("order_enquiries")
          .select("id", { count: "exact", head: true })
          .eq("status", "new"),
        db.from("product_variants").select("product_id, stock_quantity, active"),
      ]);

      const stockMap: Record<string, number> = {};
      for (const v of variants || []) {
        if (v.active) {
          stockMap[v.product_id] =
            (stockMap[v.product_id] || 0) + (v.stock_quantity || 0);
        }
      }

      let out_of_stock = 0;
      let low_stock = 0;
      for (const total of Object.values(stockMap)) {
        if (total === 0) out_of_stock++;
        else if (total <= 3) low_stock++;
      }

      s = {
        total_products: total_products || 0,
        active_products: active_products || 0,
        out_of_stock,
        low_stock,
        categories: categories || 0,
        collections: collections || 0,
        new_enquiries: new_enquiries || 0,
        low_stock_products: [],
      };
    }
  } catch (err) {
    console.error("Dashboard stats fetch error:", err);
    s = {
      total_products: 0,
      active_products: 0,
      out_of_stock: 0,
      low_stock: 0,
      categories: 0,
      collections: 0,
      new_enquiries: 0,
      low_stock_products: [],
    };
  }

  return (
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
          <strong>{String(s[key] ?? 0)}</strong>
        </div>
      ))}
    </div>
  );
}

async function StockAttentionSection() {
  const db = await requireAdmin();
  let lowStockProducts: Low[] = [];

  try {
    const stats = await db.rpc("admin_dashboard");
    if (!stats.error && stats.data && Array.isArray((stats.data as DashboardStats).low_stock_products)) {
      lowStockProducts = (stats.data as DashboardStats).low_stock_products;
    } else {
      // Fallback
      const { data: variants } = await db
        .from("product_variants")
        .select("product_id, stock_quantity, active, products(id, name)")
        .eq("active", true)
        .lte("stock_quantity", 3)
        .order("stock_quantity", { ascending: true })
        .limit(8);

      if (variants) {
        lowStockProducts = variants.map((v) => ({
          id: v.product_id,
          name: (v.products as unknown as { name: string })?.name || "Product",
          total: v.stock_quantity,
        }));
      }
    }
  } catch {
    lowStockProducts = [];
  }

  return (
    <section className="admin-panel">
      <div className="section-heading">
        <h2>A little stock attention</h2>
        <Link href="/admin/inventory?stock=low" className="text-link">
          Manage stock <ArrowUpRight size={14} />
        </Link>
      </div>
      {lowStockProducts.length ? (
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
              {lowStockProducts.map((p: Low) => (
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
  );
}

async function RecentEnquiriesSection() {
  const db = await requireAdmin();
  const { data: orders } = await db
    .from("order_enquiries")
    .select("id,order_reference,customer_name,subtotal,status")
    .order("created_at", { ascending: false })
    .limit(5);

  return (
    <section className="admin-panel">
      <div className="section-heading">
        <h2>Recent enquiries</h2>
        <Link href="/admin/orders" className="text-link">
          View all <ArrowUpRight size={14} />
        </Link>
      </div>
      {orders?.length ? (
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
              {orders.map((o: OrderPreview) => (
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
  );
}

async function RecentlyAddedSection() {
  const db = await requireAdmin();
  const { data: recent } = await db
    .from("products")
    .select("id,name,status")
    .order("created_at", { ascending: false })
    .limit(5);

  return (
    <section className="admin-panel">
      <h2>Recently added pieces</h2>
      {recent?.length ? (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <tbody>
              {recent.map((p: ProductPreview) => (
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
  );
}

// 3. Main Page Component
export default function Dashboard() {
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

      <Suspense fallback={<StatsGridSkeleton />}>
        <DashboardStatsSection />
      </Suspense>

      <Suspense fallback={<SectionTableSkeleton title="A little stock attention" rows={3} />}>
        <StockAttentionSection />
      </Suspense>

      <Suspense fallback={<SectionTableSkeleton title="Recent enquiries" rows={4} />}>
        <RecentEnquiriesSection />
      </Suspense>

      <Suspense fallback={<SectionTableSkeleton title="Recently added pieces" rows={4} />}>
        <RecentlyAddedSection />
      </Suspense>
    </>
  );
}
