import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight } from "lucide-react";
import { getTaxonomies, getSubcategories } from "@/lib/data";
import { Catalog } from "@/components/product/catalog";
import { imageUrl } from "@/lib/utils";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const c = (await getTaxonomies("categories")).find((c) => c.slug === slug);
  return {
    title: c ? `${c.name} | Achu Designer Boutique` : "Category",
    description:
      c?.description ||
      `Explore luxury handcrafted ${c?.name || "designs"} at Achu Designer Boutique.`,
    alternates: { canonical: `/category/${slug}` },
  };
}

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { slug } = await params;
  const filters = await searchParams;
  const [categories, subcategories] = await Promise.all([
    getTaxonomies("categories"),
    getSubcategories(slug),
  ]);
  const c = categories.find((cat) => cat.slug === slug);
  if (!c) notFound();

  return (
    <div className="category-detail-page">
      <div className="container">
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <Link href="/">Home</Link>
          <span>/</span>
          <span aria-current="page">{c.name}</span>
        </nav>

        <header className="category-hero-banner">
          <div className="category-hero-content">
            <p className="eyebrow">CURATED CATEGORY</p>
            <h1>{c.name}</h1>
            {c.description && (
              <p className="category-hero-desc">{c.description}</p>
            )}
          </div>
          {c.image && (
            <div className="category-hero-media">
              <Image
                src={imageUrl(c.image)}
                alt={c.name}
                fill
                priority
                sizes="(max-width: 768px) 100vw, 320px"
              />
            </div>
          )}
        </header>

        {subcategories.length > 0 && (
          <section className="category-subcategories-section">
            <div className="section-heading">
              <div>
                <p className="eyebrow">EXPLORE BY STYLE</p>
                <h2>
                  {c.name} <em>Subcategories.</em>
                </h2>
              </div>
            </div>
            <div className="subcategory-circle-grid" role="list">
              {subcategories.map((sub) => (
                <Link
                  href={`/category/${slug}/${sub.slug}`}
                  key={sub.id}
                  className="subcategory-circle-card"
                  role="listitem"
                  aria-label={`Explore ${sub.name}`}
                >
                  <div className="subcategory-circle-thumb-wrapper">
                    <div className="subcategory-circle-thumb">
                      <Image
                        src={imageUrl(sub.image || c.image)}
                        alt={sub.name}
                        fill
                        sizes="(max-width: 600px) 130px, 160px"
                      />
                    </div>
                    <span className="subcategory-circle-badge">
                      <ArrowUpRight size={15} />
                    </span>
                  </div>
                  <h3>{sub.name}</h3>
                  {sub.description && <p>{sub.description}</p>}
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>

      <Catalog
        filters={{ ...filters, category: slug }}
        title={`All ${c.name} Designs`}
        subtitle={`Discover handcrafted ${c.name.toLowerCase()} tailored for timeless elegance.`}
      />
    </div>
  );
}
