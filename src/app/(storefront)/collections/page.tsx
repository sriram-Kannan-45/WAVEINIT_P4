import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight } from "lucide-react";
import { getTaxonomies } from "@/lib/data";
import { imageUrl } from "@/lib/utils";
export const metadata = {
  title: "Collections",
  alternates: { canonical: "/collections" },
};
export default async function Collections() {
  const collections = await getTaxonomies("collections");
  return (
    <>
      <div className="page-heading">
        <div className="container">
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
              <Link className="button" href="/shop">
                Explore all pieces
              </Link>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
