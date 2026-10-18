"use client";
import { OptimizedImage } from "@/components/ui/optimized-image";
import Link from "next/link";
import { useState, useRef } from "react";
import {
  Minus,
  Plus,
  ChevronLeft,
  ChevronRight,
  ShoppingBag,
  MessageCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Modal } from "@/components/ui/dialog";
import { useCart } from "@/store/cart-store";
import type { Product, StoreSettings } from "@/types";
import { imageUrl, money, paise, stockTotal } from "@/lib/utils";
import {
  whatsappUrl,
  productEnquiryMessage,
  productDirectOrderMessage,
} from "@/lib/whatsapp";
function extractViewLabel(altText?: string): string {
  if (!altText || !altText.trim()) return "";
  const known = [
    "Front View",
    "Back View",
    "Left View",
    "Right View",
    "Side View",
    "Fabric Detail",
    "Border Detail",
    "Blouse Detail",
    "Detail View",
  ];
  for (const k of known) {
    if (altText.toLowerCase().includes(k.toLowerCase())) return k;
  }
  return "";
}

export function ProductDetail({
  product: p,
  store,
}: {
  product: Product;
  store: StoreSettings;
}) {
  const images = [...p.product_images].sort(
    (a, b) =>
      Number(b.is_cover) - Number(a.is_cover) || a.sort_order - b.sort_order,
  );
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState("");
  const [quantity, setQuantity] = useState(1);
  const touchX = useRef(0);
  const add = useCart((s) => s.add);
  const variant = p.product_variants.find((v) => v.id === selected);
  const stock = stockTotal(p.product_variants);
  const currentPrice = variant?.price ?? p.selling_price;
  const discount =
    p.original_price && p.original_price > currentPrice
      ? Math.round(
          ((p.original_price - currentPrice) / p.original_price) * 100,
        )
      : 0;
  const vendorWhatsApp =
    p.vendor_whatsapp_number ||
    p.vendor?.whatsapp_number ||
    store.whatsapp_number;
  const vendorName =
    p.vendor_name ||
    p.vendor?.name ||
    store.business_name;

  const currentViewLabel = extractViewLabel(images[index]?.alt_text);
  const imagesWithLabels = images
    .map((img, i) => ({ img, i, label: extractViewLabel(img.alt_text) }))
    .filter((item) => Boolean(item.label));

  const enquiry = whatsappUrl(
    vendorWhatsApp,
    productEnquiryMessage(p, {
      variant,
      currentPrice,
      inStock: Boolean(stock),
      vendorName,
      quantity,
    }),
  );

  const directOrderUrl =
    variant && stock && variant.stock_quantity >= quantity
      ? whatsappUrl(
          vendorWhatsApp,
          productDirectOrderMessage(p, {
            variant,
            price: Number(currentPrice),
            quantity,
            vendorName,
          }),
        )
      : null;
  function addToCart() {
    if (!variant) {
      toast.error("Please choose your size.");
      return;
    }
    if (quantity > variant.stock_quantity || variant.stock_quantity === 0) {
      toast.error("This size is currently out of stock.");
      return;
    }
    const ok = add({
      product_id: p.id,
      variant_id: variant.id,
      slug: p.slug,
      name: p.name,
      size: variant.size,
      image: imageUrl(images[0]?.storage_path || ""),
      price: Number(currentPrice),
      quantity,
      stock: variant.stock_quantity,
      sample: p.sample,
      vendor_name: vendorName,
      vendor_whatsapp_number: vendorWhatsApp,
    });
    if (ok) toast.success("Added to your bag");
    else
      toast.error(
        "Your bag already contains the available quantity for this size.",
      );
  }
  return (
    <div className="product-detail-grid">
      <div>
        <div
          className="gallery-main"
          onTouchStart={(e) => {
            touchX.current = e.changedTouches[0].clientX;
          }}
          onTouchEnd={(e) => {
            const dx = e.changedTouches[0].clientX - touchX.current;
            if (Math.abs(dx) > 45)
              setIndex(
                (i) =>
                  (i + (dx < 0 ? 1 : -1) + Math.max(1, images.length)) %
                  Math.max(1, images.length),
              );
          }}
        >
          {currentViewLabel && (
            <span className="gallery-view-tag">{currentViewLabel}</span>
          )}
          {images.length > 1 && (
            <span className="gallery-counter">
              {index + 1} / {images.length}
            </span>
          )}
          <OptimizedImage
            src={images[index]?.storage_path || ""}
            alt={images[index]?.alt_text || p.name}
            fill
            priority
            fetchPriority="high"
            sizes="(max-width:600px)100vw,50vw"
          />
          {images.length > 1 && (
            <div className="gallery-arrows">
              <button
                className="icon-button"
                aria-label="Previous product image"
                onClick={() =>
                  setIndex((i) => (i - 1 + images.length) % images.length)
                }
              >
                <ChevronLeft size={18} />
              </button>
              <button
                className="icon-button"
                aria-label="Next product image"
                onClick={() => setIndex((i) => (i + 1) % images.length)}
              >
                <ChevronRight size={18} />
              </button>
            </div>
          )}
        </div>

        {imagesWithLabels.length > 0 && (
          <div
            className="gallery-view-pills"
            role="tablist"
            aria-label="Product viewing angles"
          >
            {imagesWithLabels.map((item) => (
              <button
                key={item.i}
                type="button"
                role="tab"
                className={`gallery-view-pill ${index === item.i ? "active" : ""}`}
                onClick={() => setIndex(item.i)}
                aria-selected={index === item.i}
              >
                {item.label}
              </button>
            ))}
          </div>
        )}

        {images.length > 1 && (
          <div
            className="gallery-thumbnails"
            role="tablist"
            aria-label="Product image gallery thumbnails"
          >
            {images.map((img, i) => {
              const thumbLabel = extractViewLabel(img.alt_text);
              return (
                <button
                  key={i}
                  type="button"
                  className={`gallery-thumb-btn ${index === i ? "selected" : ""}`}
                  onClick={() => setIndex(i)}
                  aria-label={`View ${thumbLabel || `product image ${i + 1}`}`}
                  aria-pressed={index === i}
                >
                  <OptimizedImage
                    src={img.storage_path}
                    alt={img.alt_text || p.name}
                    fill
                    sizes="72px"
                  />
                  {thumbLabel && (
                    <span className="gallery-thumb-caption">{thumbLabel}</span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
      <div className="product-detail-content">
        <p className="eyebrow">{p.categories?.name || "THE ACHU EDIT"}</p>
        <h1>{p.name}</h1>
        {vendorName && vendorName !== store.business_name && (
          <p
            style={{
              fontSize: "12px",
              color: "var(--muted)",
              letterSpacing: "0.03em",
              textTransform: "uppercase",
              marginTop: -6,
              marginBottom: 10,
            }}
          >
            Curated by <strong style={{ color: "var(--ink)" }}>{vendorName}</strong>
          </p>
        )}
        <div className="detail-price">
          <span>{money(currentPrice)}</span>
          {discount > 0 && (
            <>
              <del>{money(p.original_price!)}</del>
              <small>{discount}% OFF</small>
            </>
          )}
        </div>
        <span className={`stock-status ${!stock ? "unavailable" : ""}`}>
          {!stock
            ? "Out of stock"
            : variant && variant.stock_quantity <= store.low_stock_threshold
              ? `Only ${variant.stock_quantity} left in ${variant.size}`
              : "Available to enquire"}
        </span>
        <p className="detail-description">{p.short_description}</p>
        <div className="size-heading">
          <span>Select your size</span>
          <Modal
            title="Find your fit"
            trigger={<button className="size-guide-trigger">Size guide</button>}
          >
            {store.size_guide.length ? (
              <>
                <p className="muted">
                  Measurements supplied by the boutique. Confirm the unit and
                  fit with us before ordering.
                </p>
                <table className="size-table">
                  <thead>
                    <tr>
                      {["Size", "Bust", "Waist", "Hip", "Length"].map((v) => (
                        <th key={v}>{v}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {store.size_guide.map((v) => (
                      <tr key={v.size}>
                        <td>{v.size}</td>
                        <td>{v.bust}</td>
                        <td>{v.waist}</td>
                        <td>{v.hip}</td>
                        <td>{v.length}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            ) : (
              <p className="muted">
                Measurements haven’t been published yet. Please ask the boutique
                for the size guide and fit details.
              </p>
            )}
          </Modal>
        </div>
        <div className="size-options">
          {p.product_variants
            .filter((v) => v.active)
            .map((v) => (
              <button
                key={v.id}
                disabled={!v.stock_quantity}
                aria-pressed={v.id === selected}
                aria-label={`${v.size}${!v.stock_quantity ? ", unavailable" : ""}`}
                className={`${v.id === selected ? "selected" : ""} ${!v.stock_quantity ? "sold-out-size" : ""}`}
                onClick={() => {
                  setSelected(v.id);
                  setQuantity(1);
                }}
              >
                {v.size}
                {!v.stock_quantity && <small className="size-sold-out-tag">Sold out</small>}
              </button>
            ))}
        </div>
        <div className="add-to-cart-row">
          <div className="quantity-control">
            <button
              aria-label="Decrease quantity"
              disabled={quantity <= 1 || !stock || (variant && !variant.stock_quantity)}
              onClick={() => setQuantity((q) => q - 1)}
            >
              <Minus size={15} />
            </button>
            <output aria-label="Quantity">{quantity}</output>
            <button
              aria-label="Increase quantity"
              disabled={
                !variant || !variant.stock_quantity || quantity >= Math.min(variant.stock_quantity, 99)
              }
              onClick={() => setQuantity((q) => q + 1)}
            >
              <Plus size={15} />
            </button>
          </div>
          <button
            className="button"
            disabled={!stock || (variant && !variant.stock_quantity)}
            onClick={addToCart}
          >
            <ShoppingBag size={16} />
            {!stock
              ? "Out of stock"
              : variant && !variant.stock_quantity
                ? "Size out of stock"
                : "Add to bag"}
          </button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
          {stock > 0 && (
            <button
              className="button"
              style={{
                backgroundColor: "#25D366",
                color: "#ffffff",
                border: "none",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
              }}
              onClick={() => {
                if (!variant) {
                  toast.error("Please choose your size to order on WhatsApp.");
                  return;
                }
                if (!directOrderUrl) {
                  toast.error("WhatsApp ordering is currently unavailable for this vendor.");
                  return;
                }
                window.open(directOrderUrl, "_blank", "noopener,noreferrer");
              }}
            >
              <MessageCircle size={16} />
              Order on WhatsApp {variant ? `(${money((paise(currentPrice) * quantity) / 100)})` : ""}
            </button>
          )}

          {enquiry ? (
            <a
              className="button outline enquiry-button"
              href={enquiry}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
              }}
            >
              <MessageCircle size={16} />
              {!stock ? "Enquire about Restock on WhatsApp" : "Chat with Vendor on WhatsApp"}
            </a>
          ) : (
            <p className="loading-label">
              WhatsApp contact details will be available soon.
            </p>
          )}
        </div>
        {p.sample && (
          <p className="sample-note">
            Design preview · This is an illustrative piece with a sample price.
            You can try the bag; live ordering is disabled.
          </p>
        )}
        <div className="detail-accordion">
          <details open>
            <summary>The details</summary>
            <p>
              {p.description}
              {p.sku && `\nSKU: ${p.sku}`}
            </p>
          </details>
          <details>
            <summary>Fabric & care</summary>
            <p>
              Fabric: {p.fabric || "Ask the boutique"}
              <br />
              Colour: {p.colour || "Ask the boutique"}
              <br />
              {p.care_instructions || "Ask the boutique for care instructions."}
            </p>
          </details>
          <details>
            <summary>Shipping & exchanges</summary>
            <p>
              Availability, shipping, and exchange terms are confirmed by the
              boutique before your order is final.
            </p>
            <Link className="text-link" href="/return-exchange">
              Read the policy
            </Link>
          </details>
        </div>
      </div>
    </div>
  );
}
