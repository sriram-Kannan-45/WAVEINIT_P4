"use client";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2, Eye, EyeOff, Boxes } from "lucide-react";
import { toast } from "sonner";
import { Confirm } from "@/components/ui/dialog";
import { deleteRecord, setProductStatus } from "@/lib/admin-client";
import { imageUrl, money } from "@/lib/utils";
import type { Product } from "@/types";
type Row = Product & { total_stock: number };
export function ProductTable({ products }: { products: Row[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState("");
  async function act(
    id: string,
    remove = false,
    status: "active" | "hidden" = "hidden",
  ) {
    setBusy(id);
    const r = remove
      ? await deleteRecord("products", id)
      : await setProductStatus(id, status);
    setBusy("");
    if (r.ok) {
      toast.success(remove ? "Product deleted" : "Product visibility updated");
      router.refresh();
    } else toast.error(r.error);
  }
  return (
    <div className="admin-table-wrap">
      <table className="admin-table">
        <thead>
          <tr>
            {[
              "Product",
              "Category",
              "Price",
              "Stock",
              "Status",
              "Updated",
              "Actions",
            ].map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {products.map((p) => (
            <tr key={p.id}>
              <td>
                <div className="table-product">
                  <Image
                    src={imageUrl(p.product_images[0]?.storage_path || "")}
                    alt={p.name}
                    width={35}
                    height={45}
                  />
                  <Link href={`/admin/products/${p.id}/edit`}>{p.name}</Link>
                </div>
              </td>
              <td>{p.categories?.name}</td>
              <td>{money(p.selling_price)}</td>
              <td>{p.total_stock}</td>
              <td>
                <span
                  className={`status-pill ${p.status !== "active" ? "hidden" : ""}`}
                >
                  {p.status}
                </span>
              </td>
              <td>
                {p.updated_at
                  ? new Date(p.updated_at).toLocaleDateString("en-IN", {
                      timeZone: "Asia/Kolkata",
                    })
                  : "—"}
              </td>
              <td>
                <div className="table-actions">
                  <Link
                    className="icon-button"
                    href={`/admin/products/${p.id}/edit`}
                    aria-label={`Edit ${p.name}`}
                  >
                    <Pencil size={14} />
                  </Link>
                  <Link
                    className="icon-button"
                    href={`/admin/inventory?product=${p.id}`}
                    aria-label={`Manage ${p.name} stock`}
                  >
                    <Boxes size={14} />
                  </Link>
                  <button
                    className="icon-button"
                    disabled={busy === p.id}
                    aria-label={
                      p.status === "active"
                        ? `Hide ${p.name}`
                        : `Publish ${p.name}`
                    }
                    onClick={() =>
                      act(
                        p.id,
                        false,
                        p.status === "active" ? "hidden" : "active",
                      )
                    }
                  >
                    {p.status === "active" ? (
                      <EyeOff size={14} />
                    ) : (
                      <Eye size={14} />
                    )}
                  </button>
                  <Confirm
                    title={`Delete “${p.name}”?`}
                    onConfirm={() => act(p.id, true)}
                    trigger={
                      <button
                        className="icon-button"
                        disabled={busy === p.id}
                        aria-label={`Delete ${p.name}`}
                      >
                        <Trash2 size={14} />
                      </button>
                    }
                  />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!products.length && (
        <p className="admin-empty">
          No products yet. Add your first piece to begin.
        </p>
      )}
    </div>
  );
}
