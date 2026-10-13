"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Edit3, Check, Plus, Minus } from "lucide-react";
import { updateInventory } from "@/lib/admin-client";
import { imageUrl, money } from "@/lib/utils";

export type InventoryRow = {
  id: string;
  size: string;
  stock_quantity: number;
  active: boolean;
  price?: number | null;
  products: {
    id: string;
    name: string;
    status: string;
    selling_price?: number;
    categories?: { name: string; slug: string } | null;
    subcategories?: { name: string; slug: string } | null;
    product_images: { storage_path: string; is_cover: boolean }[];
  };
};

function StockRow({
  row: r,
  threshold,
}: {
  row: InventoryRow;
  threshold: number;
}) {
  const [stock, setStock] = useState(r.stock_quantity);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  const isChanged = stock !== r.stock_quantity;
  const isOutOfStock = stock === 0;
  const isLowStock = stock > 0 && stock <= threshold;

  const handleUpdate = async () => {
    if (!isChanged) return;
    setBusy(true);
    const result = await updateInventory(r.id, stock);
    setBusy(false);
    if (result.ok) {
      toast.success(`Updated stock for ${r.products.name} (${r.size}) to ${stock}`);
      router.refresh();
    } else {
      toast.error(result.error || "Unable to update stock");
    }
  };

  const effectivePrice = r.price ?? r.products.selling_price ?? 0;

  return (
    <tr className={`inventory-row ${isOutOfStock ? "row-out-of-stock" : isLowStock ? "row-low-stock" : ""}`}>
      <td>
        <div className="table-product">
          <Image
            src={imageUrl(
              r.products.product_images?.find((i) => i.is_cover)?.storage_path ||
                r.products.product_images?.[0]?.storage_path ||
                "",
            )}
            width={38}
            height={48}
            className="inventory-thumb"
            alt={r.products.name}
          />
          <div className="table-product-info">
            <Link
              href={`/admin/products/${r.products.id}/edit`}
              className="table-product-link"
              title="Edit product"
            >
              {r.products.name}
            </Link>
            <div className="table-product-taxa">
              {r.products.categories?.name && (
                <span className="taxa-chip">{r.products.categories.name}</span>
              )}
              {r.products.subcategories?.name && (
                <span className="taxa-chip sub">{r.products.subcategories.name}</span>
              )}
            </div>
          </div>
        </div>
      </td>

      <td>
        <span className="size-badge-pill">{r.size}</span>
      </td>

      <td>
        <div className="inventory-price-col">
          <strong>{money(effectivePrice)}</strong>
          {r.price !== null && r.price !== undefined && r.price !== r.products.selling_price && (
            <small className="size-specific-flag">Size price</small>
          )}
        </div>
      </td>

      <td>
        <div className="stock-counter-wrap">
          <button
            type="button"
            className="stock-stepper-btn"
            aria-label="Decrease stock"
            disabled={busy || stock <= 0}
            onClick={() => setStock((s) => Math.max(0, s - 1))}
          >
            <Minus size={12} />
          </button>
          <input
            type="number"
            className={`stock-inline-input ${isChanged ? "changed" : ""}`}
            aria-label={`Stock for ${r.products.name} size ${r.size}`}
            value={stock}
            min="0"
            max="999999"
            onChange={(e) => setStock(Math.max(0, Number(e.target.value) || 0))}
          />
          <button
            type="button"
            className="stock-stepper-btn"
            aria-label="Increase stock"
            disabled={busy}
            onClick={() => setStock((s) => s + 1)}
          >
            <Plus size={12} />
          </button>
        </div>
      </td>

      <td>
        <span
          className={`status-pill ${
            !r.active
              ? "muted"
              : r.stock_quantity === 0
                ? "danger"
                : r.stock_quantity <= threshold
                  ? "warning"
                  : "success"
          }`}
        >
          {!r.active
            ? "Inactive"
            : r.stock_quantity === 0
              ? "Out of stock"
              : r.stock_quantity <= threshold
                ? "Low stock"
                : "In stock"}
        </span>
      </td>

      <td>
        <span className={`status-pill ${r.products.status === "active" ? "success" : "muted"}`}>
          {r.products.status}
        </span>
      </td>

      <td>
        <div className="inventory-actions-cell">
          <button
            className={`button ${isChanged ? "primary" : "outline"}`}
            style={{ minHeight: 32, padding: "5px 12px", fontSize: 11 }}
            disabled={busy || !isChanged}
            onClick={handleUpdate}
          >
            {busy ? (
              "Saving…"
            ) : isChanged ? (
              <>
                <Check size={12} />
                Save
              </>
            ) : (
              "Saved"
            )}
          </button>
          <Link
            href={`/admin/products/${r.products.id}/edit`}
            className="icon-button edit-shortcut"
            title="Open product editor"
          >
            <Edit3 size={14} />
          </Link>
        </div>
      </td>
    </tr>
  );
}

export function InventoryTable({
  rows,
  threshold,
}: {
  rows: InventoryRow[];
  threshold: number;
}) {
  return (
    <div className="admin-table-wrap">
      <table className="admin-table inventory-admin-table">
        <thead>
          <tr>
            {[
              "Product",
              "Size",
              "Price",
              "Stock quantity",
              "Availability",
              "Product status",
              "Actions",
            ].map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <StockRow
              key={`${r.id}-${r.stock_quantity}`}
              row={r}
              threshold={threshold}
            />
          ))}
        </tbody>
      </table>
      {!rows.length && (
        <div className="admin-empty">
          <p>No inventory variants match these filters.</p>
          <small>Try selecting a different category, size, or stock status.</small>
        </div>
      )}
    </div>
  );
}
