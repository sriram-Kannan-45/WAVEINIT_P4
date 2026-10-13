import { notFound } from "next/navigation";
import Link from "next/link";
import { getTaxonomies, getSubcategory } from "@/lib/data";
import { Catalog } from "@/components/product/catalog";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; subcategory: string }>;
}) {
  const { slug, subcategory: subSlug } = await params;
  const [categories, sub] = await Promise.all([
    getTaxonomies("categories"),
    getSubcategory(slug, subSlug),
  ]);
  const c = categories.find((cat) => cat.slug === slug);
  return {
    title: sub
      ? `${sub.name} - ${c?.name || "Collection"} | Achu Designer Boutique`
      : "Subcategory",
    description:
      sub?.description ||
      `Handcrafted ${sub?.name || "designs"} in ${c?.name || "collection"} at Achu Designer Boutique.`,
    alternates: { canonical: `/category/${slug}/${subSlug}` },
  };
}

export default async function SubcategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; subcategory: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { slug, subcategory: subSlug } = await params;
  const filters = await searchParams;
  const [categories, sub] = await Promise.all([
    getTaxonomies("categories"),
    getSubcategory(slug, subSlug),
  ]);
  const c = categories.find((cat) => cat.slug === slug);
  if (!c || !sub) notFound();

  return (
    <div className="subcategory-product-page">
      <div className="container">
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <Link href="/">Home</Link>
          <span>/</span>
          <Link href={`/category/${slug}`}>{c.name}</Link>
          <span>/</span>
          <span aria-current="page">{sub.name}</span>
        </nav>
      </div>

      <Catalog
        filters={{ ...filters, category: slug, subcategory: subSlug }}
        title={sub.name}
        subtitle={
          sub.description ||
          `Explore our handcrafted edit of ${sub.name.toLowerCase()} in ${c.name.toLowerCase()}.`
        }
      />
    </div>
  );
}
