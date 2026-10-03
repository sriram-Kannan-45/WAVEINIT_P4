"use client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Trash2, Plus, Save } from "lucide-react";
import { toast } from "sonner";
import { saveProduct } from "@/lib/admin-client";
import { productSchema } from "@/lib/validations";
import { slugify } from "@/lib/utils";
import { ImageUploader } from "./image-uploader";
import type { Product, Taxonomy } from "@/types";
type Input = z.input<typeof productSchema>;
type Output = z.output<typeof productSchema>;
const details: [keyof Input, string, boolean?][] = [
  ["short_description", "Short description", true],
  ["description", "Full description", true],
  ["fabric", "Fabric"],
  ["colour", "Colour"],
  ["care_instructions", "Care instructions", true],
  ["sku", "SKU"],
  ["keywords", "Search keywords"],
  ["meta_title", "SEO title"],
  ["meta_description", "SEO description", true],
];
export function ProductForm({
  product,
  categories,
  collections,
}: {
  product?: Product;
  categories: Taxonomy[];
  collections: Taxonomy[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState("");
  const {
    register,
    handleSubmit,
    control,
    getValues,
    setValue,
    formState: { errors },
  } = useForm<Input, unknown, Output>({
    resolver: zodResolver(productSchema),
    defaultValues: product
      ? {
          ...product,
          selling_price: Number(product.selling_price),
          original_price:
            product.original_price === null
              ? null
              : Number(product.original_price),
          variants: product.product_variants.map((v) => ({
            ...v,
            sku: v.sku || "",
          })),
          images: product.product_images,
          collection_ids: product.product_collections.map(
            (v) => v.collection_id,
          ),
        }
      : {
          name: "",
          slug: "",
          category_id: "",
          selling_price: 0,
          original_price: null,
          status: "draft",
          is_featured: false,
          is_new_arrival: false,
          is_best_seller: false,
          short_description: "",
          description: "",
          fabric: "",
          colour: "",
          care_instructions: "",
          sku: "",
          keywords: "",
          meta_title: "",
          meta_description: "",
          variants: [
            { size: "FREE SIZE", stock_quantity: 0, active: true, sku: "" },
          ],
          images: [],
          collection_ids: [],
        },
  });
  const variants = useWatch({ control, name: "variants" });
  const images = useWatch({ control, name: "images" });
  const chosen = useWatch({ control, name: "collection_ids" });
  async function submit(values: Output) {
    setBusy(true);
    setServerError("");
    const r = await saveProduct(product?.id || null, values);
    setBusy(false);
    if (!r.ok) {
      setServerError(r.error || "Unable to save.");
      toast.error(r.error);
      return;
    }
    toast.success("Product saved");
    router.push("/admin/products");
    router.refresh();
  }
  return (
    <form
      className="admin-form"
      onSubmit={handleSubmit(submit, () =>
        setServerError(
          "Please check the highlighted fields and image/size requirements.",
        ),
      )}
      noValidate
    >
      <h2>The essentials</h2>
      {!categories.length && (
        <p className="setup-note">
          Create a category before adding products.{" "}
          <Link href="/admin/categories" className="text-link">
            Manage categories
          </Link>
        </p>
      )}
      <div className="form-grid">
        <label className="field">
          <span>Product name *</span>
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
        <label className="field">
          <span>Category *</span>
          <select {...register("category_id")}>
            <option value="">Select category</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {!c.active ? " (inactive)" : ""}
              </option>
            ))}
          </select>
          {errors.category_id && (
            <small className="field-error">Select a category.</small>
          )}
        </label>
        <label className="field">
          <span>Status</span>
          <select {...register("status")}>
            <option value="draft">Draft</option>
            <option value="active">Published</option>
            <option value="hidden">Hidden</option>
          </select>
        </label>
        <label className="field">
          <span>Selling price (₹) *</span>
          <input
            type="number"
            step="0.01"
            min="0"
            {...register("selling_price", { valueAsNumber: true })}
          />
          {errors.selling_price && (
            <small className="field-error">
              {errors.selling_price.message}
            </small>
          )}
        </label>
        <label className="field">
          <span>Original price (₹, optional)</span>
          <input
            type="number"
            step="0.01"
            min="0"
            {...register("original_price", {
              setValueAs: (v) => (v === "" ? null : Number(v)),
            })}
          />
          {errors.original_price && (
            <small className="field-error">
              {errors.original_price.message}
            </small>
          )}
        </label>
        {details.map(([key, label, area]) => (
          <label className={`field ${area ? "full" : ""}`} key={key}>
            <span>{label}</span>
            {area ? (
              <textarea {...register(key)} />
            ) : (
              <input {...register(key)} />
            )}
          </label>
        ))}
      </div>
      <h3>Merchandising</h3>
      <div className="switch-grid">
        {[
          ["is_featured", "Featured"],
          ["is_new_arrival", "New arrival"],
          ["is_best_seller", "Best seller"],
        ].map(([key, label]) => (
          <label className="checkbox-field" key={key}>
            <input type="checkbox" {...register(key as "is_featured")} />
            {label}
          </label>
        ))}
      </div>
      <h3>Collections</h3>
      <div className="switch-grid">
        {collections.map((c) => (
          <label className="checkbox-field" key={c.id}>
            <input
              type="checkbox"
              checked={chosen.includes(c.id)}
              onChange={(e) =>
                setValue(
                  "collection_ids",
                  e.target.checked
                    ? [...chosen, c.id]
                    : chosen.filter((id) => id !== c.id),
                )
              }
            />
            {c.name}
          </label>
        ))}
        {!collections.length && (
          <p className="muted">No collections yet. You can add these later.</p>
        )}
      </div>
      <h3>Photographs</h3>
      <ImageUploader
        images={images.map((i) => ({
          ...i,
          storage_path: i.storage_path || "",
          alt_text: i.alt_text || "",
        }))}
        onChange={(images) =>
          setValue("images", images, { shouldValidate: true })
        }
      />
      {errors.images && (
        <p className="field-error">
          {errors.images.message ||
            "Check your photos and choose one cover image."}
        </p>
      )}
      <h3>Sizes & stock</h3>
      <p className="summary-note">
        Each size has its own availability. Zero stock disables that size on the
        storefront.
      </p>
      <div className="variant-editor">
        {variants.map((v, i) => (
          <div className="variant-row" key={i}>
            <input
              aria-label={`Size ${i + 1}`}
              placeholder="Size"
              value={v.size}
              onChange={(e) =>
                setValue(
                  "variants",
                  variants.map((a, j) =>
                    j === i ? { ...a, size: e.target.value } : a,
                  ),
                )
              }
            />
            <input
              aria-label={`Stock for ${v.size}`}
              type="number"
              min="0"
              value={v.stock_quantity}
              onChange={(e) =>
                setValue(
                  "variants",
                  variants.map((a, j) =>
                    j === i
                      ? { ...a, stock_quantity: Number(e.target.value) }
                      : a,
                  ),
                )
              }
            />
            <label className="checkbox-field">
              <input
                type="checkbox"
                checked={v.active}
                onChange={(e) =>
                  setValue(
                    "variants",
                    variants.map((a, j) =>
                      j === i ? { ...a, active: e.target.checked } : a,
                    ),
                  )
                }
              />
              Active
            </label>
            <button
              className="icon-button"
              type="button"
              aria-label={`Remove ${v.size}`}
              disabled={variants.length === 1}
              onClick={() =>
                setValue(
                  "variants",
                  variants.filter((_, j) => j !== i),
                )
              }
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>
      <button
        className="button outline"
        type="button"
        style={{ marginTop: 15 }}
        onClick={() =>
          setValue("variants", [
            ...variants,
            { size: "", stock_quantity: 0, active: true, sku: "" },
          ])
        }
      >
        <Plus size={15} />
        Add size
      </button>
      {errors.variants && (
        <p className="field-error">
          {errors.variants.message ||
            "Check sizes and stock. Sizes must be unique; stock must be a nonnegative integer."}
        </p>
      )}
      {serverError && (
        <p className="field-error" role="alert" style={{ marginTop: 20 }}>
          {serverError}
        </p>
      )}
      <div className="form-actions">
        <button className="button" disabled={busy}>
          <Save size={15} />
          {busy ? "Saving…" : "Save product"}
        </button>
        <Link className="button outline" href="/admin/products">
          Cancel
        </Link>
      </div>
    </form>
  );
}
