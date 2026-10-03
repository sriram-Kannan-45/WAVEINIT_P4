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
export function Checkout({ enabled }: { enabled: boolean }) {
  const items = useCart((s) => s.items);
  const reconcile = useCart((s) => s.reconcile);
  const [redirecting, setRedirecting] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [ready, setReady] = useState<{
    reference: string;
    whatsapp_url: string;
    subtotal: number;
  } | null>(null);
  useEffect(() => {
    if (!ready || !redirecting) return;
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
    if (!enabled || !items.length) return;
    setPending(true);
    setError("");
    try {
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
  if (ready)
    return (
      <div className="section">
        <div className="success-panel">
          <Check size={30} color="#007653" />
          <p className="eyebrow" style={{ marginTop: 18 }}>
            ENQUIRY CREATED · {ready.reference}
          </p>
          <h2>Your order details are ready.</h2>
          <p>
            We’ll now open WhatsApp. Send the prefilled message to confirm
            availability with the boutique. Your order has not been confirmed
            and no payment has been collected.
          </p>
          <p className="summary-note">Subtotal: {money(ready.subtotal)}</p>
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
          <p className="summary-note">
            Please send the prefilled message in WhatsApp. You can return here
            and reopen it if needed.
          </p>
        </div>
      </div>
    );
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
            </small>
          </div>
        ))}
        <div className="summary-line summary-total">
          <span>Subtotal</span>
          <span>{money(subtotal)}</span>
        </div>
        <p className="summary-note">
          Shipping is confirmed by the boutique. Prices and stock are checked
          again before your enquiry is created.
        </p>
        <Link className="text-link" href="/cart">
          Edit your bag
        </Link>
      </aside>
    </div>
  );
}
