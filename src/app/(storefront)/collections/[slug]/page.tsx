import { notFound } from "next/navigation";
import Link from "next/link";
import { getTaxonomies, type CatalogFilter } from "@/lib/data";
import { Catalog } from "@/components/product/catalog";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [collections, categories] = await Promise.all([
    getTaxonomies("collections"),
    getTaxonomies("categories"),
  ]);
  const c =
    collections.find((item) => item.slug === slug) ||
    categories.find((item) => item.slug === slug);
  return {
    title: c ? `${c.name} | Achu Designer Boutique` : "Collection",
    description: c?.description || "Explore curated pieces with a story of their own.",
    alternates: { canonical: `/collections/${slug}` },
  };
}

export default async function CollectionPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const rawParams = searchParams ? await searchParams : {};
  const [collections, categories] = await Promise.all([
    getTaxonomies("collections"),
    getTaxonomies("categories"),
  ]);
  const c =
    collections.find((item) => item.slug === slug) ||
    categories.find((item) => item.slug === slug);
  if (!c) notFound();

  const filters: CatalogFilter = { collection: slug };
  for (const key of [
    "q",
    "size",
    "min",
    "max",
    "availability",
    "sort",
    "new",
    "best",
    "page",
  ] as const) {
    const v = rawParams[key];
    if (typeof v === "string" && v.length <= 200) filters[key] = v;
  }
  for (const key of ["min", "max", "page"] as const) {
    if (
      filters[key] &&
      (!Number.isFinite(Number(filters[key])) || Number(filters[key]) < 0)
    ) {
      delete filters[key];
    }
  }

  return (
    <>
      <div className="container" style={{ paddingTop: "20px" }}>
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <Link href="/">Home</Link>
          <span>/</span>
          <Link href="/collections">Collections</Link>
          <span>/</span>
          <span aria-current="page">{c.name}</span>
        </nav>
      </div>
      <Catalog
        filters={filters}
        title={c.name}
        subtitle={c.description}
      />
    </>
  );
}
