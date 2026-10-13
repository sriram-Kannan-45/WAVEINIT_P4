"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Sparkles, Plus, Edit2, Trash2, Eye, Calendar, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { AdminModal } from "./admin-modal";
import { ProductCard } from "@/components/product/card";
import { saveNewArrival, toggleNewArrival, deleteRecord } from "@/lib/admin-client";
import { imageUrl, money, stockTotal } from "@/lib/utils";
import type { NewArrivalItem, Product } from "@/types";

export function NewArrivalsManager({
  items,
  products,
}: {
  items: NewArrivalItem[];
  products: Product[];
}) {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [previewItem, setPreviewItem] = useState<NewArrivalItem | null>(null);
  const [editingItem, setEditingItem] = useState<NewArrivalItem | null>(null);
  const [busy, setBusy] = useState(false);

  // Form states
  const [productId, setProductId] = useState("");
  const [badgeText, setBadgeText] = useState("NEW ARRIVAL");
  const [displayOrder, setDisplayOrder] = useState(0);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [active, setActive] = useState(true);

  const resetForm = () => {
    setProductId(products[0]?.id || "");
    setBadgeText("NEW ARRIVAL");
    setDisplayOrder(items.length > 0 ? Math.max(...items.map((i) => i.display_order)) + 1 : 1);
    setStartDate("");
    setEndDate("");
    setActive(true);
    setEditingItem(null);
  };

  const openAddModal = () => {
    resetForm();
    setModalOpen(true);
  };

  const openEditModal = (item: NewArrivalItem) => {
    setEditingItem(item);
    setProductId(item.product_id);
    setBadgeText(item.badge_text || "NEW ARRIVAL");
    setDisplayOrder(item.display_order);
    setStartDate(item.start_date ? item.start_date.split("T")[0] : "");
    setEndDate(item.end_date ? item.end_date.split("T")[0] : "");
    setActive(item.active);
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productId) {
      toast.error("Please select a product");
      return;
    }

    setBusy(true);
    const payload = {
      product_id: productId,
      display_order: Number(displayOrder) || 0,
      badge_text: badgeText.trim() || null,
      start_date: startDate ? new Date(startDate).toISOString() : null,
      end_date: endDate ? new Date(endDate).toISOString() : null,
      active,
    };

    const res = await saveNewArrival(editingItem ? editingItem.id : null, payload);
    setBusy(false);

    if (res.ok) {
      toast.success(
        editingItem
          ? "New Arrival promotion updated"
          : "Product added to New Arrivals",
      );
      setModalOpen(false);
      resetForm();
      router.refresh();
    } else {
      toast.error(res.error || "Unable to save New Arrival promotion");
    }
  };

  const handleToggle = async (item: NewArrivalItem) => {
    const res = await toggleNewArrival(item.id, !item.active);
    if (res.ok) {
      toast.success(
        !item.active
          ? "Promotion activated for storefront"
          : "Promotion deactivated",
      );
      router.refresh();
    } else {
      toast.error(res.error || "Failed to update status");
    }
  };

  const handleDelete = async (item: NewArrivalItem) => {
    const productName = item.products?.name || "this product";
    if (
      !window.confirm(
        `Remove "${productName}" from New Arrivals?\n\nNote: The underlying product and its inventory will NOT be deleted.`,
      )
    ) {
      return;
    }

    const res = await deleteRecord("new_arrivals", item.id);
    if (res.ok) {
      toast.success("Removed from New Arrivals");
      router.refresh();
    } else {
      toast.error(res.error || "Unable to remove item");
    }
  };

  const badgePresets = ["NEW ARRIVAL", "JUST DROPPED", "FESTIVE EDIT", "LIMITED EDITION", "EXCLUSIVE"];

  return (
    <>
      <div className="admin-page-title">
        <div>
          <h1>New Arrivals & Spotlights</h1>
          <p>
            Curate fresh drops for the storefront New & Noteworthy showcase. Link any catalog piece, set custom badges, and control display orders.
          </p>
        </div>
        <button
          type="button"
          className="button primary"
          onClick={openAddModal}
          disabled={!products.length}
        >
          <Plus size={16} />
          Add to New Arrivals
        </button>
      </div>

      <div className="admin-panel" style={{ marginTop: 0 }}>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                {[
                  "Product",
                  "Stock & Price",
                  "Badge",
                  "Display order",
                  "Schedule",
                  "Status",
                  "Actions",
                ].map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const prod = item.products;
                const stock = prod?.product_variants ? stockTotal(prod.product_variants) : 0;
                const isOut = stock === 0;

                return (
                  <tr key={item.id}>
                    <td>
                      <div className="table-product">
                        {prod && (
                          <Image
                            src={imageUrl(
                              prod.product_images?.find((i) => i.is_cover)?.storage_path ||
                                prod.product_images?.[0]?.storage_path ||
                                "",
                            )}
                            width={38}
                            height={48}
                            className="inventory-thumb"
                            alt={prod.name}
                          />
                        )}
                        <div className="table-product-info">
                          <Link
                            href={`/admin/products/${item.product_id}/edit`}
                            className="table-product-link"
                          >
                            {prod?.name || "Product " + item.product_id.slice(0, 8)}
                          </Link>
                          {prod?.sku && <span className="taxa-chip">{prod.sku}</span>}
                        </div>
                      </div>
                    </td>

                    <td>
                      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                        <strong>{prod ? money(prod.selling_price) : "—"}</strong>
                        <span className={`status-pill ${isOut ? "danger" : "success"}`} style={{ fontSize: 9 }}>
                          {isOut ? "Out of stock" : `${stock} units total`}
                        </span>
                      </div>
                    </td>

                    <td>
                      <span className="notif-tag" style={{ background: "#eef5f1", color: "var(--green)", fontWeight: 700 }}>
                        {item.badge_text || "NEW"}
                      </span>
                    </td>

                    <td>
                      <span style={{ fontWeight: 600 }}>#{item.display_order}</span>
                    </td>

                    <td>
                      <div style={{ fontSize: 11, color: "var(--muted)" }}>
                        {item.start_date || item.end_date ? (
                          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                            <Calendar size={12} />
                            <span>
                              {item.start_date ? new Date(item.start_date).toLocaleDateString("en-IN") : "Now"} –{" "}
                              {item.end_date ? new Date(item.end_date).toLocaleDateString("en-IN") : "Indefinite"}
                            </span>
                          </div>
                        ) : (
                          <span>Always active</span>
                        )}
                      </div>
                    </td>

                    <td>
                      <button
                        type="button"
                        className={`status-pill ${item.active ? "success" : "muted"}`}
                        style={{ cursor: "pointer", border: "none" }}
                        onClick={() => handleToggle(item)}
                        title="Click to toggle active status"
                      >
                        {item.active ? "Active" : "Inactive"}
                      </button>
                    </td>

                    <td>
                      <div className="table-actions">
                        <button
                          type="button"
                          className="icon-button"
                          title="Preview customer card"
                          onClick={() => setPreviewItem(item)}
                        >
                          <Eye size={15} />
                        </button>
                        <button
                          type="button"
                          className="icon-button"
                          title="Edit promotion"
                          onClick={() => openEditModal(item)}
                        >
                          <Edit2 size={15} />
                        </button>
                        <button
                          type="button"
                          className="icon-button danger"
                          title="Remove from New Arrivals (preserves product)"
                          onClick={() => handleDelete(item)}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {!items.length && (
            <div className="admin-empty">
              <Sparkles size={28} style={{ opacity: 0.3, marginBottom: 8 }} />
              <p>No products currently featured in New Arrivals.</p>
              <small>Click &quot;Add to New Arrivals&quot; to feature your latest creations on the homepage.</small>
            </div>
          )}
        </div>
      </div>

      {/* CREATE / EDIT MODAL */}
      <AdminModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        title={editingItem ? "Edit New Arrival Entry" : "Feature in New Arrivals"}
        description="Select an existing product from your catalog and configure display order and promotional badges."
        maxWidth="640px"
      >
        <form onSubmit={handleSave} className="admin-modal-form">
          <div className="admin-modal-grid">
            <div className="full">
              <label htmlFor="na-product-select">
                Product to feature <span className="req">*</span>
              </label>
              <select
                id="na-product-select"
                value={productId}
                disabled={Boolean(editingItem)}
                onChange={(e) => setProductId(e.target.value)}
                required
                style={{ width: "100%", padding: "10px 12px", border: "1px solid var(--line)", borderRadius: 6 }}
              >
                <option value="">Select a product…</option>
                {products.map((p) => {
                  const stock = stockTotal(p.product_variants || []);
                  return (
                    <option key={p.id} value={p.id}>
                      {p.name} — {money(p.selling_price)} ({stock > 0 ? `${stock} units` : "Out of stock"})
                    </option>
                  );
                })}
              </select>
            </div>

            <div className="full">
              <label htmlFor="na-badge">Promotional badge text</label>
              <input
                id="na-badge"
                value={badgeText}
                onChange={(e) => setBadgeText(e.target.value)}
                placeholder="e.g. NEW ARRIVAL, JUST DROPPED"
                maxLength={40}
              />
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                {badgePresets.map((preset) => (
                  <button
                    type="button"
                    key={preset}
                    className="notif-tag"
                    style={{
                      cursor: "pointer",
                      border: "1px solid var(--line)",
                      background: badgeText === preset ? "var(--green)" : "#ffffff",
                      color: badgeText === preset ? "#ffffff" : "var(--ink)",
                    }}
                    onClick={() => setBadgeText(preset)}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label htmlFor="na-order">Display priority order</label>
              <input
                id="na-order"
                type="number"
                min="0"
                max="999"
                value={displayOrder}
                onChange={(e) => setDisplayOrder(Number(e.target.value))}
              />
              <small style={{ color: "var(--muted)", fontSize: 10 }}>
                Lower numbers appear first (e.g. 1, 2, 3).
              </small>
            </div>

            <div>
              <label htmlFor="na-active">Active status</label>
              <div style={{ display: "flex", alignItems: "center", gap: 8, height: 38 }}>
                <input
                  id="na-active"
                  type="checkbox"
                  checked={active}
                  onChange={(e) => setActive(e.target.checked)}
                  style={{ width: 18, height: 18, accentColor: "var(--green)" }}
                />
                <label htmlFor="na-active" style={{ fontSize: 13, cursor: "pointer", marginBottom: 0 }}>
                  Active on storefront
                </label>
              </div>
            </div>

            <div>
              <label htmlFor="na-start">Start date (optional)</label>
              <input
                id="na-start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>

            <div>
              <label htmlFor="na-end">End date (optional)</label>
              <input
                id="na-end"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          <div className="admin-modal-footer">
            <button
              type="button"
              className="button outline"
              onClick={() => setModalOpen(false)}
              disabled={busy}
            >
              Cancel
            </button>
            <button type="submit" className="button primary" disabled={busy}>
              {busy ? "Saving…" : editingItem ? "Save Changes" : "Publish New Arrival"}
            </button>
          </div>
        </form>
      </AdminModal>

      {/* PREVIEW MODAL */}
      <AdminModal
        open={Boolean(previewItem)}
        onOpenChange={(open) => !open && setPreviewItem(null)}
        title="Storefront Live Preview"
        description="Here is how this product card appears to customers on your storefront."
        maxWidth="440px"
      >
        {previewItem && previewItem.products && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16, alignItems: "center" }}>
            <div style={{ width: "100%", maxWidth: 320, margin: "auto" }}>
              <ProductCard
                product={{
                  ...previewItem.products,
                  ...({ badge_text: previewItem.badge_text } as object),
                } as Product}
              />
            </div>

            <div style={{ width: "100%", borderTop: "1px solid var(--line)", paddingTop: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--muted)" }}>
                <span>Display priority:</span>
                <strong>#{previewItem.display_order}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
                <span>Promotional badge:</span>
                <strong>{previewItem.badge_text || "NEW"}</strong>
              </div>
            </div>

            <div className="admin-modal-footer" style={{ width: "100%", justifyContent: "flex-end" }}>
              <Link
                href={`/product/${previewItem.products.slug}`}
                target="_blank"
                className="button outline"
                style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
              >
                <span>View customer page</span>
                <ExternalLink size={13} />
              </Link>
              <button
                type="button"
                className="button primary"
                onClick={() => setPreviewItem(null)}
              >
                Done
              </button>
            </div>
          </div>
        )}
      </AdminModal>
    </>
  );
}
