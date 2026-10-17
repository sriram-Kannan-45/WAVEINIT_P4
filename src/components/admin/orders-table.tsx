"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  MessageCircle,
  CheckCircle2,
  XCircle,
  Clock,
  Ban,
  Package,
  AlertCircle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { confirmOrder, rejectOrder, setEnquiryStatus } from "@/lib/admin-client";
import { whatsappUrl } from "@/lib/whatsapp";
import { money } from "@/lib/utils";
import type { Enquiry } from "@/types";

function formatIST(dateString?: string | null): string {
  if (!dateString) return "";
  try {
    return new Date(dateString).toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateString;
  }
}

function StatusBadge({ status }: { status: Enquiry["status"] }) {
  switch (status) {
    case "confirmed":
      return (
        <span
          className="status-pill success"
          style={{
            backgroundColor: "#e6f4ea",
            color: "#137333",
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            fontWeight: 600,
            fontSize: 11,
            padding: "3px 8px",
            borderRadius: 12,
          }}
        >
          <CheckCircle2 size={12} /> Confirmed
        </span>
      );
    case "rejected":
      return (
        <span
          className="status-pill error"
          style={{
            backgroundColor: "#fce8e6",
            color: "#c5221f",
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            fontWeight: 600,
            fontSize: 11,
            padding: "3px 8px",
            borderRadius: 12,
          }}
        >
          <XCircle size={12} /> Rejected
        </span>
      );
    case "cancelled":
      return (
        <span
          className="status-pill muted"
          style={{
            backgroundColor: "#f1f3f4",
            color: "#5f6368",
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            fontWeight: 600,
            fontSize: 11,
            padding: "3px 8px",
            borderRadius: 12,
          }}
        >
          <Ban size={12} /> Cancelled
        </span>
      );
    case "completed":
      return (
        <span
          className="status-pill success"
          style={{
            backgroundColor: "#e6f4ea",
            color: "#137333",
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            fontWeight: 600,
            fontSize: 11,
            padding: "3px 8px",
            borderRadius: 12,
          }}
        >
          <Package size={12} /> Completed
        </span>
      );
    case "contacted":
      return (
        <span
          className="status-pill warning"
          style={{
            backgroundColor: "#e8f0fe",
            color: "#1a73e8",
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            fontWeight: 600,
            fontSize: 11,
            padding: "3px 8px",
            borderRadius: 12,
          }}
        >
          <MessageCircle size={12} /> Contacted
        </span>
      );
    case "new":
    default:
      return (
        <span
          className="status-pill warning"
          style={{
            backgroundColor: "#fef7e0",
            color: "#b06000",
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            fontWeight: 600,
            fontSize: 11,
            padding: "3px 8px",
            borderRadius: 12,
          }}
        >
          <Clock size={12} /> Pending Review
        </span>
      );
  }
}

function OrderRow({ order: o }: { order: Enquiry }) {
  const [busy, setBusy] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [expanded, setExpanded] = useState(false);
  const router = useRouter();

  const customerPhone = o.phone.length === 10 ? "91" + o.phone : o.phone;
  const isPending = o.status === "new" || o.status === "contacted";

  const handleConfirm = async () => {
    if (busy) return;
    setBusy(true);
    const toastId = toast.loading("Validating inventory & confirming order…");
    const r = await confirmOrder(o.id);
    setBusy(false);
    if (r.ok) {
      toast.success(`Order ${o.order_reference} confirmed! Inventory deducted.`, {
        id: toastId,
      });
      router.refresh();
    } else {
      toast.error(r.error || "Failed to confirm order.", { id: toastId });
    }
  };

  const handleReject = async () => {
    if (busy) return;
    setBusy(true);
    const toastId = toast.loading("Rejecting order…");
    const r = await rejectOrder(o.id, rejectionReason);
    setBusy(false);
    setRejecting(false);
    if (r.ok) {
      toast.success(`Order ${o.order_reference} marked as rejected. No stock was deducted.`, {
        id: toastId,
      });
      router.refresh();
    } else {
      toast.error(r.error || "Failed to reject order.", { id: toastId });
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (busy) return;
    if (newStatus === "confirmed") {
      await handleConfirm();
      return;
    }
    if (newStatus === "rejected") {
      setRejecting(true);
      return;
    }
    setBusy(true);
    const r = await setEnquiryStatus(o.id, newStatus);
    setBusy(false);
    if (r.ok) {
      toast.success(`Order status updated to ${newStatus}`);
      router.refresh();
    } else {
      toast.error(r.error || "Unable to update status.");
    }
  };

  return (
    <>
      <tr style={{ backgroundColor: expanded ? "var(--background-card, #fbfaf8)" : undefined }}>
        <td>
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 0,
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontWeight: 600,
              color: "var(--foreground, #1a1a1a)",
              textAlign: "left",
            }}
            aria-expanded={expanded}
          >
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            <span>{o.order_reference}</span>
          </button>
          <div style={{ fontSize: 11, color: "var(--muted, #666)", marginTop: 2 }}>
            {formatIST(o.created_at)}
          </div>
        </td>

        <td>
          <strong>{o.customer_name}</strong>
          <br />
          <small style={{ color: "var(--muted, #666)" }}>{o.phone}</small>
          {o.city && (
            <div style={{ fontSize: 11, color: "var(--muted, #888)" }}>
              {o.city}, {o.state}
            </div>
          )}
        </td>

        <td>
          <span style={{ fontWeight: 500 }}>
            {o.order_enquiry_items.length} {o.order_enquiry_items.length === 1 ? "piece" : "pieces"}
          </span>
          <div style={{ fontSize: 11, color: "var(--muted, #666)" }}>
            {o.order_enquiry_items.map((i) => `${i.product_name_snapshot} (${i.size_snapshot}) × ${i.quantity}`).slice(0, 2).join(", ")}
            {o.order_enquiry_items.length > 2 && "…"}
          </div>
        </td>

        <td>
          <strong style={{ fontSize: 14 }}>{money(o.subtotal)}</strong>
        </td>

        <td>
          <StatusBadge status={o.status} />
          {o.stock_deducted && (
            <div style={{ fontSize: 10, color: "#137333", marginTop: 2 }}>
              Stock deducted
            </div>
          )}
        </td>

        <td>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 160 }}>
            {isPending ? (
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  type="button"
                  className="button"
                  onClick={handleConfirm}
                  disabled={busy}
                  style={{
                    backgroundColor: "#137333",
                    color: "#ffffff",
                    border: "none",
                    padding: "6px 12px",
                    fontSize: 12,
                    fontWeight: 600,
                    borderRadius: 4,
                    cursor: busy ? "not-allowed" : "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                  title="Atomically deduct inventory and confirm order"
                >
                  <CheckCircle2 size={13} />
                  {busy ? "Checking…" : "Confirm"}
                </button>

                <button
                  type="button"
                  className="button outline"
                  onClick={() => setRejecting(!rejecting)}
                  disabled={busy}
                  style={{
                    borderColor: "#c5221f",
                    color: "#c5221f",
                    padding: "6px 10px",
                    fontSize: 12,
                    borderRadius: 4,
                  }}
                  title="Reject order without deducting inventory"
                >
                  Reject
                </button>
              </div>
            ) : o.status === "confirmed" ? (
              <div style={{ fontSize: 11, color: "var(--muted, #666)" }}>
                <div>Confirmed {formatIST(o.confirmed_at)}</div>
                {o.confirmed_by && <div>By: {o.confirmed_by}</div>}
              </div>
            ) : o.status === "rejected" ? (
              <div style={{ fontSize: 11, color: "#c5221f" }}>
                {o.rejection_reason ? `Reason: ${o.rejection_reason}` : "No stock deducted"}
              </div>
            ) : null}

            <select
              style={{
                fontSize: 11,
                padding: "3px 6px",
                borderRadius: 4,
                border: "1px solid var(--line, #e2dcd2)",
                background: "transparent",
                color: "var(--foreground, inherit)",
              }}
              aria-label={`Update status for ${o.order_reference}`}
              value={o.status}
              disabled={busy}
              onChange={(e) => handleStatusChange(e.target.value)}
            >
              {["new", "contacted", "confirmed", "rejected", "completed", "cancelled"].map((st) => (
                <option key={st} value={st}>
                  Status: {st.charAt(0).toUpperCase() + st.slice(1)}
                </option>
              ))}
            </select>
          </div>
        </td>

        <td>
          <a
            href={whatsappUrl(customerPhone, `Hi ${o.customer_name}, regarding your order enquiry ${o.order_reference} at Achu Designer Boutique:`)!}
            target="_blank"
            rel="noopener noreferrer"
            className="icon-button"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 32,
              height: 32,
              color: "#25D366",
            }}
            aria-label={`Open WhatsApp chat with ${o.customer_name}`}
            title={`Chat with ${o.customer_name} on WhatsApp`}
          >
            <MessageCircle size={18} />
          </a>
        </td>
      </tr>

      {/* Inline rejection reason form */}
      {rejecting && (
        <tr>
          <td colSpan={7} style={{ backgroundColor: "#fef6f6", padding: "12px 16px", borderBottom: "1px solid #fed7d7" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <strong style={{ fontSize: 13, color: "#c5221f" }}>
                Reject order {o.order_reference}?
              </strong>
              <input
                type="text"
                placeholder="Reason (e.g. Size out of stock, customer requested cancellation)…"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                style={{
                  flex: "1 1 280px",
                  fontSize: 12,
                  padding: "6px 10px",
                  borderRadius: 4,
                  border: "1px solid #feb2b2",
                }}
              />
              <button
                type="button"
                className="button"
                onClick={handleReject}
                disabled={busy}
                style={{
                  backgroundColor: "#c5221f",
                  color: "#ffffff",
                  border: "none",
                  padding: "6px 14px",
                  fontSize: 12,
                  borderRadius: 4,
                }}
              >
                Confirm Rejection
              </button>
              <button
                type="button"
                className="button outline"
                onClick={() => setRejecting(false)}
                disabled={busy}
                style={{ padding: "6px 10px", fontSize: 12 }}
              >
                Cancel
              </button>
            </div>
            <p style={{ margin: "6px 0 0", fontSize: 11, color: "var(--muted, #666)" }}>
              No inventory will be deducted. Order will be marked as REJECTED.
            </p>
          </td>
        </tr>
      )}

      {/* Expanded order details */}
      {expanded && (
        <tr>
          <td colSpan={7} style={{ backgroundColor: "#fbfaf8", padding: "18px 24px", borderBottom: "2px solid var(--line, #e2dcd2)" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20 }}>
              {/* Delivery info */}
              <div>
                <h4 style={{ margin: "0 0 8px", fontSize: 13, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--muted, #666)" }}>
                  Delivery & Contact Information
                </h4>
                <div style={{ fontSize: 13, lineHeight: 1.6 }}>
                  <div><strong>Customer:</strong> {o.customer_name}</div>
                  <div><strong>Phone:</strong> {o.phone}</div>
                  {o.alternate_phone && <div><strong>Alternate Phone:</strong> {o.alternate_phone}</div>}
                  <div><strong>Address:</strong> {o.address}</div>
                  <div><strong>City / State:</strong> {o.city}, {o.state} - {o.pincode}</div>
                  {o.landmark && <div><strong>Landmark:</strong> {o.landmark}</div>}
                  {o.customer_note && (
                    <div style={{ marginTop: 8, padding: "8px 10px", backgroundColor: "#fff", borderRadius: 4, border: "1px solid var(--line, #e2dcd2)" }}>
                      <strong>Customer Note:</strong> {o.customer_note}
                    </div>
                  )}
                </div>
              </div>

              {/* Items Breakdown */}
              <div>
                <h4 style={{ margin: "0 0 8px", fontSize: 13, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--muted, #666)" }}>
                  Ordered Items ({o.order_enquiry_items.length})
                </h4>
                <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--line, #e2dcd2)", color: "var(--muted, #666)", textAlign: "left" }}>
                      <th style={{ padding: "4px 8px 4px 0" }}>Piece</th>
                      <th style={{ padding: "4px 8px" }}>Size</th>
                      <th style={{ padding: "4px 8px" }}>Qty</th>
                      <th style={{ padding: "4px 8px", textAlign: "right" }}>Price</th>
                      <th style={{ padding: "4px 0 4px 8px", textAlign: "right" }}>Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {o.order_enquiry_items.map((it, idx) => (
                      <tr key={it.id || idx} style={{ borderBottom: "1px dashed var(--line, #e2dcd2)" }}>
                        <td style={{ padding: "6px 8px 6px 0", fontWeight: 500 }}>
                          {it.product_name_snapshot}
                        </td>
                        <td style={{ padding: "6px 8px" }}>
                          <span style={{ backgroundColor: "#f0eeea", padding: "2px 6px", borderRadius: 3 }}>
                            {it.size_snapshot}
                          </span>
                        </td>
                        <td style={{ padding: "6px 8px" }}>{it.quantity}</td>
                        <td style={{ padding: "6px 8px", textAlign: "right" }}>{money(it.unit_price_snapshot)}</td>
                        <td style={{ padding: "6px 0 6px 8px", textAlign: "right", fontWeight: 600 }}>
                          {money(it.subtotal_snapshot)}
                        </td>
                      </tr>
                    ))}
                    <tr>
                      <td colSpan={4} style={{ padding: "8px 8px 4px 0", textAlign: "right", fontWeight: 600 }}>
                        Order Total:
                      </td>
                      <td style={{ padding: "8px 0 4px 8px", textAlign: "right", fontWeight: 700, fontSize: 14 }}>
                        {money(o.subtotal)}
                      </td>
                    </tr>
                  </tbody>
                </table>

                {/* Audit & Inventory Note */}
                <div style={{ marginTop: 12, fontSize: 11, color: "var(--muted, #666)", lineHeight: 1.5 }}>
                  {o.status === "confirmed" ? (
                    <div style={{ color: "#137333", display: "flex", alignItems: "center", gap: 5 }}>
                      <CheckCircle2 size={13} />
                      <span>
                        Confirmed {formatIST(o.confirmed_at)} · Inventory was deducted exactly once.
                      </span>
                    </div>
                  ) : o.status === "rejected" ? (
                    <div style={{ color: "#c5221f", display: "flex", alignItems: "center", gap: 5 }}>
                      <XCircle size={13} />
                      <span>Order rejected. Inventory remains untouched.</span>
                    </div>
                  ) : (
                    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      <AlertCircle size={13} />
                      <span>
                        Inventory will deduct only after you click <strong>Confirm</strong>.
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export function OrdersTable({ orders }: { orders: Enquiry[] }) {
  return (
    <div className="admin-table-wrap">
      <table className="admin-table">
        <thead>
          <tr>
            {[
              "Reference & Date",
              "Customer",
              "Items",
              "Total",
              "Status",
              "Confirmation & Actions",
              "WhatsApp",
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
      {!orders.length && (
        <div style={{ textAlign: "center", padding: "40px 20px", color: "var(--muted, #666)" }}>
          <Package size={32} style={{ opacity: 0.3, marginBottom: 8 }} />
          <p style={{ margin: 0 }}>No orders or enquiries match your filter.</p>
        </div>
      )}
    </div>
  );
}
