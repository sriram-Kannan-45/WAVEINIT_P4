"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MessageCircle } from "lucide-react";
import { setEnquiryStatus } from "@/lib/admin-client";
import { whatsappUrl } from "@/lib/whatsapp";
import { money } from "@/lib/utils";
import type { Enquiry } from "@/types";
function OrderRow({ order: o }: { order: Enquiry }) {
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const customerPhone = o.phone.length === 10 ? "91" + o.phone : o.phone;
  return (
    <tr>
      <td>
        <details className="enquiry-details">
          <summary>{o.order_reference}</summary>
          <p>
            <strong>{o.customer_name}</strong>
            <br />
            {o.phone}
            {o.alternate_phone && (
              <>
                <br />
                Alternate: {o.alternate_phone}
              </>
            )}
            <br />
            {o.address}
            <br />
            {o.city}, {o.state} {o.pincode}
            {o.landmark && (
              <>
                <br />
                Landmark: {o.landmark}
              </>
            )}
          </p>
          {o.order_enquiry_items.map((i, n) => (
            <p key={n}>
              {i.product_name_snapshot}
              <br />
              Size {i.size_snapshot} · Qty {i.quantity} ·{" "}
              {money(i.unit_price_snapshot)} each
              <br />
              Line subtotal: {money(i.subtotal_snapshot)}
            </p>
          ))}
          {o.customer_note && <p>Note: {o.customer_note}</p>}
          <p>
            Changing enquiry status does not change inventory. Update stock
            manually when confirming the sale.
          </p>
        </details>
      </td>
      <td>
        {o.customer_name}
        <br />
        <small>{o.phone}</small>
      </td>
      <td>{o.order_enquiry_items.length}</td>
      <td>{money(o.subtotal)}</td>
      <td>
        <select
          style={{ minWidth: 125, minHeight: 34, padding: 6, fontSize: 10 }}
          aria-label={`Status for ${o.order_reference}`}
          value={o.status}
          disabled={busy}
          onChange={async (e) => {
            setBusy(true);
            const r = await setEnquiryStatus(o.id, e.target.value);
            setBusy(false);
            if (r.ok) {
              toast.success("Enquiry updated");
              router.refresh();
            } else toast.error(r.error);
          }}
        >
          {["new", "contacted", "confirmed", "completed", "cancelled"].map(
            (status) => (
              <option key={status} value={status}>
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </option>
            ),
          )}
        </select>
      </td>
      <td>
        {new Date(o.created_at).toLocaleDateString("en-IN", {
          timeZone: "Asia/Kolkata",
        })}
      </td>
      <td>
        <a
          href={whatsappUrl(customerPhone, "")!}
          target="_blank"
          rel="noopener noreferrer"
          className="icon-button"
          aria-label={`Open WhatsApp chat with ${o.customer_name}`}
        >
          <MessageCircle size={17} />
        </a>
      </td>
    </tr>
  );
}
export function OrdersTable({ orders }: { orders: Enquiry[] }) {
  return (
    <div className="admin-table-wrap">
      <table className="admin-table">
        <thead>
          <tr>
            {[
              "Reference & details",
              "Customer",
              "Items",
              "Subtotal",
              "Status",
              "Date (IST)",
              "Chat",
            ].map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <OrderRow key={o.id} order={o} />
          ))}
        </tbody>
      </table>
      {!orders.length && <p className="admin-empty">No enquiries yet.</p>}
    </div>
  );
}
