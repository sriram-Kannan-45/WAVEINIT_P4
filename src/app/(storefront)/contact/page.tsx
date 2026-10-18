import { Metadata } from "next";
import { getStore } from "@/lib/data";
import { whatsappUrl } from "@/lib/whatsapp";
import { Instagram } from "@/components/ui/instagram";
import { safeJson, siteUrl } from "@/lib/utils";
import {
  Phone,
  MessageCircle,
  MapPin,
  Compass,
  Sparkles,
  Scissors,
  Shirt,
  Layers,
  Flower2,
  Gem,
  CheckCircle2,
  ArrowUpRight,
  ExternalLink,
  ShieldCheck,
  Flame,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Contact Us & Visit Studio | Achu Designer Boutique",
  description:
    "Visit Achu Designer Boutique at PMS Complex, Diamond Nagar, Near MDS Bakery, Thindal. Explore sarees, salwar suits, chudi, tops, leggings, kurties, co-ords, and customized stitching. Call or WhatsApp +91 96296 60022.",
  alternates: { canonical: "/contact" },
};

const OFFICIAL_PHONE = "919629660022";
const FORMATTED_PHONE = "+91 96296 60022";
const OFFICIAL_ADDRESS =
  "PMS Complex, Diamond Nagar, Near MDS Bakery, Thindal.";
const MAPS_SEARCH_URL =
  "https://www.google.com/maps/search/?api=1&query=PMS+Complex,+Diamond+Nagar,+Near+MDS+Bakery,+Thindal";
const MAPS_EMBED_URL =
  "https://maps.google.com/maps?q=PMS+Complex,+Diamond+Nagar,+Near+MDS+Bakery,+Thindal&t=&z=15&ie=UTF8&iwloc=&output=embed";

interface ServiceItem {
  title: string;
  badge: string;
  description: string;
  icon: typeof Sparkles;
  isFeatured?: boolean;
}

const BOUTIQUE_SERVICES: ServiceItem[] = [
  {
    title: "Sarees",
    badge: "Bridal & Occasion",
    description:
      "Handcrafted festive drapes, bridal silks, banarasi weaves, and designer sarees chosen for timeless Indian elegance.",
    icon: Sparkles,
  },
  {
    title: "Salwar Suits",
    badge: "Festive & Daily",
    description:
      "Gracefully tailored designer suits, unstitched dress materials, and ready-to-wear silhouettes with exquisite border detailing.",
    icon: Shirt,
  },
  {
    title: "Chudi",
    badge: "Classic Silhouette",
    description:
      "Traditional and contemporary churidar sets tailored for unmatched comfort, flattering falls, and everyday grace.",
    icon: Layers,
  },
  {
    title: "Tops",
    badge: "Modern Fusion",
    description:
      "Contemporary everyday tops, fusion tunics, and stylish designer blouses crafted for effortless pairing.",
    icon: Flame,
  },
  {
    title: "Leggings",
    badge: "Everyday Comfort",
    description:
      "Premium quality, breathable 4-way stretch leggings available in a curated spectrum of coordinating boutique colors.",
    icon: CheckCircle2,
  },
  {
    title: "Kurties",
    badge: "Artisanal Edit",
    description:
      "Distinctive cuts, handcrafted necklines, delicate embroideries, and pure fabrics designed for work, festivities, and casual luxury.",
    icon: Flower2,
  },
  {
    title: "Co-ord Sets",
    badge: "Contemporary Trend",
    description:
      "Trendsetting matched two-piece designer ensembles offering sophisticated ease for celebratory brunches and events.",
    icon: Gem,
  },
  {
    title: "Customized Stitching",
    badge: "Bespoke Studio Service",
    description:
      "Master-tailored bridal blouse stitching, made-to-measure alterations, custom lining, and bespoke garment construction tailored to your exact fit.",
    icon: Scissors,
    isFeatured: true,
  },
];

export default async function ContactPage() {
  const store = await getStore();

  const phoneNumber = store.phone_number || OFFICIAL_PHONE;
  const whatsappNumber = store.whatsapp_number || OFFICIAL_PHONE;
  const address = store.address || OFFICIAL_ADDRESS;
  const mapsUrl = store.maps_url || MAPS_SEARCH_URL;
  const mapEmbedUrl = store.map_embed_url || MAPS_EMBED_URL;
  const instagramUrl = store.instagram_url?.trim() || "";

  const contactSchema = {
    "@context": "https://schema.org",
    "@type": ["ClothingStore", "LocalBusiness"],
    "@id": `${siteUrl}/contact#store`,
    name: "Achu Designer Boutique",
    alternateName: ["Achu Boutique", "Achu Designer Wear"],
    image: `${siteUrl}/brand/achu-designer-boutique-logo.png`,
    logo: `${siteUrl}/brand/achu-designer-boutique-logo.png`,
    telephone: store.phone_number || store.whatsapp_number || `+${OFFICIAL_PHONE}`,
    email: store.email || undefined,
    url: `${siteUrl}/contact`,
    hasMap: MAPS_SEARCH_URL,
    priceRange: "₹₹",
    currenciesAccepted: "INR",
    paymentAccepted: "Cash, UPI, Credit Card, Net Banking",
    address: {
      "@type": "PostalAddress",
      streetAddress: address,
      addressLocality: "Erode",
      addressRegion: "Tamil Nadu",
      postalCode: "638012",
      addressCountry: "IN",
    },
    geo: {
      "@type": "GeoCoordinates",
      latitude: "11.3175",
      longitude: "77.6833",
    },
    sameAs: [store.instagram_url, MAPS_SEARCH_URL].filter(Boolean),
  };

  const generalWhatsappLink =
    whatsappUrl(
      whatsappNumber,
      "Hi Achu Designer Boutique, I would like to enquire about your boutique collections and services.",
    ) || `https://wa.me/${whatsappNumber}`;

  return (
    <div className="contact-page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJson(contactSchema) }}
      />
      {/* 1. Hero Header */}
      <section className="contact-hero container">
        <p className="eyebrow">Achu Designer Boutique • Thindal</p>
        <h1>
          Visit Our Studio &amp; <em>Boutique</em>
        </h1>
        <p>
          Experience personalized styling, handcrafted festive wear, and
          bespoke customized stitching at our Thindal studio. We look forward
          to welcoming you.
        </p>

        {/* 2. Primary Quick Action Bar */}
        <div className="contact-actions-bar">
          <a
            href={`tel:+${phoneNumber}`}
            className="contact-action-btn primary-call"
            aria-label={`Call Achu Designer Boutique at ${FORMATTED_PHONE}`}
          >
            <div className="action-icon">
              <Phone size={20} />
            </div>
            <div className="action-text">
              <span className="action-title">Call Now</span>
              <span className="action-subtitle">{FORMATTED_PHONE}</span>
            </div>
          </a>

          <a
            href={generalWhatsappLink}
            target="_blank"
            rel="noopener noreferrer"
            className="contact-action-btn primary-whatsapp"
            aria-label="Chat with Achu Designer Boutique on WhatsApp"
          >
            <div className="action-icon">
              <MessageCircle size={20} />
            </div>
            <div className="action-text">
              <span className="action-title">WhatsApp Us</span>
              <span className="action-subtitle">Instant Styling Enquiry</span>
            </div>
          </a>

          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="contact-action-btn"
            aria-label="Get directions to Achu Designer Boutique on Google Maps"
          >
            <div className="action-icon">
              <Compass size={20} />
            </div>
            <div className="action-text">
              <span className="action-title">Get Directions</span>
              <span className="action-subtitle">Open in Google Maps</span>
            </div>
          </a>

          {instagramUrl ? (
            <a
              href={instagramUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="contact-action-btn"
              aria-label="Follow Achu Designer Boutique on Instagram"
            >
              <div className="action-icon">
                <Instagram size={20} />
              </div>
              <div className="action-text">
                <span className="action-title">Instagram</span>
                <span className="action-subtitle">Follow Our Edits</span>
              </div>
            </a>
          ) : (
            <div
              className="contact-action-btn opacity-70"
              style={{ cursor: "default" }}
              aria-label="Instagram handle available soon"
            >
              <div className="action-icon">
                <Instagram size={20} />
              </div>
              <div className="action-text">
                <span className="action-title">Instagram</span>
                <span className="action-subtitle">Connect on WhatsApp</span>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* 3. Studio Information & Interactive Location Map */}
      <section className="container">
        <div className="contact-hub-grid">
          {/* Left: Studio Card */}
          <div className="boutique-card">
            <div>
              <div className="boutique-card-header">
                <span className="card-tag">
                  <ShieldCheck size={14} /> Official Boutique Studio
                </span>
                <h2>{store.business_name || "Achu Designer Boutique"}</h2>
                <p>
                  Visit us in person to explore our fabric touch-and-feel,
                  get custom measurements taken, or pick up ready orders.
                </p>
              </div>

              <div className="boutique-info-list">
                <div className="boutique-info-item">
                  <div className="info-icon">
                    <MapPin size={18} />
                  </div>
                  <div>
                    <div className="info-label">Studio Address</div>
                    <div className="info-val">{address}</div>
                  </div>
                </div>

                <div className="boutique-info-item">
                  <div className="info-icon">
                    <Compass size={18} />
                  </div>
                  <div>
                    <div className="info-label">Landmark</div>
                    <div className="info-val">
                      Near MDS Bakery, Diamond Nagar, Thindal, Erode.
                    </div>
                  </div>
                </div>

                <div className="boutique-info-item">
                  <div className="info-icon">
                    <Phone size={18} />
                  </div>
                  <div>
                    <div className="info-label">Direct Telephone</div>
                    <a
                      href={`tel:+${phoneNumber}`}
                      className="info-val"
                      aria-label={`Call ${FORMATTED_PHONE}`}
                    >
                      {FORMATTED_PHONE}
                    </a>
                  </div>
                </div>

                <div className="boutique-info-item">
                  <div className="info-icon">
                    <MessageCircle size={18} />
                  </div>
                  <div>
                    <div className="info-label">WhatsApp Consultation</div>
                    <a
                      href={generalWhatsappLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="info-val"
                      aria-label="Chat with Achu on WhatsApp"
                    >
                      {FORMATTED_PHONE} • Click to Chat
                    </a>
                  </div>
                </div>
              </div>
            </div>

            <div className="boutique-buttons-group">
              <a
                href={`tel:+${phoneNumber}`}
                className="button"
                aria-label={`Call ${FORMATTED_PHONE}`}
              >
                <Phone size={15} /> Call Now
              </a>
              <a
                href={generalWhatsappLink}
                target="_blank"
                rel="noopener noreferrer"
                className="button outline"
                aria-label="WhatsApp Achu Designer Boutique"
              >
                <MessageCircle size={15} /> WhatsApp Us
              </a>
              <a
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="button outline"
                aria-label="Get directions on Google Maps"
              >
                <Compass size={15} /> Get Directions <ArrowUpRight size={14} />
              </a>
            </div>
          </div>

          {/* Right: Verified Interactive Google Map */}
          <div className="contact-map-card">
            <div className="contact-map-frame">
              <iframe
                src={mapEmbedUrl}
                title="Achu Designer Boutique location map at PMS Complex, Diamond Nagar, Near MDS Bakery, Thindal"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                allowFullScreen
              />
            </div>
            <div className="contact-map-footer">
              <div className="location-summary">
                <strong>PMS Complex, Diamond Nagar</strong>
                <span>Near MDS Bakery, Thindal</span>
              </div>
              <a
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="button outline"
                style={{ padding: "8px 16px", fontSize: 13 }}
                aria-label="Open boutique in Google Maps"
              >
                Open in Maps <ExternalLink size={14} />
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Boutique Services Showcase */}
      <section className="services-section container">
        <div className="services-header">
          <p className="eyebrow">Our Boutique Services</p>
          <h2>Curated Collections &amp; Customized Stitching</h2>
          <p>
            Whether you’re seeking a bespoke bridal blouse or an everyday chic
            co-ord set, discover our full spectrum of boutique offerings.
          </p>
        </div>

        <div className="services-grid">
          {BOUTIQUE_SERVICES.map((service) => {
            const Icon = service.icon;
            const serviceWhatsappLink =
              whatsappUrl(
                whatsappNumber,
                `Hi Achu Designer Boutique, I am interested in your ${service.title} services. Could you please share more details?`,
              ) || generalWhatsappLink;

            return (
              <div
                key={service.title}
                className={`service-card ${service.isFeatured ? "is-featured" : ""}`}
              >
                <div>
                  <div className="service-card-top">
                    <div className="service-icon-box">
                      <Icon size={22} strokeWidth={1.5} />
                    </div>
                    <span className="service-badge">{service.badge}</span>
                    <h3>{service.title}</h3>
                  </div>
                  <p>{service.description}</p>
                </div>

                <a
                  href={serviceWhatsappLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="service-action-link"
                  aria-label={`Enquire about ${service.title} on WhatsApp`}
                >
                  <MessageCircle size={14} />
                  Enquire on WhatsApp
                  <ArrowUpRight size={13} />
                </a>
              </div>
            );
          })}
        </div>

        {/* 5. Consultation & Customized Stitching Banner */}
        <div className="contact-consultation-banner">
          <div className="consultation-text">
            <h3>Need Bespoke Customized Stitching?</h3>
            <p>
              From intricate bridal embroidery and made-to-measure designer
              blouse tailoring to personalized festive outfits, our master
              craftspeople ensure the perfect fit for your special day.
            </p>
          </div>
          <div className="consultation-buttons">
            <a
              href={
                whatsappUrl(
                  whatsappNumber,
                  "Hi Achu Designer Boutique, I would like to book a consultation for Customized Stitching.",
                ) || generalWhatsappLink
              }
              target="_blank"
              rel="noopener noreferrer"
              className="button white"
              aria-label="Enquire about Customized Stitching on WhatsApp"
            >
              <MessageCircle size={16} /> Book on WhatsApp
            </a>
            <a
              href={`tel:+${phoneNumber}`}
              className="button gold-outline"
              aria-label={`Call ${FORMATTED_PHONE}`}
            >
              <Phone size={16} /> Call {FORMATTED_PHONE}
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
