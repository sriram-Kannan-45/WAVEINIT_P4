import Link from "next/link";
import { ProductCard } from "./card";
import { CatalogFilters, CatalogSort } from "./filters";
import {
  getProducts,
  getTaxonomies,
  getStore,
  type CatalogFilter,
} from "@/lib/data";
export async function Catalog({
  filters,
  title = "The Achu collection",
  subtitle = "Find pieces that feel like you. Explore our edit of Indian wear, one beautiful detail at a time.",
}: {
  filters: CatalogFilter;
  title?: string;
  subtitle?: string;
}) {
  const [result, categories, collections, store] = await Promise.all([
    getProducts(filters),
    getTaxonomies("categories"),
    getTaxonomies("collections"),
    getStore(),
  ]);
  const page = Math.max(1, Number(filters.page) || 1);
  const pages = Math.ceil(result.count / 24);
  const pageUrl = (page: number) => {
    const p = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v) p.set(k, v);
    });
    p.set("page", String(page));
    return `/shop?${p}`;
  };
  return (
    <>
      <div className="page-heading">
        <div className="container">
          <p className="eyebrow">THOUGHTFULLY CURATED</p>
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>
      </div>
      <div className="container catalog-layout">
        <aside className="desktop-filter">
          <CatalogFilters
            key={JSON.stringify(filters)}
            categories={categories}
            collections={collections}
            filters={filters}
          />
        </aside>
        <div className="catalog-main">
          <div className="catalog-toolbar">
            <p>
              {result.count} {result.count === 1 ? "piece" : "pieces"} to
              discover
            </p>
            <div className="mobile-only">
              <CatalogFilters
                key={JSON.stringify(filters)}
                categories={categories}
                collections={collections}
                filters={filters}
                mobile
              />
            </div>
            <CatalogSort value={filters.sort || "newest"} filters={filters} />
          </div>
          {result.products.length ? (
            <div className="product-grid">
              {result.products.map((p, index) => (
                <ProductCard
                  key={p.id}
                  product={p}
                  eager={index < 3}
                  threshold={store.low_stock_threshold}
                />
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <h2>A little more to discover.</h2>
              <p>No products matched your search.</p>
              <Link className="button" href="/shop">
                Clear filters
              </Link>
            </div>
          )}
          {pages > 1 && (
            <nav className="pagination" aria-label="Catalog pages">
              {page > 1 && (
                <Link className="button outline" href={pageUrl(page - 1)}>
                  Previous
                </Link>
              )}
              <span>
                Page {page} of {pages}
              </span>
              {page < pages && (
                <Link className="button outline" href={pageUrl(page + 1)}>
                  Next
                </Link>
              )}
            </nav>
          )}
        </div>
      </div>
    </>
  );
}
