"use client";
import Image from "next/image";
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
import { imageUrl, money, stockTotal, siteUrl } from "@/lib/utils";
import { whatsappUrl } from "@/lib/whatsapp";
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
  const discount =
    p.original_price && p.original_price > p.selling_price
      ? Math.round(
          ((p.original_price - p.selling_price) / p.original_price) * 100,
        )
      : 0;
  const enquiry = whatsappUrl(
    store.whatsapp_number,
    `Hi Achu Designer Boutique,\n\nI would like to know more about:\n\nProduct: ${p.name}${variant ? `\nSize: ${variant.size}` : ""}\nPrice: ${money(p.selling_price)}\nProduct Link: ${siteUrl}/product/${p.slug}`,
  );
  function addToCart() {
    if (!variant) {
      toast.error("Please choose your size.");
      return;
    }
    if (quantity > variant.stock_quantity) return;
    const ok = add({
      product_id: p.id,
      variant_id: variant.id,
      slug: p.slug,
      name: p.name,
      size: variant.size,
      image: imageUrl(images[0]?.storage_path || ""),
      price: Number(p.selling_price),
      quantity,
      stock: variant.stock_quantity,
      sample: p.sample,
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
          <Image
            src={imageUrl(images[index]?.storage_path || "")}
            alt={images[index]?.alt_text || p.name}
            fill
            loading="eager"
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
        {images.length > 1 && (
          <div className="gallery-thumbnails">
            {images.map((img, i) => (
              <button
                key={i}
                className={index === i ? "selected" : ""}
                onClick={() => setIndex(i)}
                aria-label={`View product image ${i + 1}`}
                aria-pressed={index === i}
              >
                <Image
                  src={imageUrl(img.storage_path)}
                  alt={img.alt_text || p.name}
                  fill
                  sizes="65px"
                />
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="product-detail-content">
        <p className="eyebrow">{p.categories?.name || "THE ACHU EDIT"}</p>
        <h1>{p.name}</h1>
        <div className="detail-price">
          <span>{money(p.selling_price)}</span>
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
                className={v.id === selected ? "selected" : ""}
                onClick={() => {
                  setSelected(v.id);
                  setQuantity(1);
                }}
              >
                {v.size}
              </button>
            ))}
        </div>
        <div className="add-to-cart-row">
          <div className="quantity-control">
            <button
              aria-label="Decrease quantity"
              disabled={quantity <= 1}
              onClick={() => setQuantity((q) => q - 1)}
            >
              <Minus size={15} />
            </button>
            <output aria-label="Quantity">{quantity}</output>
            <button
              aria-label="Increase quantity"
              disabled={
                !variant || quantity >= Math.min(variant.stock_quantity, 99)
              }
              onClick={() => setQuantity((q) => q + 1)}
            >
              <Plus size={15} />
            </button>
          </div>
          <button className="button" disabled={!stock} onClick={addToCart}>
            <ShoppingBag size={16} />
            {stock ? "Add to bag" : "Out of stock"}
          </button>
        </div>
        {enquiry ? (
          <a
            className="button outline enquiry-button"
            href={enquiry}
            target="_blank"
            rel="noopener noreferrer"
          >
            <MessageCircle size={16} />
            Enquire on WhatsApp
          </a>
        ) : (
          <p className="loading-label">
            WhatsApp contact details will be available soon.
          </p>
        )}
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
