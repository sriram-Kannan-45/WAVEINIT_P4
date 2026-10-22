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
import { useFormHistory } from "@/lib/use-form-history";
import { UndoRedoButtons } from "./undo-redo-buttons";
import { ImageUploader } from "./image-uploader";
import type { Product, Subcategory, Taxonomy } from "@/types";
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
  subcategories = [],
  collections,
}: {
  product?: Product;
  categories: Taxonomy[];
  subcategories?: Subcategory[];
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
    reset,
    watch,
    formState: { errors },
  } = useForm<Input, unknown, Output>({
    resolver: zodResolver(productSchema),
    defaultValues: product
      ? {
          ...product,
          subcategory_id: product.subcategory_id || "",
          selling_price: Number(product.selling_price),
          original_price:
            product.original_price === null
              ? null
              : Number(product.original_price),
          meta_title: product.meta_title || "",
          meta_description: product.meta_description || "",
          vendor_name: product.vendor_name || product.vendor?.name || "",
          vendor_whatsapp_number:
            product.vendor_whatsapp_number ||
            product.vendor?.whatsapp_number ||
            "",
          variants: product.product_variants.map((v) => ({
            ...v,
            sku: v.sku || "",
            price:
              v.price === null || v.price === undefined
                ? null
                : Number(v.price),
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
          subcategory_id: "",
          selling_price: 0,
          original_price: null,
          status: "active",
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
          vendor_name: "",
          vendor_whatsapp_number: "",
          variants: [
            { size: "S", stock_quantity: 5, active: true, sku: "", price: null },
            { size: "M", stock_quantity: 10, active: true, sku: "", price: null },
            { size: "L", stock_quantity: 8, active: true, sku: "", price: null },
            { size: "XL", stock_quantity: 3, active: true, sku: "", price: null },
            { size: "2XL", stock_quantity: 4, active: true, sku: "", price: null },
            { size: "3XL", stock_quantity: 0, active: true, sku: "", price: null },
          ],
          images: [],
          collection_ids: [],
        },
  });
  const {
    canUndo,
    canRedo,
    undoCount,
    redoCount,
    undo,
    redo,
    takeSnapshot,
  } = useFormHistory<Input>({
    getValues,
    reset,
    watch,
    debounceMs: 300,
  });

  const handleUndo = () => {
    undo();
    toast.info("Undone last change");
  };

  const handleRedo = () => {
    redo();
    toast.info("Redone change");
  };

  const variants = useWatch({ control, name: "variants" });
  const images = useWatch({ control, name: "images" });
  const chosen = useWatch({ control, name: "collection_ids" });
  const selectedCategoryId = useWatch({ control, name: "category_id" });
  const selectedSubcategoryId = useWatch({ control, name: "subcategory_id" });
  const selectedStatus = useWatch({ control, name: "status" });
  const availableSubcategories = (subcategories || []).filter(
    (s) => s.category_id === selectedCategoryId,
  );
  const currentCategory = categories.find((c) => c.id === selectedCategoryId);
  const currentSubcategory = (subcategories || []).find(
    (s) => s.id === selectedSubcategoryId,
  );
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
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "1rem",
          flexWrap: "wrap",
          gap: "0.75rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.85rem", flexWrap: "wrap" }}>
          <h2 style={{ margin: 0 }}>The essentials</h2>
          <UndoRedoButtons
            canUndo={canUndo}
            canRedo={canRedo}
            onUndo={handleUndo}
            onRedo={handleRedo}
            undoCount={undoCount}
            redoCount={redoCount}
            size="sm"
          />
        </div>
        {product && (
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            {product.slug && (
              <a
                href={`/product/${product.slug}`}
                target="_blank"
                rel="noreferrer"
                className="button outline"
                style={{
                  fontSize: "0.82rem",
                  padding: "0.35rem 0.75rem",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.35rem",
                }}
              >
                View on store ↗
              </a>
            )}
            {currentCategory?.slug && currentSubcategory?.slug && (
              <a
                href={`/category/${currentCategory.slug}/${currentSubcategory.slug}`}
                target="_blank"
                rel="noreferrer"
                className="button outline"
                style={{
                  fontSize: "0.82rem",
                  padding: "0.35rem 0.75rem",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.35rem",
                }}
              >
                View in subcategory ({currentSubcategory.name}) ↗
              </a>
            )}
          </div>
        )}
      </div>

      {selectedStatus === "draft" && (
        <div
          style={{
            border: "1px solid #fde68a",
            background: "#fffbeb",
            color: "#92400e",
            padding: "12px 16px",
            borderRadius: "6px",
            marginBottom: "20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
            flexWrap: "wrap",
          }}
        >
          <div style={{ fontSize: "0.88rem", lineHeight: 1.5 }}>
            ⚠️ <strong>Draft Product:</strong> This product is saved as a Draft and is hidden from customers on the storefront and subcategory listings. Change status to <strong>Published</strong> to make it visible.
          </div>
          <button
            type="button"
            className="button"
            style={{ fontSize: "0.82rem", padding: "0.4rem 0.85rem", whiteSpace: "nowrap" }}
            onClick={() => {
              takeSnapshot();
              setValue("status", "active");
            }}
          >
            Switch to Published
          </button>
        </div>
      )}

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
          <select
            {...register("category_id", {
              onChange: () => {
                setValue("subcategory_id", "");
              },
            })}
          >
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
          <span>Subcategory (optional)</span>
          <select {...register("subcategory_id")}>
            <option value="">
              {availableSubcategories.length === 0 && selectedCategoryId
                ? "No subcategories in this category"
                : "No subcategory"}
            </option>
            {availableSubcategories.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
                {!s.active ? " (inactive)" : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Status</span>
          <select {...register("status")}>
            <option value="active">Published (Visible in store & subcategory)</option>
            <option value="draft">Draft (Hidden from store & subcategory)</option>
            <option value="hidden">Hidden (Unlisted)</option>
          </select>
          {selectedStatus === "draft" && (
            <small style={{ color: "#d97706", display: "block", marginTop: "4px" }}>
              ⚠️ Hidden from storefront and subcategories until published.
            </small>
          )}
          {selectedStatus === "active" && (
            <small style={{ color: "#059669", display: "block", marginTop: "4px" }}>
              ✓ Live and visible inside category and assigned subcategory.
            </small>
          )}
          {selectedStatus === "hidden" && (
            <small style={{ color: "#64748b", display: "block", marginTop: "4px" }}>
              👁️ Delisted from the catalog.
            </small>
          )}
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
      <h3>Vendor &amp; WhatsApp Routing</h3>
      <p className="summary-note">
        Configure vendor details for direct WhatsApp enquiries and multi-vendor checkout. Leave empty to use the main boutique WhatsApp number.
      </p>
      <div className="form-grid">
        <label className="field">
          <span>Vendor / Artisan name</span>
          <input
            {...register("vendor_name")}
            placeholder="e.g. Varanasi Weaves"
          />
        </label>
        <label className="field">
          <span>Vendor WhatsApp number</span>
          <input
            {...register("vendor_whatsapp_number")}
            placeholder="e.g. 919876543210"
          />
        </label>
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
        folder="products"
        defaultAspect={3 / 4}
        modalTitle="Crop & Frame Product Photograph"
        images={images.map((i) => ({
          ...i,
          storage_path: i.storage_path || "",
          alt_text: i.alt_text || "",
        }))}
        onChange={(images) => {
          takeSnapshot();
          setValue("images", images, { shouldValidate: true });
        }}
      />
      {errors.images && (
        <p className="field-error">
          {errors.images.message ||
            "Check your photos and choose one cover image."}
        </p>
      )}
      <h3>Sizes & stock management</h3>
      <p className="summary-note">
        Configure size-specific inventory and optional variant pricing. Zero stock marks that size as Out of Stock automatically.
      </p>

      <div style={{ margin: "14px 0 16px", display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px" }}>
        <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Quick add size:
        </span>
        {["XS", "S", "M", "L", "XL", "2XL", "3XL", "4XL", "5XL", "FREE SIZE"].map((sz) => {
          const exists = variants.some((v) => v.size.trim().toUpperCase() === sz);
          return (
            <button
              key={sz}
              type="button"
              className={`button outline ${exists ? "active" : ""}`}
              style={{
                padding: "4px 10px",
                fontSize: "11px",
                minHeight: "28px",
                borderRadius: "6px",
                opacity: exists ? 0.5 : 1,
              }}
              disabled={exists}
              onClick={() => {
                setValue("variants", [
                  ...variants,
                  { size: sz, stock_quantity: 5, active: true, sku: "", price: null },
                ]);
                toast.success(`Size ${sz} added`);
              }}
            >
              + {sz}
            </button>
          );
        })}
      </div>

      <div className="table-scroll-hint mobile-only">
        ← Swipe table horizontally to edit SKU, Price, and active status →
      </div>
      <div className="admin-table-wrap variant-table-wrap" style={{ background: "#fcfaf4", border: "1px solid var(--line)", borderRadius: "8px", padding: "12px" }}>
        <table className="admin-table" style={{ margin: 0 }}>
          <thead>
            <tr>
              <th style={{ minWidth: "90px" }}>Size *</th>
              <th style={{ minWidth: "100px" }}>Stock *</th>
              <th style={{ minWidth: "140px" }}>Price (₹, optional)</th>
              <th style={{ minWidth: "120px" }}>SKU</th>
              <th style={{ minWidth: "80px" }}>Active</th>
              <th style={{ width: "50px" }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {variants.map((v, i) => (
              <tr key={i}>
                <td>
                  <input
                    aria-label={`Size ${i + 1}`}
                    placeholder="e.g. M, 4XL"
                    value={v.size}
                    style={{ minHeight: "36px", padding: "6px 10px" }}
                    onChange={(e) =>
                      setValue(
                        "variants",
                        variants.map((a, j) =>
                          j === i ? { ...a, size: e.target.value } : a,
                        ),
                      )
                    }
                  />
                </td>
                <td>
                  <input
                    aria-label={`Stock for ${v.size || `row ${i + 1}`}`}
                    type="number"
                    min="0"
                    placeholder="0"
                    value={v.stock_quantity}
                    style={{ minHeight: "36px", padding: "6px 10px" }}
                    onChange={(e) =>
                      setValue(
                        "variants",
                        variants.map((a, j) =>
                          j === i
                            ? { ...a, stock_quantity: Math.max(0, Number(e.target.value) || 0) }
                            : a,
                        ),
                      )
                    }
                  />
                </td>
                <td>
                  <input
                    aria-label={`Price for ${v.size || `row ${i + 1}`}`}
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Base price"
                    value={v.price === null || v.price === undefined ? "" : v.price}
                    style={{ minHeight: "36px", padding: "6px 10px" }}
                    onChange={(e) =>
                      setValue(
                        "variants",
                        variants.map((a, j) =>
                          j === i
                            ? {
                                ...a,
                                price: e.target.value === "" ? null : Math.max(0, Number(e.target.value)),
                              }
                            : a,
                        ),
                      )
                    }
                  />
                </td>
                <td>
                  <input
                    aria-label={`SKU for ${v.size || `row ${i + 1}`}`}
                    placeholder="Variant SKU"
                    value={v.sku || ""}
                    style={{ minHeight: "36px", padding: "6px 10px" }}
                    onChange={(e) =>
                      setValue(
                        "variants",
                        variants.map((a, j) =>
                          j === i ? { ...a, sku: e.target.value } : a,
                        ),
                      )
                    }
                  />
                </td>
                <td>
                  <label className="checkbox-field" style={{ margin: 0, justifyContent: "center" }}>
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
                  </label>
                </td>
                <td>
                  <button
                    className="icon-button"
                    type="button"
                    aria-label={`Remove ${v.size || `size ${i + 1}`}`}
                    disabled={variants.length === 1}
                    style={{ opacity: variants.length === 1 ? 0.3 : 1 }}
                    onClick={() => {
                      takeSnapshot();
                      setValue(
                        "variants",
                        variants.filter((_, j) => j !== i),
                      );
                    }}
                  >
                    <Trash2 size={15} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="variant-table-actions" style={{ display: "flex", gap: "12px", alignItems: "center", marginTop: "12px", flexWrap: "wrap" }}>
        <button
          className="button outline"
          type="button"
          onClick={() => {
            takeSnapshot();
            setValue("variants", [
              ...variants,
              { size: "", stock_quantity: 0, active: true, sku: "", price: null },
            ]);
          }}
        >
          <Plus size={15} />
          Add size
        </button>

        <button
          className="button outline"
          type="button"
          onClick={() => {
            takeSnapshot();
            const defaults = [
              { size: "S", stock_quantity: 5, active: true, sku: "", price: null },
              { size: "M", stock_quantity: 10, active: true, sku: "", price: null },
              { size: "L", stock_quantity: 8, active: true, sku: "", price: null },
              { size: "XL", stock_quantity: 3, active: true, sku: "", price: null },
              { size: "2XL", stock_quantity: 4, active: true, sku: "", price: null },
              { size: "3XL", stock_quantity: 0, active: true, sku: "", price: null },
            ];
            setValue("variants", defaults);
            toast.success("Standard sizes (S to 3XL) applied");
          }}
        >
          Reset to default sizes (S–3XL)
        </button>

        <span className="variant-total-stock" style={{ marginLeft: "auto", fontSize: "12px", color: "var(--muted)" }}>
          Total stock: <strong>{variants.reduce((sum, v) => sum + (v.active ? v.stock_quantity : 0), 0)} units</strong>
        </span>
      </div>
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
      <div className="form-actions" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
        <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
          <button type="submit" className="button" disabled={busy}>
            <Save size={15} />
            {busy ? "Saving…" : "Save product"}
          </button>
          <Link className="button outline" href="/admin/products">
            Cancel
          </Link>
        </div>
        <UndoRedoButtons
          canUndo={canUndo}
          canRedo={canRedo}
          onUndo={handleUndo}
          onRedo={handleRedo}
          undoCount={undoCount}
          redoCount={redoCount}
        />
      </div>
    </form>
  );
}
