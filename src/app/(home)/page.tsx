import { Instagram } from "@/components/ui/instagram";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Flower2,
  Scissors,
  MessageCircle,
  Sparkles,
  Leaf,
} from "lucide-react";
import { getHomepage, getProducts, getStore, getTaxonomies } from "@/lib/data";
import { ProductCard } from "@/components/product/card";
import { StoreDetails } from "@/components/layout/store-details";
import { imageUrl } from "@/lib/utils";
import { LuxuryHero3DBackground } from "@/components/home/LuxuryHero3DBackground";
export default async function Home() {
  const [h, store, categories, collections, arrivals, best] = await Promise.all(
    [
      getHomepage(),
      getStore(),
      getTaxonomies("categories"),
      getTaxonomies("collections"),
      getProducts({ new: "true" }, 4),
      getProducts({ best: "true" }, 4),
    ],
  );
  const featured = collections.find((c) => c.id === h.featured_collection_id);
  return (
    <>
      {h.hero_enabled && (
        <section className="hero">
          {h.hero_image && (
            <>
              <Image
                className={h.hero_mobile_image ? "hero-desktop" : ""}
                src={imageUrl(h.hero_image)}
                alt="Achu boutique Indian fashion editorial"
                fill
                priority
                sizes={
                  h.hero_mobile_image
                    ? "100vw"
                    : "(max-width: 600px) 1000px, 100vw"
                }
              />
              {h.hero_mobile_image && (
                <Image
                  className="hero-mobile"
                  src={imageUrl(h.hero_mobile_image)}
                  alt="Achu boutique Indian fashion editorial"
                  fill
                  priority
                  sizes="100vw"
                />
              )}
            </>
          )}
          <div className="hero-shade" />
          <div className="container hero-content">
            <p className="eyebrow light">
              <span />
              THE ACHU EDIT
            </p>
            <h1>
              {h.hero_heading.split("\n").map((line, i) => (
                <span key={i}>{i === 1 ? <em>{line}</em> : line}</span>
              ))}
            </h1>
            <p className="hero-description">{h.hero_subtitle}</p>
            <div className="hero-buttons">
              <Link className="button" href={h.primary_url}>
                {h.primary_text}
                <ArrowUpRight size={17} />
              </Link>
              {h.secondary_text && (
                <Link className="hero-secondary" href={h.secondary_url}>
                  {h.secondary_text}
                  <ArrowRight size={15} />
                </Link>
              )}
            </div>
            <div className="hero-footnote">
              <span className="tiny-line" />
              INDIAN ROOTS. INDIVIDUAL EXPRESSION.
            </div>
          </div>
          <div className="hero-side-label">THE ART OF DRESSING BEAUTIFULLY</div>
        </section>
      )}
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
      {h.show_categories && (
        <LuxuryHero3DBackground
          categories={categories}
          arrivals={arrivals.products}
          lowStockThreshold={store.low_stock_threshold}
          showArrivals={h.show_new_arrivals}
          featured={featured}
          featuredTitle={h.featured_title}
          featuredDescription={h.featured_description || featured?.description}
          featuredImage={h.featured_image || featured?.image}
          showFeatured={h.show_featured && !!featured}
          bestSellers={best.products}
          showBestSellers={h.show_best_sellers}
          promoImage={h.promo_image}
          promoHeading={h.promo_heading}
          promoSubtitle={h.promo_subtitle}
          promoText={h.promo_text}
          promoUrl={h.promo_url}
          showPromo={h.show_promo && !!h.promo_image}
        />
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
      {h.show_store && <StoreDetails store={store} />}
    </>
  );
}
