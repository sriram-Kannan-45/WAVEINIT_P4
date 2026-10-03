import { notFound } from "next/navigation";
import { getTaxonomies } from "@/lib/data";
import { Catalog } from "@/components/product/catalog";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const c = (await getTaxonomies("categories")).find((c) => c.slug === slug);
  return {
    title: c?.name || "Category",
    alternates: { canonical: `/category/${slug}` },
  };
}
export default async function CategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const c = (await getTaxonomies("categories")).find((c) => c.slug === slug);
  if (!c) notFound();
  return (
    <Catalog
      filters={{ category: slug }}
      title={c.name}
      subtitle={c.description}
    />
  );
}
