"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Pencil, Trash2, Eye } from "lucide-react";
import { toast } from "sonner";
import { taxonomySchema } from "@/lib/validations";
import { saveTaxonomy, deleteRecord } from "@/lib/admin-client";
import { Confirm } from "@/components/ui/dialog";
import { ImageUploader } from "./image-uploader";
import { AdminModal } from "./admin-modal";
import { imageUrl, slugify } from "@/lib/utils";
import type { Taxonomy } from "@/types";

type Input = z.input<typeof taxonomySchema>;
type Output = z.output<typeof taxonomySchema>;

function TaxonomyModal({
  table,
  item,
  onClose,
  onSaved,
}: {
  table: "categories" | "collections";
  item: Taxonomy | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const singular = table === "categories" ? "Category" : "Collection";

  const {
    register,
    handleSubmit,
    control,
    getValues,
    setValue,
    formState: { errors, isDirty },
  } = useForm<Input, unknown, Output>({
    resolver: zodResolver(taxonomySchema),
    defaultValues: item || {
      name: "",
      slug: "",
      description: "",
      image: "",
      active: true,
      display_order: 0,
      featured: false,
    },
  });

  const image = useWatch({ control, name: "image" }) || "";
  const imageAlt = useWatch({ control, name: "name" }) || "";

  const handleCancel = () => {
    onClose();
  };

  return (
    <AdminModal
      open={true}
      onOpenChange={(open) => {
        if (!open) handleCancel();
      }}
      title={`${item ? "Edit" : "Add"} ${singular}`}
      description={
        table === "categories"
          ? "Configure category information, storefront display image, and visibility."
          : "Curate a luxury collection and control homepage features."
      }
      isDirty={isDirty}
    >
      <form
        className="admin-modal-form"
        onSubmit={handleSubmit(async (values) => {
          setBusy(true);
          setError("");
          const r = await saveTaxonomy(table, item?.id || null, values);
          setBusy(false);
          if (r.ok) {
            toast.success(`${singular} saved`);
            onSaved();
          } else {
            setError(r.error || `Unable to save ${singular.toLowerCase()}.`);
          }
        })}
      >
        <div className="admin-modal-grid">
          <label className="field">
            <span>Name *</span>
            <input
              {...register("name")}
              placeholder={`e.g. ${table === "categories" ? "Sarees, Lehengas" : "Bridal Couture"}`}
              onBlur={(e) => {
                if (!getValues("slug")) setValue("slug", slugify(e.target.value));
              }}
            />
            {errors.name && (
              <small className="field-error">{errors.name.message}</small>
            )}
          </label>

          <label className="field">
            <span>Slug *</span>
            <input {...register("slug")} placeholder="e.g. sarees" />
            {errors.slug && (
              <small className="field-error">{errors.slug.message}</small>
            )}
          </label>

          <label className="field full">
            <span>Description</span>
            <textarea
              {...register("description")}
              placeholder={`Brief editorial note about this ${singular.toLowerCase()}...`}
            />
          </label>

          <label className="field">
            <span>Display order</span>
            <input
              type="number"
              min="0"
              {...register("display_order", { valueAsNumber: true })}
            />
            {errors.display_order && (
              <small className="field-error">
                {errors.display_order.message}
              </small>
            )}
          </label>

          <div className="switch-grid" style={{ alignSelf: "center" }}>
            <label className="checkbox-field">
              <input type="checkbox" {...register("active")} />
              Active on storefront
            </label>
            {table === "collections" && (
              <label className="checkbox-field">
                <input type="checkbox" {...register("featured")} />
                Featured
              </label>
            )}
          </div>

          <div className="full">
            <label className="field" style={{ marginBottom: "8px" }}>
              <span>Category Image & Storefront Preview</span>
            </label>
            <div
              style={{
                display: "flex",
                gap: "20px",
                alignItems: "flex-start",
                flexWrap: "wrap",
              }}
            >
              <div style={{ flex: 1, minWidth: "240px" }}>
                <ImageUploader
                  folder={table}
                  multiple={false}
                  defaultAspect={table === "categories" ? 1 / 1 : 4 / 3}
                  cropShape={table === "categories" ? "round" : "rect"}
                  modalTitle={
                    table === "categories"
                      ? "Crop Category Showcase Photograph (1:1 / Circle)"
                      : "Crop Collection Photograph"
                  }
                  images={
                    image
                      ? [
                          {
                            storage_path: image,
                            alt_text: imageAlt,
                            sort_order: 0,
                            is_cover: true,
                          },
                        ]
                      : []
                  }
                  onChange={(images) =>
                    setValue("image", images[0]?.storage_path || "", {
                      shouldDirty: true,
                    })
                  }
                />
              </div>
              {image && (
                <div
                  className="circular-preview-card"
                  style={{
                    textAlign: "center",
                    padding: "12px 18px",
                    background: "#fdfbf7",
                    borderRadius: "14px",
                    border: "1px solid #e7ded0",
                  }}
                >
                  <small
                    style={{
                      display: "block",
                      marginBottom: "8px",
                      fontWeight: 600,
                      color: "#666",
                    }}
                  >
                    Circular Preview
                  </small>
                  <div
                    style={{
                      width: "100px",
                      height: "100px",
                      borderRadius: "50%",
                      overflow: "hidden",
                      position: "relative",
                      margin: "0 auto",
                      border: "2.5px solid rgba(212,175,55,0.6)",
                      boxShadow: "0 6px 16px rgba(0,0,0,0.12)",
                    }}
                  >
                    <Image
                      src={imageUrl(image)}
                      alt={imageAlt || "Preview"}
                      fill
                      sizes="100px"
                      unoptimized
                      style={{
                        objectFit: "cover",
                        objectPosition: "center 25%",
                      }}
                    />
                  </div>
                  <strong
                    style={{
                      display: "block",
                      marginTop: "8px",
                      fontSize: "12px",
                    }}
                  >
                    {imageAlt || "Category"}
                  </strong>
                </div>
              )}
            </div>
          </div>
        </div>

        {error && (
          <p className="field-error" role="alert" style={{ marginTop: "10px" }}>
            {error}
          </p>
        )}

        <div className="admin-modal-footer">
          <button
            type="button"
            className="button outline"
            onClick={handleCancel}
          >
            Cancel
          </button>
          <button type="submit" className="button" disabled={busy}>
            {busy ? "Saving…" : `Save ${singular.toLowerCase()}`}
          </button>
        </div>
      </form>
    </AdminModal>
  );
}

function TaxonomyDetailsModal({
  table,
  item,
  onClose,
  onEdit,
}: {
  table: "categories" | "collections";
  item: Taxonomy;
  onClose: () => void;
  onEdit: () => void;
}) {
  const [imgError, setImgError] = useState(false);
  const singular = table === "categories" ? "Category" : "Collection";

  return (
    <AdminModal
      open={true}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={`${singular} Details`}
      description={`Overview and configuration for “${item.name}”.`}
      maxWidth="620px"
    >
      <div className="admin-details-card">
        <div className="admin-details-hero">
          {item.image && !imgError ? (
            <div className="admin-details-thumb">
              <Image
                src={imageUrl(item.image)}
                alt={item.name}
                fill
                sizes="64px"
                unoptimized
                priority
                onError={() => setImgError(true)}
                style={{ objectFit: "cover" }}
              />
            </div>
          ) : (
            <div
              className="admin-details-thumb"
              style={{
                display: "grid",
                placeItems: "center",
                color: "#999",
                background: "#f0ebe1",
              }}
            >
              <Eye size={24} />
            </div>
          )}
          <div>
            <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 600 }}>
              {item.name}
            </h3>
            <code style={{ fontSize: "12px", color: "#666" }}>
              /{item.slug}
            </code>
          </div>
        </div>

        <div className="admin-details-meta-grid">
          <div className="admin-details-item">
            <span>Name</span>
            <strong>{item.name}</strong>
          </div>
          <div className="admin-details-item">
            <span>Slug</span>
            <strong>
              <code>{item.slug}</code>
            </strong>
          </div>
          <div className="admin-details-item">
            <span>Status</span>
            <strong>
              <span className={`status-pill ${!item.active ? "hidden" : ""}`}>
                {item.active ? "Active" : "Hidden"}
              </span>
            </strong>
          </div>
          <div className="admin-details-item">
            <span>Display Order</span>
            <strong>{item.display_order ?? 0}</strong>
          </div>
          {table === "collections" && (
            <div className="admin-details-item">
              <span>Featured</span>
              <strong>{item.featured ? "Yes" : "No"}</strong>
            </div>
          )}
          <div className="admin-details-item" style={{ gridColumn: "1 / -1" }}>
            <span>Description</span>
            <p
              style={{
                margin: 0,
                fontSize: "13px",
                color: "#444",
                whiteSpace: "pre-wrap",
              }}
            >
              {item.description || <em>No description provided.</em>}
            </p>
          </div>
        </div>

        <div className="admin-modal-footer">
          <button type="button" className="button outline" onClick={onClose}>
            Close
          </button>
          <button type="button" className="button" onClick={onEdit}>
            <Pencil size={14} style={{ marginRight: "6px" }} />
            Edit {singular.toLowerCase()}
          </button>
        </div>
      </div>
    </AdminModal>
  );
}

export function TaxonomyManager({
  table,
  records,
}: {
  table: "categories" | "collections";
  records: Taxonomy[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<Taxonomy | null | undefined>(
    undefined,
  );
  const [viewing, setViewing] = useState<Taxonomy | null>(null);

  async function remove(id: string) {
    const r = await deleteRecord(table, id);
    if (r.ok) {
      toast.success("Deleted");
      router.refresh();
    } else {
      toast.error(r.error);
    }
  }

  const singular = table === "categories" ? "category" : "collection";

  return (
    <>
      <div className="admin-page-title">
        <div>
          <h1>{table === "categories" ? "Categories" : "Collections"}</h1>
          <p>
            {table === "categories"
              ? "Organize your pieces. Categories with products cannot be deleted."
              : "Bring pieces together into thoughtful edits."}
          </p>
        </div>
        <button
          className="button"
          onClick={() => {
            setViewing(null);
            setEditing(null);
          }}
        >
          <Plus size={15} />
          Add {singular}
        </button>
      </div>

      <div className="admin-panel" style={{ marginTop: 0 }}>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Slug</th>
                <th>Order</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.id}>
                  <td>
                    <strong>{r.name}</strong>
                  </td>
                  <td>
                    <code>{r.slug}</code>
                  </td>
                  <td>{r.display_order}</td>
                  <td>
                    <span
                      className={`status-pill ${!r.active ? "hidden" : ""}`}
                    >
                      {r.active ? "Active" : "Hidden"}
                    </span>
                  </td>
                  <td>
                    <div className="table-actions">
                      <button
                        className="icon-button"
                        aria-label={`View ${r.name} details`}
                        title="View details"
                        onClick={() => {
                          setEditing(undefined);
                          setViewing(r);
                        }}
                      >
                        <Eye size={14} />
                      </button>
                      <button
                        className="icon-button"
                        aria-label={`Edit ${r.name}`}
                        title="Edit"
                        onClick={() => {
                          setViewing(null);
                          setEditing(r);
                        }}
                      >
                        <Pencil size={14} />
                      </button>
                      <Confirm
                        title={`Delete “${r.name}”?`}
                        onConfirm={() => remove(r.id)}
                        trigger={
                          <button
                            className="icon-button"
                            aria-label={`Delete ${r.name}`}
                            title="Delete"
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
          {!records.length && (
            <p className="admin-empty">
              No {table} yet. Create your first one above.
            </p>
          )}
        </div>
      </div>

      {editing !== undefined && (
        <TaxonomyModal
          key={editing?.id || "new"}
          table={table}
          item={editing}
          onClose={() => setEditing(undefined)}
          onSaved={() => {
            setEditing(undefined);
            router.refresh();
          }}
        />
      )}

      {viewing && (
        <TaxonomyDetailsModal
          key={viewing.id}
          table={table}
          item={viewing}
          onClose={() => setViewing(null)}
          onEdit={() => {
            const itemToEdit = viewing;
            setViewing(null);
            setEditing(itemToEdit);
          }}
        />
      )}
    </>
  );
}
