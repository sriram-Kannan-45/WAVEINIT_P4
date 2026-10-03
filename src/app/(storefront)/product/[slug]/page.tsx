import Link from "next/link";
import { notFound } from "next/navigation";
import { getProduct, getProducts, getStore } from "@/lib/data";
import { ProductDetail } from "@/components/product/detail";
import { ProductCard } from "@/components/product/card";
import { imageUrl, safeJson, siteUrl, stockTotal } from "@/lib/utils";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const p = await getProduct(slug);
  return {
    title: p?.meta_title || p?.name || "Product unavailable",
    description: p?.meta_description || p?.short_description,
    alternates: { canonical: `/product/${slug}` },
    openGraph: p
      ? { images: p.product_images.map((i) => imageUrl(i.storage_path)) }
      : undefined,
    robots: p?.sample ? { index: false, follow: false } : undefined,
  };
}
export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const p = await getProduct(slug);
  if (!p) notFound();
  const [store, related] = await Promise.all([
    getStore(),
    getProducts({ category: p.categories?.slug }, 5),
  ]);
  const schema = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.name,
    description: p.short_description,
    image: p.product_images.map((i) => imageUrl(i.storage_path)),
    sku: p.sku,
    brand: { "@type": "Brand", name: "Achu Designer Boutique" },
    offers: {
      "@type": "Offer",
      url: `${siteUrl}/product/${p.slug}`,
      priceCurrency: "INR",
      price: p.selling_price,
      availability:
        stockTotal(p.product_variants) > 0
          ? "https://schema.org/InStock"
          : "https://schema.org/OutOfStock",
    },
  };
  return (
    <div className="container product-page">
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <Link href="/">Home</Link>
        <span>/</span>
        <Link href={`/category/${p.categories?.slug || ""}`}>
          {p.categories?.name || "Shop"}
        </Link>
        <span>/</span>
        <span>{p.name}</span>
      </nav>
      <ProductDetail product={p} store={store} />
      {!p.sample && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: safeJson(schema) }}
        />
      )}
      {related.products.some((r) => r.id !== p.id) && (
        <section className="related-section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">ANOTHER LITTLE DISCOVERY</p>
              <h2>
                You may also <em>love.</em>
              </h2>
            </div>
          </div>
          <div className="product-grid">
            {related.products
              .filter((r) => r.id !== p.id)
              .slice(0, 4)
              .map((r) => (
                <ProductCard key={r.id} product={r} />
              ))}
          </div>
        </section>
      )}
    </div>
  );
}
