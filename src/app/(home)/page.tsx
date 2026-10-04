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
        <section className="section categories-section">
          <LuxuryHero3DBackground />
          <div className="container">
            <div className="section-heading">
              <div>
                <p className="eyebrow">FIND YOUR EXPRESSION</p>
                <h2>
                  A style for <em>every you.</em>
                </h2>
              </div>
              <Link className="text-link" href="/shop">
                Shop all pieces <ArrowUpRight size={16} />
              </Link>
            </div>
            {categories.length ? (
              <div className="category-grid">
                {categories.map((c) => (
                  <Link
                    href={`/category/${c.slug}`}
                    className="category-card"
                    key={c.id}
                  >
                    <div className="category-image">
                      <Image
                        src={imageUrl(c.image)}
                        alt={c.name}
                        fill
                        sizes="(max-width:600px) 48vw,25vw"
                      />
                      <span className="round-arrow">
                        <ArrowUpRight size={19} />
                      </span>
                    </div>
                    <h3>{c.name}</h3>
                    <p>{c.description}</p>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                Our collections are being prepared. Come back soon.
              </div>
            )}
          </div>
        </section>
      )}
      {h.show_new_arrivals && (
        <section className="section arrivals-section">
          <LuxuryHero3DBackground objectPosition="center 50%" />
          <div className="container">
            <div className="section-heading">
              <div>
                <p className="eyebrow">FRESH FROM OUR EDIT</p>
                <h2>
                  New & <em>noteworthy.</em>
                </h2>
              </div>
              <Link className="text-link" href="/shop?new=true">
                Explore new arrivals <ArrowUpRight size={16} />
              </Link>
            </div>
            {arrivals.products.length ? (
              <div className="product-grid">
                {arrivals.products.map((p) => (
                  <ProductCard
                    key={p.id}
                    product={p}
                    threshold={store.low_stock_threshold}
                  />
                ))}
              </div>
            ) : (
              <div className="empty-state">
                New pieces will be added here soon.
              </div>
            )}
          </div>
        </section>
      )}
      {h.show_featured && featured && (
        <section className="featured-section">
          <div className="featured-image">
            <Image
              src={imageUrl(h.featured_image || featured.image)}
              alt={featured.name}
              fill
              sizes="(max-width:700px)100vw,50vw"
            />
          </div>
          <div className="featured-content">
            <p className="eyebrow light">THE OCCASION EDIT</p>
            <h2>{h.featured_title}</h2>
            <div className="gold-line" />
            <p>{h.featured_description || featured.description}</p>
            <Link
              className="button gold-outline"
              href={`/collections/${featured.slug}`}
            >
              Explore the collection <ArrowUpRight size={17} />
            </Link>
            <div className="featured-decoration" aria-hidden="true">
              <Flower2 size={100} strokeWidth={0.5} />
            </div>
          </div>
        </section>
      )}
      {h.show_best_sellers && (
        <section className="section best-sellers-section">
          <LuxuryHero3DBackground objectPosition="center 36%" />
          <div className="container">
            <div className="section-heading">
              <div>
                <p className="eyebrow">THE BOUTIQUE FAVOURITES</p>
                <h2>
                  Pieces to <em>fall for.</em>
                </h2>
              </div>
              <Link className="text-link" href="/shop?best=true">
                Explore the edit <ArrowUpRight size={16} />
              </Link>
            </div>
            {best.products.length ? (
              <div className="product-grid">
                {best.products.map((p) => (
                  <ProductCard
                    key={p.id}
                    product={p}
                    threshold={store.low_stock_threshold}
                  />
                ))}
              </div>
            ) : (
              <div className="empty-state">
                Pieces will be added to favourites soon.
              </div>
            )}
          </div>
        </section>
      )}
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
      {h.show_store && <StoreDetails store={store} />}
    </>
  );
}
