import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight } from "lucide-react";
import { getTaxonomies } from "@/lib/data";
import { imageUrl, safeJson, siteUrl } from "@/lib/utils";

export const metadata = {
  title: "Designer Collections | Achu Designer Boutique",
  description:
    "Explore curated collections of luxury Indian wear, sarees, kurtis, and festive ensembles at Achu Designer Boutique.",
  alternates: { canonical: "/collections" },
  openGraph: {
    title: "Designer Collections | Achu Designer Boutique",
    description:
      "Explore curated collections of luxury Indian wear, sarees, kurtis, and festive ensembles at Achu Designer Boutique.",
    url: `${siteUrl}/collections`,
    siteName: "Achu Designer Boutique",
    images: ["/brand/achu-designer-boutique-logo.png"],
  },
};

export default async function Collections() {
  let collections = await getTaxonomies("collections");
  if (!collections || collections.length === 0) {
    collections = await getTaxonomies("categories");
  }

  const breadcrumbsSchema = {
    "@context": "https://schema.org",
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
        name: "Collections",
        item: `${siteUrl}/collections`,
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJson(breadcrumbsSchema) }}
      />
      <div className="page-heading">
        <div className="container">
          <nav className="breadcrumbs" aria-label="Breadcrumb">
            <Link href="/">Home</Link>
            <span>/</span>
            <span aria-current="page">Collections</span>
          </nav>
          <p className="eyebrow">THE CONSIDERED EDIT</p>
          <h1>For every beautiful moment.</h1>
          <p>Explore collections with a story of their own.</p>
        </div>
      </div>
      <div className="container">
        {collections.length ? (
          <div className="collections-grid">
            {collections.map((c) => (
              <Link
                href={`/collections/${c.slug}`}
                key={c.id}
                className="collection-card category-card"
              >
                <div className="category-image">
                  <Image
                    src={imageUrl(c.image)}
                    alt={c.name}
                    fill
                    sizes="(max-width:600px)100vw,33vw"
                  />
                  <span className="round-arrow">
                    <ArrowUpRight size={19} />
                  </span>
                </div>
                <h2>{c.name}</h2>
                <p>{c.description}</p>
              </Link>
            ))}
          </div>
        ) : (
          <div className="section">
            <div className="empty-state">
              <h2>A new chapter, soon.</h2>
              <p>Our collections are being prepared.</p>
              <Link className="button" href="/">
                Return to home
              </Link>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
