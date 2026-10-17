"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Pencil, Trash2, Eye } from "lucide-react";
import { toast } from "sonner";
import { subcategorySchema } from "@/lib/validations";
import { saveSubcategory, deleteRecord } from "@/lib/admin-client";
import { Confirm } from "@/components/ui/dialog";
import { ImageUploader } from "./image-uploader";
import { AdminModal } from "./admin-modal";
import { imageUrl, slugify } from "@/lib/utils";
import type { Subcategory, Taxonomy } from "@/types";

type Input = z.input<typeof subcategorySchema>;
type Output = z.output<typeof subcategorySchema>;

function SubcategoryModal({
  categories,
  item,
  onClose,
  onSaved,
}: {
  categories: Taxonomy[];
  item: Subcategory | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const {
    register,
    handleSubmit,
    control,
    getValues,
    setValue,
    formState: { errors, isDirty },
  } = useForm<Input, unknown, Output>({
    resolver: zodResolver(subcategorySchema),
    defaultValues: item
      ? {
          category_id: item.category_id,
          name: item.name,
          slug: item.slug,
          description: item.description || "",
          image: item.image || "",
          active: item.active,
          display_order: item.display_order ?? 0,
        }
      : {
          category_id: categories[0]?.id || "",
          name: "",
          slug: "",
          description: "",
          image: "",
          active: true,
          display_order: 0,
        },
  });

  const image = useWatch({ control, name: "image" }) || "";
  const nameVal = useWatch({ control, name: "name" }) || "";

  const handleCancel = () => {
    onClose();
  };

  return (
    <AdminModal
      open={true}
      onOpenChange={(open) => {
        if (!open) handleCancel();
      }}
      title={`${item ? "Edit" : "Add"} Subcategory`}
      description="Define craft types, styles, or embroidery categories under a parent category."
      isDirty={isDirty}
    >
      <form
        className="admin-modal-form"
        onSubmit={handleSubmit(async (values) => {
          setBusy(true);
          setError("");
          const r = await saveSubcategory(item?.id || null, values);
          setBusy(false);
          if (r.ok) {
            toast.success("Subcategory saved");
            onSaved();
          } else {
            setError(r.error || "Unable to save subcategory.");
          }
        })}
      >
        <div className="admin-modal-grid">
          <label className="field full">
            <span>Parent Category *</span>
            <select {...register("category_id")}>
              <option value="">Select parent category</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {!c.active ? " (inactive)" : ""}
                </option>
              ))}
            </select>
            {errors.category_id && (
              <small className="field-error">
                {errors.category_id.message}
              </small>
            )}
          </label>

          <label className="field">
            <span>Subcategory name *</span>
            <input
              {...register("name")}
              placeholder="e.g. Stone work, Plain sarees"
              onBlur={(e) => {
                if (!getValues("slug"))
                  setValue("slug", slugify(e.target.value));
              }}
            />
            {errors.name && (
              <small className="field-error">{errors.name.message}</small>
            )}
          </label>

          <label className="field">
            <span>Slug *</span>
            <input {...register("slug")} placeholder="e.g. stone-work" />
            {errors.slug && (
              <small className="field-error">{errors.slug.message}</small>
            )}
          </label>

          <label className="field full">
            <span>Description</span>
            <textarea
              {...register("description")}
              placeholder="Brief editorial note about this subcategory..."
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
          </div>

          <div className="full">
            <label className="field" style={{ marginBottom: "8px" }}>
              <span>Subcategory Image & Circular Preview</span>
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
                  folder="categories"
                  multiple={false}
                  defaultAspect={1 / 1}
                  cropShape="round"
                  modalTitle="Crop Subcategory Photograph (1:1 / Circle)"
                  images={
                    image
                      ? [
                          {
                            storage_path: image,
                            alt_text: nameVal,
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
                    Storefront Circular View
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
                      alt={nameVal || "Preview"}
                      fill
                      sizes="100px"
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
                    {nameVal || "Name"}
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
            {busy ? "Saving…" : "Save subcategory"}
          </button>
        </div>
      </form>
    </AdminModal>
  );
}

function SubcategoryDetailsModal({
  item,
  parentCategoryName,
  onClose,
  onEdit,
}: {
  item: Subcategory;
  parentCategoryName: string;
  onClose: () => void;
  onEdit: () => void;
}) {
  return (
    <AdminModal
      open={true}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title="Subcategory Details"
      description={`Overview and configuration for “${item.name}”.`}
      maxWidth="620px"
    >
      <div className="admin-details-card">
        <div className="admin-details-hero">
          {item.image ? (
            <div className="admin-details-thumb">
              <Image
                src={imageUrl(item.image)}
                alt={item.name}
                fill
                sizes="64px"
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
            <span
              style={{
                fontSize: "12px",
                color: "var(--muted)",
                display: "block",
                marginTop: "2px",
              }}
            >
              Parent: <strong>{parentCategoryName}</strong>
            </span>
          </div>
        </div>

        <div className="admin-details-meta-grid">
          <div className="admin-details-item">
            <span>Name</span>
            <strong>{item.name}</strong>
          </div>
          <div className="admin-details-item">
            <span>Parent Category</span>
            <strong>{parentCategoryName}</strong>
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
            Edit subcategory
          </button>
        </div>
      </div>
    </AdminModal>
  );
}

export function SubcategoryManager({
  categories,
  subcategories,
}: {
  categories: Taxonomy[];
  subcategories: Subcategory[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<Subcategory | null | undefined>(
    undefined,
  );
  const [viewing, setViewing] = useState<Subcategory | null>(null);
  const [filterCat, setFilterCat] = useState<string>("");

  async function remove(id: string) {
    const r = await deleteRecord("subcategories", id);
    if (r.ok) {
      toast.success("Subcategory deleted");
      router.refresh();
    } else {
      toast.error(r.error || "Unable to delete subcategory.");
    }
  }

  const categoryMap = new Map(categories.map((c) => [c.id, c.name]));
  const displayed = filterCat
    ? subcategories.filter((s) => s.category_id === filterCat)
    : subcategories;

  return (
    <>
      <div className="admin-page-title">
        <div>
          <h1>Subcategories</h1>
          <p>
            Group pieces under detailed styles and craft types (e.g. Stone work,
            Plain sarees, Bridal silks).
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
          Add subcategory
        </button>
      </div>

      <div
        className="subcategory-filter-row"
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          marginBottom: "16px",
          flexWrap: "wrap",
        }}
      >
        <label
          style={{
            fontSize: "13px",
            fontWeight: 500,
            color: "var(--muted)",
          }}
        >
          Filter by Category:
        </label>
        <select
          value={filterCat}
          onChange={(e) => setFilterCat(e.target.value)}
          style={{
            padding: "8px 12px",
            borderRadius: "6px",
            border: "1px solid #d5cebf",
            fontSize: "13px",
          }}
        >
          <option value="">All Categories ({subcategories.length})</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div className="admin-panel" style={{ marginTop: 0 }}>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th style={{ width: "60px" }}>Thumb</th>
                <th>Name</th>
                <th>Parent Category</th>
                <th>Slug</th>
                <th>Order</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {displayed.map((r) => (
                <tr key={r.id}>
                  <td>
                    {r.image ? (
                      <div
                        style={{
                          width: "38px",
                          height: "38px",
                          borderRadius: "50%",
                          overflow: "hidden",
                          position: "relative",
                          border: "1.5px solid rgba(212,175,55,0.5)",
                        }}
                      >
                        <Image
                          src={imageUrl(r.image)}
                          alt={r.name}
                          fill
                          sizes="38px"
                          style={{ objectFit: "cover" }}
                        />
                      </div>
                    ) : (
                      <div
                        style={{
                          width: "38px",
                          height: "38px",
                          borderRadius: "50%",
                          background: "#e8e1d5",
                        }}
                      />
                    )}
                  </td>
                  <td>
                    <strong>{r.name}</strong>
                  </td>
                  <td>
                    {categoryMap.get(r.category_id) ||
                      r.categories?.name ||
                      "—"}
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
          {!displayed.length && (
            <p className="admin-empty">
              No subcategories found. Add your first subcategory above.
            </p>
          )}
        </div>
      </div>

      {editing !== undefined && (
        <SubcategoryModal
          key={editing?.id || "new"}
          categories={categories}
          item={editing}
          onClose={() => setEditing(undefined)}
          onSaved={() => {
            setEditing(undefined);
            router.refresh();
          }}
        />
      )}

      {viewing && (
        <SubcategoryDetailsModal
          key={viewing.id}
          item={viewing}
          parentCategoryName={
            categoryMap.get(viewing.category_id) ||
            viewing.categories?.name ||
            "—"
          }
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
