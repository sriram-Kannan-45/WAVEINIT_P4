import { Catalog } from "@/components/product/catalog";
import type { CatalogFilter } from "@/lib/data";
export const metadata = {
  title: "Shop Sarees, Kurtis & Designer Wear | Achu Designer Boutique",
  description:
    "Discover our full edit of handcrafted Indian ethnic wear. Browse sarees, designer kurtis, occasion ensembles, and bridal designs online.",
  alternates: { canonical: "/shop" },
};
export default async function Shop({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const filters: CatalogFilter = {};
  for (const key of [
    "q",
    "category",
    "collection",
    "size",
    "min",
    "max",
    "availability",
    "sort",
    "new",
    "best",
    "page",
  ] as const) {
    const v = raw[key];
    if (typeof v === "string" && v.length <= 200) filters[key] = v;
  }
  for (const key of ["min", "max", "page"] as const)
    if (
      filters[key] &&
      (!Number.isFinite(Number(filters[key])) || Number(filters[key]) < 0)
    )
      delete filters[key];
  return (
    <Catalog
      filters={filters}
      title={
        filters.new
          ? "New & noteworthy"
          : filters.best
            ? "The boutique favourites"
            : undefined
      }
    />
  );
}
