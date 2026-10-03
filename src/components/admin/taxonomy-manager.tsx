"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { taxonomySchema } from "@/lib/validations";
import { saveTaxonomy, deleteRecord } from "@/lib/admin-client";
import { Confirm } from "@/components/ui/dialog";
import { ImageUploader } from "./image-uploader";
import { slugify } from "@/lib/utils";
import type { Taxonomy } from "@/types";
type Input = z.input<typeof taxonomySchema>;
type Output = z.output<typeof taxonomySchema>;
function TaxonomyForm({
  table,
  item,
  onDone,
}: {
  table: "categories" | "collections";
  item: Taxonomy | null;
  onDone: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const {
    register,
    handleSubmit,
    control,
    getValues,
    setValue,
    formState: { errors },
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
  const imageAlt = useWatch({ control, name: "name" });
  return (
    <form
      className="admin-form taxonomy-editor"
      onSubmit={handleSubmit(async (values) => {
        setBusy(true);
        const r = await saveTaxonomy(table, item?.id || null, values);
        setBusy(false);
        if (r.ok) {
          toast.success("Saved");
          onDone();
        } else setError(r.error || "Unable to save.");
      })}
    >
      <h2>
        {item ? "Edit" : "Add"}{" "}
        {table === "categories" ? "category" : "collection"}
      </h2>
      <div className="form-grid">
        <label className="field">
          <span>Name *</span>
          <input
            {...register("name")}
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
          <input {...register("slug")} />
          {errors.slug && (
            <small className="field-error">{errors.slug.message}</small>
          )}
        </label>
        <label className="field full">
          <span>Description</span>
          <textarea {...register("description")} />
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
        <div className="switch-grid">
          <label className="checkbox-field">
            <input type="checkbox" {...register("active")} />
            Active
          </label>
          {table === "collections" && (
            <label className="checkbox-field">
              <input type="checkbox" {...register("featured")} />
              Featured
            </label>
          )}
        </div>
        <div className="full">
          <ImageUploader
            folder={table}
            multiple={false}
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
              setValue("image", images[0]?.storage_path || "")
            }
          />
        </div>
      </div>
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
      <div className="form-actions">
        <button className="button" disabled={busy}>
          {busy ? "Saving…" : "Save"}
        </button>
        <button type="button" className="button outline" onClick={onDone}>
          Cancel
        </button>
      </div>
    </form>
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
  async function remove(id: string) {
    const r = await deleteRecord(table, id);
    if (r.ok) {
      toast.success("Deleted");
      router.refresh();
    } else toast.error(r.error);
  }
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
        <button className="button" onClick={() => setEditing(null)}>
          <Plus size={15} />
          Add {table === "categories" ? "category" : "collection"}
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
                  <td>{r.name}</td>
                  <td>{r.slug}</td>
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
                        aria-label={`Edit ${r.name}`}
                        onClick={() => setEditing(r)}
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
        <TaxonomyForm
          key={editing?.id || "new"}
          table={table}
          item={editing}
          onDone={() => {
            setEditing(undefined);
            router.refresh();
          }}
        />
      )}
    </>
  );
}
