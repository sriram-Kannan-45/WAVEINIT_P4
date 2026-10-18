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
  const title = p?.meta_title || (p ? `${p.name} | Achu Designer Boutique` : "Product unavailable");
  const description =
    p?.meta_description ||
    p?.short_description ||
    (p ? `Discover ${p.name} at Achu Designer Boutique. Handcrafted luxury Indian wear.` : "Product details.");
  const images = p?.product_images?.length
    ? p.product_images.map((i) => ({
        url: imageUrl(i.storage_path),
        alt: i.alt_text || p.name,
      }))
    : [{ url: `${siteUrl}/brand/achu-designer-boutique-logo.png`, alt: "Achu Designer Boutique" }];

  return {
    title,
    description,
    alternates: { canonical: `/product/${slug}` },
    openGraph: p
      ? {
          title,
          description,
          url: `${siteUrl}/product/${slug}`,
          siteName: "Achu Designer Boutique",
          type: "website",
          images,
        }
      : undefined,
    twitter: p
      ? {
          card: "summary_large_image",
          title,
          description,
          images: images.map((img) => img.url),
        }
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

  const breadcrumbItems = [
    {
      "@type": "ListItem",
      position: 1,
      name: "Home",
      item: siteUrl,
    },
  ];
  if (p.categories?.slug) {
    breadcrumbItems.push({
      "@type": "ListItem",
      position: breadcrumbItems.length + 1,
      name: p.categories.name,
      item: `${siteUrl}/category/${p.categories.slug}`,
    });
  }
  if (p.categories?.slug && p.subcategories?.slug) {
    breadcrumbItems.push({
      "@type": "ListItem",
      position: breadcrumbItems.length + 1,
      name: p.subcategories.name,
      item: `${siteUrl}/category/${p.categories.slug}/${p.subcategories.slug}`,
    });
  }
  breadcrumbItems.push({
    "@type": "ListItem",
    position: breadcrumbItems.length + 1,
    name: p.name,
    item: `${siteUrl}/product/${p.slug}`,
  });

  const schema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Product",
        "@id": `${siteUrl}/product/${p.slug}#product`,
        name: p.name,
        description: p.short_description || p.description,
        image: p.product_images.map((i) => imageUrl(i.storage_path)),
        sku: p.sku || `ACHU-${p.id}`,
        mpn: p.sku || `ACHU-${p.id}`,
        brand: {
          "@type": "Brand",
          name: "Achu Designer Boutique",
        },
        category: p.categories?.name,
        material: p.fabric || undefined,
        color: p.colour || undefined,
        offers: {
          "@type": "Offer",
          url: `${siteUrl}/product/${p.slug}`,
          priceCurrency: "INR",
          priceValidUntil: new Date(
            new Date(p.updated_at || p.created_at || "2026-10-01").getTime() +
              60 * 24 * 60 * 60 * 1000,
          )
            .toISOString()
            .split("T")[0],
          itemCondition: "https://schema.org/NewCondition",
          availability:
            stockTotal(p.product_variants) > 0
              ? "https://schema.org/InStock"
              : "https://schema.org/OutOfStock",
          seller: {
            "@type": "Organization",
            name: "Achu Designer Boutique",
          },
        },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: breadcrumbItems,
      },
    ],
  };
  return (
    <div className="container product-page">
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <Link href="/">Home</Link>
        <span>/</span>
        <Link href={`/category/${p.categories?.slug || ""}`}>
          {p.categories?.name || "Collections"}
        </Link>
        {p.subcategories && p.categories?.slug && (
          <>
            <span>/</span>
            <Link href={`/category/${p.categories.slug}/${p.subcategories.slug}`}>
              {p.subcategories.name}
            </Link>
          </>
        )}
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
