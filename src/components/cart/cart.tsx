"use client";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Minus,
  Plus,
  ShoppingBag,
  ArrowUpRight,
  RefreshCw,
} from "lucide-react";
import { useCart } from "@/store/cart-store";
import { money, paise } from "@/lib/utils";
export function Cart() {
  const items = useCart((s) => s.items);
  const remove = useCart((s) => s.remove);
  const setQuantity = useCart((s) => s.setQuantity);
  const reconcile = useCart((s) => s.reconcile);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const ids = items.map((i) => i.variant_id).join("|");
  async function refresh() {
    if (!items.length) return;
    setRefreshing(true);
    setError("");
    try {
      const response = await fetch("/api/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: items.map((i) => i.variant_id) }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      reconcile(data.updates);
    } catch {
      setError("We couldn’t refresh availability. Try again before checkout.");
    } finally {
      setRefreshing(false);
    }
  }
  useEffect(() => {
    if (!ids) return;
    let cancelled = false;
    fetch("/api/cart", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: ids.split("|") }),
    })
      .then(async (r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((d) => {
        if (!cancelled) reconcile(d.updates);
      })
      .catch(() => {
        if (!cancelled)
          setError(
            "We couldn’t refresh availability. Try again before checkout.",
          );
      });
    return () => {
      cancelled = true;
    };
  }, [ids, reconcile]);
  if (!items.length)
    return (
      <div className="section">
        <div className="empty-state">
          <ShoppingBag
            size={35}
            strokeWidth={1}
            style={{ margin: "0 auto 22px" }}
          />
          <h2>A little room for something beautiful.</h2>
          <p>Your shopping bag is currently empty.</p>
          <Link className="button" href="/shop">
            Explore the collection <ArrowUpRight size={16} />
          </Link>
        </div>
      </div>
    );
  const subtotal =
    items.reduce((sum, i) => sum + paise(i.price) * i.quantity, 0) / 100;
  const unavailable = items.some((i) => !i.stock || i.quantity > i.stock);
  return (
    <div className="cart-layout">
      <div>
        {items.map((i) => (
          <article className="cart-item" key={i.variant_id}>
            <Link href={`/product/${i.slug}`} className="cart-item-image">
              <Image src={i.image} alt={i.name} fill sizes="100px" />
            </Link>
            <div>
              <Link href={`/product/${i.slug}`}>
                <h3>{i.name}</h3>
              </Link>
              <p>
                Size: {i.size}
                {i.sample ? " · Preview piece" : ""}
              </p>
              <div className="quantity-control">
                <button
                  aria-label={`Decrease ${i.name} quantity`}
                  disabled={i.quantity <= 1}
                  onClick={() => setQuantity(i.variant_id, i.quantity - 1)}
                >
                  <Minus size={14} />
                </button>
                <output>{i.quantity}</output>
                <button
                  aria-label={`Increase ${i.name} quantity`}
                  disabled={i.quantity >= Math.min(i.stock, 99)}
                  onClick={() => setQuantity(i.variant_id, i.quantity + 1)}
                >
                  <Plus size={14} />
                </button>
              </div>
              {(!i.stock || i.quantity > i.stock) && (
                <span className="field-error">
                  {!i.stock
                    ? "This size is no longer available. Remove it to continue."
                    : `Only ${i.stock} available. Reduce the quantity to continue.`}
                </span>
              )}
            </div>
            <div className="cart-item-price">
              <span>{money((paise(i.price) * i.quantity) / 100)}</span>
              <br />
              <button
                className="remove-button"
                onClick={() => remove(i.variant_id)}
              >
                Remove
              </button>
            </div>
          </article>
        ))}
        <div className="button-row" style={{ marginTop: 25 }}>
          <Link className="text-link" href="/shop">
            Continue discovering <ArrowUpRight size={15} />
          </Link>
          <button
            className="button outline"
            onClick={refresh}
            disabled={refreshing}
          >
            <RefreshCw size={14} />
            {refreshing ? "Checking…" : "Refresh availability"}
          </button>
        </div>
        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}
      </div>
      <aside className="cart-summary">
        <h2>Your bag, at a glance.</h2>
        <div className="summary-line">
          <span>Subtotal</span>
          <strong>{money(subtotal)}</strong>
        </div>
        <p className="summary-note">
          Shipping and availability are confirmed by the boutique. No payment is
          collected on this website.
        </p>
        {unavailable ? (
          <p className="field-error">
            Please update unavailable items before continuing.
          </p>
        ) : (
          <Link className="button" href="/checkout">
            Continue to checkout <ArrowUpRight size={15} />
          </Link>
        )}
        <p className="summary-note">
          Your final order is confirmed through WhatsApp.
        </p>
      </aside>
    </div>
  );
}
