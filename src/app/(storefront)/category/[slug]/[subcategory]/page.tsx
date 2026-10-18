import { notFound } from "next/navigation";
import Link from "next/link";
import { getTaxonomies, getSubcategory } from "@/lib/data";
import { Catalog } from "@/components/product/catalog";
import { imageUrl, safeJson, siteUrl } from "@/lib/utils";

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
  const title = sub
    ? `${sub.name} — ${c?.name || "Designer Wear"} | Achu Designer Boutique`
    : "Subcategory | Achu Designer Boutique";
  const description = sub?.description
    ? `${sub.description} Shop ${sub.name.toLowerCase()} in ${c?.name || "designer wear"} online at Achu Designer Boutique.`
    : `Handcrafted ${sub?.name || "designs"} in ${c?.name || "collection"} at Achu Designer Boutique. Buy sarees, kurtis, and ethnic wear online.`;
  const heroImgSrc = sub?.image
    ? imageUrl(sub.image)
    : `${siteUrl}/brand/achu-designer-boutique-logo.png`;

  return {
    title,
    description,
    alternates: { canonical: `/category/${slug}/${subSlug}` },
    openGraph: {
      title,
      description,
      url: `${siteUrl}/category/${slug}/${subSlug}`,
      siteName: "Achu Designer Boutique",
      type: "website",
      images: [
        {
          url: heroImgSrc,
          alt: `${sub?.name || "Subcategory"} Collection`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [heroImgSrc],
    },
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

  const subcategorySchema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Home",
            item: siteUrl,
          },
          {
            "@type": "ListItem",
            position: 2,
            name: c.name,
            item: `${siteUrl}/category/${slug}`,
          },
          {
            "@type": "ListItem",
            position: 3,
            name: sub.name,
            item: `${siteUrl}/category/${slug}/${subSlug}`,
          },
        ],
      },
      {
        "@type": "CollectionPage",
        "@id": `${siteUrl}/category/${slug}/${subSlug}`,
        name: `${sub.name} - ${c.name} | Achu Designer Boutique`,
        description:
          sub.description ||
          `Handcrafted ${sub.name} in ${c.name} at Achu Designer Boutique`,
        url: `${siteUrl}/category/${slug}/${subSlug}`,
        isPartOf: {
          "@type": "WebSite",
          "@id": `${siteUrl}/#website`,
          name: "Achu Designer Boutique",
        },
      },
    ],
  };

  return (
    <div className="subcategory-product-page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJson(subcategorySchema) }}
      />
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
