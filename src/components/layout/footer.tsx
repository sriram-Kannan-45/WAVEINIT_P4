import { Instagram } from "@/components/ui/instagram";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, MessageCircle, Phone, MapPin } from "lucide-react";
import type { StoreSettings } from "@/types";
import { whatsappUrl } from "@/lib/whatsapp";
export function Footer({ store }: { store: StoreSettings }) {
  return (
    <footer className="site-footer">
      <div className="container footer-grid">
        <div className="footer-brand">
          <Image
            src="/brand/achu-designer-boutique-logo.png"
            style={{ height: "auto" }}
            width={90}
            height={96}
            alt="Achu Designer Boutique official logo"
          />
          <h3>Achu Designer Boutique</h3>
          <p>
            Indian elegance, thoughtfully curated.
            <br />
            Find a little something that feels like you.
          </p>
          {store.instagram_url && (
            <a
              href={store.instagram_url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Achu on Instagram"
            >
              <Instagram size={20} />
            </a>
          )}
        </div>
        <div>
          <h4>Explore</h4>
          {[
            ["Shop all", "/shop"],
            ["Collections", "/collections"],
            ["New arrivals", "/shop?new=true"],
            ["Our story", "/about"],
            ["Contact us", "/contact"],
          ].map(([n, u]) => (
            <Link key={u} href={u}>
              {n}
            </Link>
          ))}
        </div>
        <div>
          <h4>Here to help</h4>
          {[
            ["Shipping policy", "/shipping-policy"],
            ["Returns & exchanges", "/return-exchange"],
            ["Privacy policy", "/privacy-policy"],
            ["Terms & conditions", "/terms"],
          ].map(([n, u]) => (
            <Link key={u} href={u}>
              {n}
            </Link>
          ))}
        </div>
        <div>
          <h4>Let’s connect</h4>
          {store.phone_number && (
            <a href={`tel:+${store.phone_number}`}>
              <Phone size={14} /> +{store.phone_number}
            </a>
          )}
          {store.whatsapp_number && (
            <a
              href={whatsappUrl(
                store.whatsapp_number,
                "Hi Achu Designer Boutique, I would like to know more about your collections.",
              )!}
            >
              <MessageCircle size={14} /> Chat on WhatsApp{" "}
              <ArrowUpRight size={13} />
            </a>
          )}
          {store.address ? (
            <p>
              <MapPin size={14} /> {store.address}
            </p>
          ) : (
            <p>Store details coming soon.</p>
          )}
          {store.opening_hours && <p>{store.opening_hours}</p>}
        </div>
      </div>
      <div className="container footer-bottom">
        <span>
          © {new Date().getFullYear()} {store.business_name}. All rights
          reserved.
        </span>
        <span>Designed for your beautiful moments.</span>
      </div>
    </footer>
  );
}
