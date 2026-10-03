import {
  MapPin,
  Phone,
  MessageCircle,
  ArrowUpRight,
  Clock,
  Mail,
} from "lucide-react";
import type { StoreSettings } from "@/types";
import { whatsappUrl } from "@/lib/whatsapp";
export function StoreDetails({ store }: { store: StoreSettings }) {
  return (
    <section className="section store-section">
      <div className="container store-grid">
        <div>
          <p className="eyebrow">A LITTLE CLOSER</p>
          <h2>
            Come, find your
            <br />
            <em>beautiful.</em>
          </h2>
          <p className="muted">
            We’d love to help you find your next favourite piece.
            <br />
            Visit us, or start a conversation.
          </p>
          <div className="contact-details">
            {store.address && (
              <p>
                <MapPin size={18} />
                {store.address}
              </p>
            )}
            {store.opening_hours && (
              <p>
                <Clock size={18} />
                {store.opening_hours}
              </p>
            )}
            {store.phone_number && (
              <a href={`tel:+${store.phone_number}`}>
                <Phone size={18} />+{store.phone_number}
              </a>
            )}
            {store.email && (
              <a href={`mailto:${store.email}`}>
                <Mail size={18} />
                {store.email}
              </a>
            )}
            {!store.address && !store.phone_number && (
              <p>Our store and contact details will be published here soon.</p>
            )}
          </div>
          <div className="button-row">
            {store.maps_url && (
              <a
                className="button"
                href={store.maps_url}
                target="_blank"
                rel="noopener noreferrer"
              >
                Get directions <ArrowUpRight size={16} />
              </a>
            )}
            {store.whatsapp_number && (
              <a
                className="button outline"
                href={whatsappUrl(
                  store.whatsapp_number,
                  "Hi Achu Designer Boutique, I would like to know more about your collections.",
                )!}
              >
                <MessageCircle size={16} />
                Say hello
              </a>
            )}
          </div>
        </div>
        <div className="map-panel">
          {store.map_embed_url ? (
            <iframe
              src={store.map_embed_url}
              title="Achu Designer Boutique store location"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          ) : (
            <div className="map-placeholder">
              <div className="map-mark">
                <MapPin size={30} />
              </div>
              <p>Find us soon</p>
              <span>Our store location is coming here.</span>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
