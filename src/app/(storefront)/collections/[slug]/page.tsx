import { notFound } from "next/navigation";
import { getTaxonomies } from "@/lib/data";
import { Catalog } from "@/components/product/catalog";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const c = (await getTaxonomies("collections")).find((c) => c.slug === slug);
  return {
    title: c?.name || "Collection",
    alternates: { canonical: `/collections/${slug}` },
  };
}
export default async function CollectionPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const c = (await getTaxonomies("collections")).find((c) => c.slug === slug);
  if (!c) notFound();
  return (
    <Catalog
      filters={{ collection: slug }}
      title={c.name}
      subtitle={c.description}
    />
  );
}
