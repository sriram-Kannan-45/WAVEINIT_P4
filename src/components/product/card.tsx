import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { Product } from "@/types";
import { imageUrl, money, stockTotal } from "@/lib/utils";
export function ProductCard({
  product: p,
  threshold = 3,
  eager = false,
}: {
  product: Product;
  threshold?: number;
  eager?: boolean;
}) {
  const stock = stockTotal(p.product_variants);
  const images = [...p.product_images].sort(
    (a, b) =>
      Number(b.is_cover) - Number(a.is_cover) || a.sort_order - b.sort_order,
  );
  const discount =
    p.original_price && p.original_price > p.selling_price
      ? Math.round(
          ((p.original_price - p.selling_price) / p.original_price) * 100,
        )
      : 0;
  return (
    <article className="product-card">
      <Link
        className="product-image"
        href={`/product/${p.slug}`}
        aria-label={`View ${p.name}`}
      >
        <Image
          src={imageUrl(images[0]?.storage_path || "")}
          alt={images[0]?.alt_text || p.name}
          fill
          loading={eager ? "eager" : "lazy"}
          sizes="(max-width: 600px) 48vw, (max-width: 1000px) 32vw, 25vw"
        />
        {images[1] && (
          <Image
            className="second-image"
            src={imageUrl(images[1].storage_path)}
            alt={images[1].alt_text || p.name}
            fill
            loading="lazy"
            sizes="(max-width: 600px) 48vw, (max-width: 1000px) 32vw, 25vw"
          />
        )}
        <span className={`product-badge ${!stock ? "sold-out" : ""}`}>
          {p.sample
            ? "PREVIEW"
            : !stock
              ? "OUT OF STOCK"
              : stock <= threshold
                ? `ONLY ${stock} LEFT`
                : p.is_new_arrival
                  ? "NEW"
                  : p.is_best_seller
                    ? "BEST SELLER"
                    : discount
                      ? "SALE"
                      : ""}
        </span>
        <span className="product-hover">
          Discover the piece <ArrowUpRight size={16} />
        </span>
      </Link>
      <div className="product-info">
        <span className="product-category">
          {p.categories?.name || "The Achu edit"}
        </span>
        <Link href={`/product/${p.slug}`}>
          <h3>{p.name}</h3>
        </Link>
        <div className="product-price">
          <span>{money(p.selling_price)}</span>
          {discount > 0 && (
            <>
              <del>{money(p.original_price!)}</del>
              <small>{discount}% OFF</small>
            </>
          )}
        </div>
        <p className="product-sizes">
          {stock
            ? p.product_variants
                .filter((v) => v.active && v.stock_quantity > 0)
                .map((v) => v.size)
                .join(" · ")
            : "Currently unavailable"}
        </p>
      </div>
    </article>
  );
}
