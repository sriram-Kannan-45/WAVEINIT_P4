"use client";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { updateInventory } from "@/lib/admin-client";
import { imageUrl } from "@/lib/utils";
export type InventoryRow = {
  id: string;
  size: string;
  stock_quantity: number;
  active: boolean;
  products: {
    id: string;
    name: string;
    status: string;
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
  return (
    <tr className="inventory-row">
      <td>
        <div className="table-product">
          <Image
            src={imageUrl(
              r.products.product_images.find((i) => i.is_cover)?.storage_path ||
                r.products.product_images[0]?.storage_path ||
                "",
            )}
            width={35}
            height={45}
            alt={r.products.name}
          />
          <Link href={`/admin/products/${r.products.id}/edit`}>
            {r.products.name}
          </Link>
        </div>
      </td>
      <td>{r.size}</td>
      <td>
        <input
          type="number"
          aria-label={`Stock for ${r.products.name} size ${r.size}`}
          value={stock}
          min="0"
          max="999999"
          onChange={(e) => setStock(Number(e.target.value))}
        />
      </td>
      <td>
        <span
          className={`status-pill ${r.stock_quantity <= threshold ? "warning" : ""}`}
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
      <td>{r.products.status}</td>
      <td>
        <button
          className="button outline"
          style={{ minHeight: 34, padding: "6px 12px", fontSize: 10 }}
          disabled={busy || stock === r.stock_quantity}
          onClick={async () => {
            setBusy(true);
            const result = await updateInventory(r.id, stock);
            setBusy(false);
            if (result.ok) {
              toast.success("Stock updated");
              router.refresh();
            } else toast.error(result.error);
          }}
        >
          {busy ? "Saving…" : "Update"}
        </button>
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
      <table className="admin-table">
        <thead>
          <tr>
            {[
              "Product",
              "Size",
              "Stock",
              "Availability",
              "Product status",
              "Save",
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
        <p className="admin-empty">No variants match these filters.</p>
      )}
    </div>
  );
}
