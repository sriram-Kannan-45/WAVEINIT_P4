"use client";
import { OptimizedImage } from "@/components/ui/optimized-image";
import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import {
  Minus,
  Plus,
  ShoppingBag,
  ArrowUpRight,
  RefreshCw,
  MessageCircle,
  Undo2,
} from "lucide-react";
import { toast } from "sonner";
import { useCart } from "@/store/cart-store";
import { UndoRedoButtons } from "@/components/admin/undo-redo-buttons";
import { money, paise } from "@/lib/utils";
import { defaultStore } from "@/lib/defaults";
import { createVendorOrderGroups } from "@/lib/whatsapp";
import type { StoreSettings } from "@/types";

export function Cart({ store }: { store?: StoreSettings } = {}) {
  const items = useCart((s) => s.items);
  const remove = useCart((s) => s.remove);
  const setQuantity = useCart((s) => s.setQuantity);
  const reconcile = useCart((s) => s.reconcile);
  const undo = useCart((s) => s.undo);
  const redo = useCart((s) => s.redo);
  const canUndo = useCart((s) => s.canUndo);
  const canRedo = useCart((s) => s.canRedo);
  const undoCount = useCart((s) => s.undoCount);
  const redoCount = useCart((s) => s.redoCount);

  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const ids = items.map((i) => i.variant_id).join("|");

  const handleUndo = useCallback(() => {
    const success = undo();
    if (success) {
      toast.success("Bag change undone", {
        description: "Restored previous bag items",
        duration: 2500,
      });
    }
  }, [undo]);

  const handleRedo = useCallback(() => {
    const success = redo();
    if (success) {
      toast.success("Bag change redone", {
        description: "Changes reapplied",
        duration: 2500,
      });
    }
  }, [redo]);

  // Keyboard shortcuts: Ctrl+Z / Cmd+Z for undo, Ctrl+Y / Cmd+Shift+Z for redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }

      const isMac =
        typeof navigator !== "undefined" &&
        /Mac|iPod|iPhone|iPad/.test(navigator.platform);
      const modKey = isMac ? e.metaKey : e.ctrlKey;

      if (modKey && (e.key === "z" || e.key === "Z")) {
        if (e.shiftKey) {
          if (canRedo) {
            e.preventDefault();
            handleRedo();
          }
        } else {
          if (canUndo) {
            e.preventDefault();
            handleUndo();
          }
        }
      } else if (modKey && (e.key === "y" || e.key === "Y")) {
        if (canRedo) {
          e.preventDefault();
          handleRedo();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [canUndo, canRedo, handleUndo, handleRedo]);

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
          {canUndo && (
            <div className="cart-empty-undo-banner" style={{ margin: "20px 0 16px" }}>
              <button
                type="button"
                className="button secondary"
                onClick={handleUndo}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  cursor: "pointer",
                }}
              >
                <Undo2 size={16} /> Undo item removal ({undoCount})
              </button>
            </div>
          )}
          <Link className="button" href="/shop">
            Explore the collection <ArrowUpRight size={16} />
          </Link>
        </div>
      </div>
    );

  const subtotal =
    items.reduce((sum, i) => sum + paise(i.price) * i.quantity, 0) / 100;
  const unavailable = items.some((i) => !i.stock || i.quantity > i.stock);
  const defaultVendor = {
    name: store?.business_name || defaultStore.business_name,
    whatsapp_number: store?.whatsapp_number || defaultStore.whatsapp_number,
  };
  const vendorGroups = createVendorOrderGroups(items, defaultVendor);
  const isMultiVendor = vendorGroups.length > 1;

  return (
    <div className="cart-layout">
      <div>
        {/* Header Toolbar: item count + undo / redo controls */}
        <div className="cart-header-toolbar">
          <div className="cart-header-title-wrap">
            <span className="cart-count-badge">
              {items.reduce((sum, i) => sum + i.quantity, 0)}{" "}
              {items.reduce((sum, i) => sum + i.quantity, 0) === 1
                ? "piece"
                : "pieces"}
            </span>
          </div>
          <div className="cart-history-wrap">
            <UndoRedoButtons
              canUndo={canUndo}
              canRedo={canRedo}
              onUndo={handleUndo}
              onRedo={handleRedo}
              undoCount={undoCount}
              redoCount={redoCount}
              size="sm"
              variant="inline"
            />
          </div>
        </div>

        {items.map((i) => (
          <article className="cart-item" key={i.variant_id}>
            <Link href={`/product/${i.slug}`} className="cart-item-image">
              <OptimizedImage src={i.image} alt={i.name} fill sizes="100px" />
            </Link>
            <div>
              <Link href={`/product/${i.slug}`}>
                <h3>{i.name}</h3>
              </Link>
              <p>
                Size: {i.size}
                {i.vendor_name ? ` · Vendor: ${i.vendor_name}` : ""}
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

        {/* Bottom Toolbar: actions + undo / redo controls */}
        <div className="cart-bottom-actions">
          <div className="button-row">
            <Link className="text-link" href="/shop">
              Continue discovering <ArrowUpRight size={15} />
            </Link>
            <button
              className="button outline"
              onClick={refresh}
              disabled={refreshing}
            >
              <RefreshCw size={14} className={refreshing ? "spin" : ""} />
              {refreshing ? "Checking…" : "Refresh availability"}
            </button>
          </div>
          <div className="cart-bottom-undo-redo">
            <UndoRedoButtons
              canUndo={canUndo}
              canRedo={canRedo}
              onUndo={handleUndo}
              onRedo={handleRedo}
              undoCount={undoCount}
              redoCount={redoCount}
              size="sm"
              variant="inline"
            />
          </div>
        </div>

        {error && (
          <p className="field-error" role="alert" style={{ marginTop: 12 }}>
            {error}
          </p>
        )}

        {/* Mobile floating Undo/Redo pill when history is available */}
        {(canUndo || canRedo) && (
          <div className="cart-mobile-floating-history">
            <UndoRedoButtons
              canUndo={canUndo}
              canRedo={canRedo}
              onUndo={handleUndo}
              onRedo={handleRedo}
              undoCount={undoCount}
              redoCount={redoCount}
              size="sm"
              variant="floating"
            />
          </div>
        )}
      </div>

      <aside className="cart-summary">
        <h2>Your bag, at a glance.</h2>
        <div className="summary-line">
          <span>Subtotal</span>
          <strong>{money(subtotal)}</strong>
        </div>
        <div className="summary-line">
          <span>Delivery charge</span>
          <span style={{ color: "var(--primary, #1e3a2f)", fontWeight: 500 }}>
            Complimentary across India
          </span>
        </div>
        <div
          className="summary-line summary-total"
          style={{
            borderTop: "1px solid var(--line, #e2dcd2)",
            paddingTop: 14,
            marginTop: 14,
          }}
        >
          <span>Estimated total</span>
          <strong style={{ fontSize: 20 }}>{money(subtotal)}</strong>
        </div>
        <p className="summary-note">
          Shipping and piece availability are confirmed by our boutique
          stylists. No payment is collected on this website.
        </p>
        {isMultiVendor && (
          <div
            style={{
              padding: "10px 14px",
              margin: "12px 0",
              backgroundColor: "var(--background-card, #fcfbf9)",
              border: "1px solid var(--line, #e2dcd2)",
              borderRadius: 6,
              fontSize: 13,
              lineHeight: 1.4,
            }}
          >
            <strong>Multi-vendor Bag:</strong> Your pieces come from{" "}
            {vendorGroups.length} vendors. In accordance with boutique policy,
            each vendor order is confirmed separately on WhatsApp.
          </div>
        )}
        {unavailable ? (
          <p className="field-error">
            Please update unavailable items before continuing.
          </p>
        ) : (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 10,
              marginTop: 14,
            }}
          >
            <Link className="button" href="/checkout">
              Continue to checkout <ArrowUpRight size={15} />
            </Link>
            {!isMultiVendor && vendorGroups[0]?.whatsapp_url && (
              <a
                className="button"
                href={vendorGroups[0].whatsapp_url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Order bag via WhatsApp"
                style={{
                  backgroundColor: "#25D366",
                  color: "#ffffff",
                  border: "none",
                  fontWeight: 500,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                }}
              >
                <MessageCircle size={16} /> Order bag via WhatsApp
              </a>
            )}
            {isMultiVendor && (
              <div
                style={{
                  marginTop: 10,
                  paddingTop: 12,
                  borderTop: "1px solid var(--line, #e2dcd2)",
                }}
              >
                <p
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    marginBottom: 8,
                  }}
                >
                  Order directly per vendor:
                </p>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                  }}
                >
                  {vendorGroups.map((vg, idx) =>
                    vg.whatsapp_url ? (
                      <a
                        key={vg.whatsapp_number + idx}
                        className="button outline"
                        href={vg.whatsapp_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          fontSize: 13,
                          padding: "9px 12px",
                          justifyContent: "space-between",
                        }}
                      >
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                          <MessageCircle
                            size={15}
                            color="#25D366"
                          />
                          {vg.vendor_name} ({vg.items.length} {vg.items.length === 1 ? "item" : "items"})
                        </span>
                        <span>
                          {money(vg.subtotal)}{" "}
                          <ArrowUpRight
                            size={13}
                            style={{
                              display: "inline",
                              verticalAlign: "middle",
                            }}
                          />
                        </span>
                      </a>
                    ) : (
                      <div
                        key={vg.whatsapp_number + idx}
                        style={{
                          fontSize: 12,
                          padding: "8px 12px",
                          border: "1px dashed var(--line, #e2dcd2)",
                          borderRadius: 6,
                          color: "var(--muted)",
                          display: "flex",
                          justifyContent: "space-between",
                        }}
                      >
                        <span>{vg.vendor_name} ({vg.items.length} items)</span>
                        <span className="field-error" style={{ fontSize: 11 }}>WhatsApp not configured</span>
                      </div>
                    ),
                  )}
                </div>
              </div>
            )}
          </div>
        )}
        <p className="summary-note">
          Your final order is confirmed through WhatsApp.
        </p>
      </aside>
    </div>
  );
}
