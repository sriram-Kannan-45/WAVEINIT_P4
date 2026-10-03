"use client";
import { Instagram } from "@/components/ui/instagram";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Search, ShoppingBag, Menu, ArrowUpRight } from "lucide-react";
import * as Dialog from "@radix-ui/react-dialog";
import { useCart } from "@/store/cart-store";
import { Modal } from "@/components/ui/dialog";
import type { StoreSettings } from "@/types";
import { whatsappUrl } from "@/lib/whatsapp";
const links = [
  ["Home", "/"],
  ["Shop", "/shop"],
  ["Collections", "/collections"],
  ["New arrivals", "/shop?new=true"],
  ["Our story", "/about"],
  ["Contact", "/contact"],
];
export function Header({ store }: { store: StoreSettings }) {
  const pathname = usePathname();
  const count = useCart((s) => s.items.reduce((n, i) => n + i.quantity, 0));
  return (
    <>
      <div className="announcement">
        <span>Thoughtfully curated. Beautifully you.</span>
        <span className="announcement-right">
          Discover the Achu edit <ArrowUpRight size={12} />
        </span>
      </div>
      <header className="site-header">
        <div className="header-inner">
          <Link
            href="/"
            className="brand"
            aria-label="Achu Designer Boutique home"
          >
            <Image
              src="/brand/achu-designer-boutique-logo.png"
              style={{ height: "auto" }}
              alt="Achu Designer Boutique official logo"
              width={72}
              height={76}
              loading="eager"
            />
            <span>
              <strong>Achu</strong>
              <small>DESIGNER BOUTIQUE</small>
            </span>
          </Link>
          <nav className="desktop-nav" aria-label="Main navigation">
            {links.map(([name, url]) => (
              <Link
                key={url}
                href={url}
                className={
                  pathname === url ||
                  (url === "/shop" && pathname.startsWith("/product"))
                    ? "active"
                    : ""
                }
              >
                {name}
              </Link>
            ))}
          </nav>
          <div className="header-actions">
            <Modal
              title="Find something beautiful"
              trigger={
                <button className="icon-button" aria-label="Search collection">
                  <Search size={20} />
                </button>
              }
            >
              <form action="/shop" className="search-form">
                <label htmlFor="search-overlay">Search our collection</label>
                <div className="input-with-button">
                  <input
                    id="search-overlay"
                    name="q"
                    placeholder="Sarees, kurtis, a colour…"
                    maxLength={200}
                  />
                  <button type="submit" className="button">
                    Search <Search size={16} />
                  </button>
                </div>
              </form>
            </Modal>
            <Link
              href="/cart"
              className="cart-link icon-button"
              aria-label={`Shopping bag, ${count} items`}
            >
              <ShoppingBag size={20} />
              {count > 0 && <span className="cart-count">{count}</span>}
            </Link>
            <div className="mobile-only">
              <Modal
                side
                title="Explore Achu"
                trigger={
                  <button className="icon-button" aria-label="Open navigation">
                    <Menu size={22} />
                  </button>
                }
              >
                <Image
                  src="/brand/achu-designer-boutique-logo.png"
                  style={{ height: "auto" }}
                  width={90}
                  height={95}
                  alt="Achu Designer Boutique"
                />
                <nav className="mobile-nav">
                  {links.map(([name, url]) => (
                    <Dialog.Close asChild key={url}>
                      <Link href={url}>
                        {name}
                        <ArrowUpRight size={18} />
                      </Link>
                    </Dialog.Close>
                  ))}
                  {store.instagram_url && (
                    <a
                      href={store.instagram_url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Instagram <Instagram size={18} />
                    </a>
                  )}
                  {store.whatsapp_number && (
                    <a
                      href={whatsappUrl(
                        store.whatsapp_number,
                        "Hi Achu Designer Boutique, I would like to know more about your collections.",
                      )!}
                    >
                      WhatsApp <ArrowUpRight size={18} />
                    </a>
                  )}
                </nav>
              </Modal>
            </div>
          </div>
        </div>
      </header>
    </>
  );
}
