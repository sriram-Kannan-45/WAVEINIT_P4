import { Instagram } from "@/components/ui/instagram";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowUpRight,
  Flower2,
  Scissors,
  MessageCircle,
  Sparkles,
  Leaf,
} from "lucide-react";
import { getHomepage, getStore, getTaxonomies, getNewArrivals } from "@/lib/data";
import { ProductCard } from "@/components/product/card";
import { imageUrl } from "@/lib/utils";
import { LuxuryHero3DBackground } from "@/components/home/LuxuryHero3DBackground";
import { OptimizedImage } from "@/components/ui/optimized-image";

const CATEGORY_DEFAULT_IMAGES: Record<string, string> = {
  sarees: "/pic/Elegant Emerald Green Saree Portrait.webp",
  kurtis: "/pic/Elegant Navy Indian Ensemble.webp",
  "designer-wear": "/pic/Lavender Embroidered Anarkali Portrait.webp",
  "occasion-wear": "/pic/Maroon Embroidered Anarkali Portrait.webp",
  "demo-2": "/pic/Elegant Ivory Embroidered Anarkali Portrait.webp",
};

export default async function Home() {
  const [h, store, categories, arrivals] = await Promise.all([
    getHomepage(),
    getStore(),
    getTaxonomies("categories"),
    getNewArrivals(4),
  ]);
  return (
    <>
      {h.show_categories && categories.length > 0 && (
        <section className="section categories-section">
          <div className="container">
            <div className="section-heading">
              <div>
                <p className="eyebrow">CURATED COLLECTIONS</p>
                <h2>
                  The Boutique <em>Categories.</em>
                </h2>
              </div>
              <Link className="text-link" href="/collections">
                Explore all collections <ArrowUpRight size={16} />
              </Link>
            </div>
            <div className="category-grid category-circle-grid" role="list">
              {categories.map((c) => {
                const fallbackImg =
                  CATEGORY_DEFAULT_IMAGES[c.slug] ||
                  "/pic/Elegant Emerald Green Saree Portrait.webp";
                const catImgSrc = c.image || fallbackImg;
                return (
                  <Link
                    href={`/category/${c.slug}`}
                    className="category-card category-circle-card"
                    key={c.id}
                    role="listitem"
                    aria-label={`Browse ${c.name} collection`}
                  >
                    <div className="category-circle-thumb-wrapper">
                      <div className="category-circle-thumb">
                        <OptimizedImage
                          src={catImgSrc}
                          fallbackSrc={fallbackImg}
                          alt={c.name}
                          fill
                          priority
                          sizes="(max-width: 600px) 150px, 180px"
                        />
                      </div>
                      <span className="round-arrow category-circle-badge">
                        <ArrowUpRight size={17} />
                      </span>
                    </div>
                    <h3>{c.name}</h3>
                    <p>{c.description}</p>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      )}
      {h.show_new_arrivals && arrivals.length > 0 && (
        <section className="section arrivals-section">
          <div className="container">
            <div className="section-heading">
              <div>
                <p className="eyebrow">FRESH FROM OUR EDIT</p>
                <h2 aria-label="New & noteworthy.">
                  New & <em>noteworthy.</em>
                </h2>
              </div>
              <Link className="text-link" href="/shop?new=true">
                Explore new arrivals <ArrowUpRight size={16} />
              </Link>
            </div>
            <div className="product-grid">
              {arrivals.map((p) => (
                <ProductCard
                  key={p.id}
                  product={p}
                  threshold={store.low_stock_threshold}
                />
              ))}
            </div>
          </div>
        </section>
      )}
      <LuxuryHero3DBackground
        categories={categories}
        arrivals={arrivals}
        lowStockThreshold={store.low_stock_threshold}
      />
      <div className="brand-strip">
        <span>
          <Flower2 size={18} />
          Thoughtfully curated
        </span>
        <i />
        <span>
          <Scissors size={18} />A love for the details
        </span>
        <i />
        <span>
          <MessageCircle size={18} />
          Personal assistance
        </span>
        <i />
        <span>
          <Leaf size={18} />
          Rooted in Indian elegance
        </span>
      </div>

      {h.show_promo && h.promo_image && (
        <section className="promo container">
          <Image
            src={imageUrl(h.promo_image)}
            alt={h.promo_heading}
            fill
            sizes="(max-width: 600px) 700px, 90vw"
          />
          <div className="hero-shade" />
          <div>
            <p className="eyebrow light">A MOMENT TO MAKE YOUR OWN</p>
            <h2>{h.promo_heading}</h2>
            <p>{h.promo_subtitle}</p>
            <Link className="button gold-outline" href={h.promo_url}>
              {h.promo_text}
              <ArrowUpRight size={16} />
            </Link>
          </div>
        </section>
      )}
      <section className="section why-section">
        <div className="container">
          <p className="eyebrow">THE ACHU PROMISE</p>
          <h2>
            A thoughtful touch, <em>at every step.</em>
          </h2>
          <div className="why-grid">
            {[
              [
                Sparkles,
                "Curated collections",
                "A considered edit of Indian designer wear.",
              ],
              [
                Scissors,
                "Attention to fabric",
                "Discover the texture and details of every piece.",
              ],
              [
                Flower2,
                "Personal assistance",
                "Let us help you find what feels right for you.",
              ],
              [
                MessageCircle,
                "Simply WhatsApp",
                "Choose your favourites. Start a conversation.",
              ],
            ].map(([Icon, title, desc]) => {
              const I = Icon as typeof Sparkles;
              return (
                <div key={String(title)}>
                  <I size={28} strokeWidth={1} />
                  <h3>{String(title)}</h3>
                  <p>{String(desc)}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>
      {h.show_instagram && store.instagram_url && (
        <section className="instagram-section">
          <Instagram size={26} strokeWidth={1} />
          <p className="eyebrow">A LITTLE INSPIRATION, EVERY DAY</p>
          <h2>
            Follow the <em>Achu story.</em>
          </h2>
          <a
            className="text-link"
            href={store.instagram_url}
            target="_blank"
            rel="noopener noreferrer"
          >
            Find us on Instagram <ArrowUpRight size={16} />
          </a>
        </section>
      )}
    </>
  );
}
