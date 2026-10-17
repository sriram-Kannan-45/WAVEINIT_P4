"use client";
import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { MessageCircle, ArrowUpRight, Check } from "lucide-react";
import { useCart } from "@/store/cart-store";
import {
  customerSchema,
  type CustomerInput,
  type Customer,
} from "@/lib/validations";
import { money, paise } from "@/lib/utils";
import { createVendorOrderGroups, type OrderItem } from "@/lib/whatsapp";
import { defaultStore } from "@/lib/defaults";
const fields: [keyof CustomerInput, string, boolean, string?][] = [
  ["full_name", "Full name", true, "name"],
  ["phone", "Mobile number", true, "tel"],
  ["alternate_phone", "Alternate mobile number", false, "tel"],
  ["address_line_1", "Address line 1", true, "address-line1"],
  ["address_line_2", "Address line 2", false, "address-line2"],
  ["city", "City", true, "address-level2"],
  ["state", "State", true, "address-level1"],
  ["pincode", "Pincode", true, "postal-code"],
  ["landmark", "Landmark", false],
];
type VendorOrder = {
  vendor_name: string;
  whatsapp_number: string;
  items: { name: string; size?: string; quantity: number; price: number }[];
  subtotal: number;
  whatsapp_url: string | null;
  reference?: string;
};

export function Checkout({ enabled }: { enabled: boolean }) {
  const items = useCart((s) => s.items);
  const reconcile = useCart((s) => s.reconcile);
  const remove = useCart((s) => s.remove);
  const [redirecting, setRedirecting] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [ready, setReady] = useState<{
    reference: string;
    whatsapp_url: string;
    subtotal: number;
    vendor_orders?: VendorOrder[];
  } | null>(null);
  useEffect(() => {
    if (!ready || !redirecting) return;
    if (ready.vendor_orders && ready.vendor_orders.length > 1) return;
    const timer = window.setTimeout(
      () => window.location.assign(ready.whatsapp_url),
      1000,
    );
    return () => window.clearTimeout(timer);
  }, [ready, redirecting]);
  const requestKey = useRef("");
  const lastPayload = useRef("");
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CustomerInput, unknown, Customer>({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      full_name: "",
      phone: "",
      alternate_phone: "",
      address_line_1: "",
      address_line_2: "",
      city: "",
      state: "",
      pincode: "",
      landmark: "",
      note: "",
    },
  });
  async function submit(customer: Customer) {
    if (!items.length) return;
    if (!enabled && !demo) return;
    setPending(true);
    setError("");
    try {
      if (demo) {
        const demoRef =
          "ACHU-PREVIEW-" +
          new Date().toISOString().slice(0, 10).replace(/-/g, "") +
          "-" +
          Math.random().toString(36).substring(2, 8).toUpperCase();
        const demoItems: OrderItem[] = items.map((i) => ({
          name: i.name,
          size: i.size,
          quantity: i.quantity,
          price: i.price,
          vendor_name: i.vendor_name,
          vendor_whatsapp_number: i.vendor_whatsapp_number,
        }));
        const defaultVendor = {
          name: defaultStore.business_name,
          whatsapp_number: defaultStore.whatsapp_number,
        };
        const vendorGroups = createVendorOrderGroups(
          demoItems,
          defaultVendor,
          customer,
          demoRef,
        );
        const subtotal =
          items.reduce((sum, i) => sum + paise(i.price) * i.quantity, 0) / 100;
        const primaryUrl =
          vendorGroups.length > 0 && vendorGroups[0].whatsapp_url
            ? vendorGroups[0].whatsapp_url
            : "";
        // Safely clear demo items from cart
        items.forEach((it) => remove(it.variant_id));
        setReady({
          reference: demoRef,
          subtotal,
          whatsapp_url: primaryUrl,
          vendor_orders: vendorGroups,
        });
        return;
      }
      const refresh = await fetch("/api/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: items.map((i) => i.variant_id) }),
      });
      const current = await refresh.json();
      if (!refresh.ok)
        throw new Error("Unable to check availability. Please try again.");
      reconcile(current.updates);
      for (const i of items) {
        const u = current.updates.find(
          (u: { variant_id: string }) => u.variant_id === i.variant_id,
        );
        if (!u?.available || u.stock < i.quantity)
          throw new Error(
            `Stock has changed for ${i.name} (${i.size}). ${u?.stock || 0} available. Please update your bag.`,
          );
        if (paise(u.price) !== paise(i.price))
          throw new Error(
            `Price has changed for ${i.name}. Your bag is now updated; review the total and try again.`,
          );
      }
      const lineItems = items.map((i) => ({
        product_id: i.product_id,
        variant_id: i.variant_id,
        quantity: i.quantity,
        expected_price: i.price,
        vendor_name: i.vendor_name,
        vendor_whatsapp_number: i.vendor_whatsapp_number,
      }));
      const payload = JSON.stringify({ customer, items: lineItems });
      if (payload !== lastPayload.current) {
        requestKey.current = crypto.randomUUID();
        lastPayload.current = payload;
      }
      const response = await fetch("/api/enquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer,
          items: lineItems,
          idempotency_key: requestKey.current,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      // Safe cart clearing: remove only the items successfully persisted in this order
      lineItems.forEach((it) => remove(it.variant_id));
      setReady(data);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Unable to prepare the enquiry. Please try again.",
      );
    } finally {
      setPending(false);
    }
  }
  if (ready) {
    const isMultiVendor =
      ready.vendor_orders && ready.vendor_orders.length > 1;
    return (
      <div className="section">
        <div
          className="success-panel"
          style={{ maxWidth: isMultiVendor ? 680 : undefined }}
        >
          <Check size={30} color="#007653" />
          <p className="eyebrow" style={{ marginTop: 18 }}>
            ENQUIRY CREATED · {ready.reference}
          </p>
          <h2>Your order details are ready.</h2>
          <p>
            {isMultiVendor
              ? "Your cart contains items from multiple vendors. Send the prefilled WhatsApp message to each vendor below to confirm piece availability. Your order has not been confirmed and no payment has been collected."
              : "We’ll now open WhatsApp. Send the prefilled message to confirm availability with the boutique. Your order has not been confirmed and no payment has been collected."}
          </p>
          <p className="summary-note">Total Subtotal: {money(ready.subtotal)}</p>

          {isMultiVendor ? (
            <div
              className="multi-vendor-orders"
              style={{
                marginTop: 24,
                textAlign: "left",
                width: "100%",
              }}
            >
              {ready.vendor_orders!.map((vo, idx) => (
                <div
                  key={vo.whatsapp_number + idx}
                  style={{
                    border: "1px solid var(--line, #e2dcd2)",
                    borderRadius: 8,
                    padding: "16px 20px",
                    marginBottom: 16,
                    backgroundColor: "var(--background-card, #fcfbf9)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "baseline",
                      marginBottom: 8,
                    }}
                  >
                    <strong style={{ fontSize: 16 }}>{vo.vendor_name}</strong>
                    <span style={{ fontWeight: 600 }}>{money(vo.subtotal)}</span>
                  </div>
                  <ul
                    style={{
                      margin: "8px 0 14px",
                      paddingLeft: 18,
                      fontSize: 14,
                      color: "var(--muted, #666)",
                    }}
                  >
                    {vo.items.map((it, i) => (
                      <li key={i}>
                        {it.name} ({it.size || "Standard"}) × {it.quantity} —{" "}
                        {money(it.price * it.quantity)}
                      </li>
                    ))}
                  </ul>
                  {vo.whatsapp_url ? (
                    <a
                      className="button"
                      href={vo.whatsapp_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ width: "100%", justifyContent: "center" }}
                    >
                      <MessageCircle size={16} />
                      Send Order to {vo.vendor_name} on WhatsApp{" "}
                      <ArrowUpRight size={14} />
                    </a>
                  ) : (
                    <p className="field-error">
                      WhatsApp contact number not configured for this vendor.
                    </p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <a
              className="button"
              href={ready.whatsapp_url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setRedirecting(false)}
            >
              <MessageCircle size={17} />
              Continue on WhatsApp <ArrowUpRight size={15} />
            </a>
          )}

          <p className="summary-note" style={{ marginTop: 16 }}>
            Please send the prefilled message in WhatsApp. You can return here
            and reopen it if needed.
          </p>
        </div>
      </div>
    );
  }
  if (!items.length)
    return (
      <div className="section">
        <div className="empty-state">
          <h2>Your bag is waiting.</h2>
          <p>Add a piece before starting an enquiry.</p>
          <Link className="button" href="/shop">
            Explore the collection
          </Link>
        </div>
      </div>
    );
  const subtotal =
    items.reduce((sum, i) => sum + paise(i.price) * i.quantity, 0) / 100;
  const demo = items.some((i) => i.sample);
  return (
    <div className="checkout-layout">
      <form
        className="checkout-form"
        onSubmit={(event) => {
          void handleSubmit(submit)(event);
        }}
        noValidate
      >
        <h2>A few details, then a conversation.</h2>
        <p className="checkout-intro">
          Tell us where you’d like your pieces delivered. We’ll prepare your
          enquiry, and you’ll confirm it with us on WhatsApp.
        </p>
        {(!enabled || demo) && (
          <p className="setup-note">
            {demo
              ? "This is a design preview with illustrative products."
              : "WhatsApp ordering is not configured yet."}{" "}
            Live enquiries are disabled.
          </p>
        )}
        <div className="form-grid">
          {fields.map(([key, label, required, autocomplete]) => (
            <label
              className={`field ${key.startsWith("address") ? "full" : ""}`}
              key={key}
            >
              <span>
                {label}
                {required ? " *" : " (optional)"}
              </span>
              <input
                {...register(key)}
                autoComplete={autocomplete}
                inputMode={
                  ["phone", "alternate_phone", "pincode"].includes(key)
                    ? "numeric"
                    : "text"
                }
                aria-invalid={!!errors[key]}
                aria-describedby={errors[key] ? `${key}-error` : undefined}
              />
              {errors[key] && (
                <small className="field-error" id={`${key}-error`}>
                  {errors[key]?.message}
                </small>
              )}
            </label>
          ))}
          <label className="field full">
            <span>Anything we should know? (optional)</span>
            <textarea
              {...register("note")}
              placeholder="A question about fit, your occasion, or a special request…"
            />
            {errors.note && (
              <small className="field-error">{errors.note.message}</small>
            )}
          </label>
        </div>
        <label className="checkbox-field">
          <input type="checkbox" {...register("consent")} />
          <span>
            I agree to share these details with the boutique to handle my
            enquiry. I’ve read the{" "}
            <Link href="/privacy-policy" target="_blank">
              privacy policy
            </Link>{" "}
            and{" "}
            <Link href="/terms" target="_blank">
              terms
            </Link>
            .
          </span>
        </label>
        {errors.consent && (
          <p className="field-error">{errors.consent.message}</p>
        )}
        {error && (
          <p className="field-error" role="alert">
            {error}{" "}
            <Link href="/cart" className="text-link">
              Review your bag
            </Link>
          </p>
        )}
        <button
          className="button"
          type="submit"
          disabled={pending || !enabled || demo}
        >
          <MessageCircle size={17} />
          {pending ? "Checking & preparing…" : "Place order via WhatsApp"}
          <ArrowUpRight size={15} />
        </button>
        <p className="summary-note">
          No payment is collected here. Your enquiry is saved securely before
          you continue to WhatsApp.
        </p>
      </form>
      <aside className="cart-summary">
        <h2>Your chosen pieces.</h2>
        {items.map((i) => (
          <div className="summary-item" key={i.variant_id}>
            <div className="summary-line">
              <span>{i.name}</span>
              <span>{money((paise(i.price) * i.quantity) / 100)}</span>
            </div>
            <small>
              Size {i.size} · Quantity {i.quantity}
              {i.vendor_name ? ` · Vendor: ${i.vendor_name}` : ""}
            </small>
          </div>
        ))}
        <div className="summary-line" style={{ marginTop: 14 }}>
          <span>Subtotal</span>
          <span>{money(subtotal)}</span>
        </div>
        <div className="summary-line">
          <span>Delivery</span>
          <span style={{ color: "var(--primary, #1e3a2f)", fontWeight: 500 }}>
            Complimentary
          </span>
        </div>
        <div className="summary-line summary-total">
          <span>Total</span>
          <strong>{money(subtotal)}</strong>
        </div>
        <p className="summary-note">
          Insured delivery across India. Piece details and availability are
          confirmed directly with our boutique stylists via WhatsApp.
        </p>
        <Link className="text-link" href="/cart">
          Edit your bag
        </Link>
      </aside>
    </div>
  );
}
