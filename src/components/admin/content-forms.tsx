"use client";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { Save, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { saveHomepage, saveSettings, savePolicies } from "@/lib/admin-client";
import { ImageUploader } from "./image-uploader";
import type { Homepage, StoreSettings, Taxonomy, Policy } from "@/types";
type Field = {
  key: string;
  label: string;
  kind?: "area" | "number" | "image" | "checkbox" | "collection";
  required?: boolean;
  full?: boolean;
};
const storeFields: Field[] = [
  { key: "business_name", label: "Business name", required: true },
  { key: "currency", label: "Currency (INR)", required: true },
  { key: "whatsapp_number", label: "WhatsApp number, with country code" },
  { key: "phone_number", label: "Phone number, with country code" },
  { key: "instagram_url", label: "Instagram profile URL" },
  { key: "email", label: "Contact email" },
  { key: "address", label: "Store address", kind: "area", full: true },
  { key: "maps_url", label: "Google Maps / directions URL" },
  { key: "map_embed_url", label: "Google Maps embed URL" },
  { key: "opening_hours", label: "Opening hours" },
  { key: "low_stock_threshold", label: "Low stock threshold", kind: "number" },
  {
    key: "about_heading",
    label: "About page heading",
    full: true,
    required: true,
  },
  {
    key: "about_story",
    label: "Your boutique story",
    kind: "area",
    full: true,
  },
  {
    key: "about_philosophy",
    label: "Collection philosophy",
    kind: "area",
    full: true,
  },
];
const homeFields: Field[] = [
  { key: "hero_enabled", label: "Show hero", kind: "checkbox" },
  {
    key: "hero_heading",
    label: "Hero heading (line breaks supported)",
    kind: "area",
    required: true,
  },
  { key: "hero_subtitle", label: "Hero subtitle", kind: "area" },
  { key: "hero_image", label: "Hero photograph", kind: "image", full: true },
  {
    key: "hero_mobile_image",
    label: "Mobile hero photograph (optional)",
    kind: "image",
    full: true,
  },
  { key: "primary_text", label: "Primary button text", required: true },
  { key: "primary_url", label: "Primary button destination", required: true },
  { key: "secondary_text", label: "Secondary button text" },
  {
    key: "secondary_url",
    label: "Secondary button destination",
    required: true,
  },
  {
    key: "featured_collection_id",
    label: "Featured collection",
    kind: "collection",
  },
  { key: "featured_title", label: "Featured heading", required: true },
  {
    key: "featured_description",
    label: "Featured description",
    kind: "area",
    full: true,
  },
  {
    key: "featured_image",
    label: "Featured photograph override",
    kind: "image",
    full: true,
  },
  { key: "promo_heading", label: "Promotional heading", required: true },
  { key: "promo_subtitle", label: "Promotional subtitle", kind: "area" },
  {
    key: "promo_image",
    label: "Promotional photograph",
    kind: "image",
    full: true,
  },
  { key: "promo_text", label: "Promotional button text", required: true },
  { key: "promo_url", label: "Promotional destination", required: true },
  ...[
    "categories",
    "new_arrivals",
    "featured",
    "best_sellers",
    "promo",
    "instagram",
    "store",
  ].map((section) => ({
    key: `show_${section}`,
    label: `Show ${section.replaceAll("_", " ")}`,
    kind: "checkbox" as const,
  })),
];
export function ContentForm({
  kind,
  values,
  collections = [],
}: {
  kind: "settings" | "homepage";
  values: StoreSettings | Homepage;
  collections?: Taxonomy[];
}) {
  const fields = kind === "settings" ? storeFields : homeFields;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors },
  } = useForm<Record<string, unknown>>({ defaultValues: { ...values } });
  const formValues = useWatch({ control });
  const guide = (formValues.size_guide || []) as StoreSettings["size_guide"];
  return (
    <form
      className="admin-form"
      onSubmit={handleSubmit(async (data) => {
        setBusy(true);
        setError("");
        const result =
          kind === "settings"
            ? await saveSettings(data)
            : await saveHomepage(data);
        setBusy(false);
        if (result.ok) toast.success("Settings saved");
        else {
          setError(result.error || "Unable to save.");
          toast.error(result.error);
        }
      })}
      noValidate
    >
      <h2>
        {kind === "settings" ? "Your boutique details" : "Create your homepage"}
      </h2>
      <p className="summary-note">
        {kind === "settings"
          ? "Leave unavailable contact details blank. Add genuine store information before enabling live enquiries."
          : "Changes appear on the storefront after saving. Button destinations must be local paths such as /shop."}
      </p>
      <div className="form-grid">
        {fields.map((field) => {
          const value = String(formValues[field.key] || "");
          return field.kind === "checkbox" ? (
            <label key={field.key} className="checkbox-field">
              <input type="checkbox" {...register(field.key)} />
              {field.label}
            </label>
          ) : (
            <label
              key={field.key}
              className={`field ${field.full ? "full" : ""}`}
            >
              <span>
                {field.label}
                {field.required ? " *" : ""}
              </span>
              {field.kind === "image" ? (
                <ImageUploader
                  folder="banners"
                  multiple={false}
                  images={
                    value
                      ? [
                          {
                            storage_path: value,
                            alt_text: field.label,
                            sort_order: 0,
                            is_cover: true,
                          },
                        ]
                      : []
                  }
                  onChange={(images) =>
                    setValue(field.key, images[0]?.storage_path || "")
                  }
                />
              ) : field.kind === "area" ? (
                <textarea
                  {...register(field.key, { required: field.required })}
                  rows={4}
                />
              ) : field.kind === "collection" ? (
                <select {...register(field.key)}>
                  <option value="">No featured collection</option>
                  {collections.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type={field.kind === "number" ? "number" : "text"}
                  min={field.kind === "number" ? 0 : undefined}
                  {...register(field.key, {
                    required: field.required,
                    valueAsNumber: field.kind === "number",
                  })}
                />
              )}{" "}
              {errors[field.key] && (
                <small className="field-error">This field is required.</small>
              )}
            </label>
          );
        })}
      </div>
      {kind === "settings" && (
        <>
          <h3>Size guide</h3>
          <p className="summary-note">
            Enter actual measurements with their units (for example “36 in”).
            Leave this empty until your measurements are confirmed.
          </p>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  {["Size", "Bust", "Waist", "Hip", "Length", "Remove"].map(
                    (s) => (
                      <th key={s}>{s}</th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {guide.map((row, i) => (
                  <tr key={i}>
                    {(["size", "bust", "waist", "hip", "length"] as const).map(
                      (key) => (
                        <td key={key}>
                          <input
                            style={{ minWidth: 90 }}
                            aria-label={`${key} for size guide row ${i + 1}`}
                            value={row[key]}
                            onChange={(e) =>
                              setValue(
                                "size_guide",
                                guide.map((r, j) =>
                                  j === i ? { ...r, [key]: e.target.value } : r,
                                ),
                              )
                            }
                          />
                        </td>
                      ),
                    )}
                    <td>
                      <button
                        type="button"
                        className="icon-button"
                        aria-label={`Remove size guide row ${i + 1}`}
                        onClick={() =>
                          setValue(
                            "size_guide",
                            guide.filter((_, j) => j !== i),
                          )
                        }
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            type="button"
            className="button outline"
            style={{ marginTop: 15 }}
            onClick={() =>
              setValue("size_guide", [
                ...guide,
                { size: "", bust: "", waist: "", hip: "", length: "" },
              ])
            }
          >
            <Plus size={14} />
            Add size
          </button>
        </>
      )}
      {error && (
        <p className="field-error" role="alert" style={{ marginTop: 20 }}>
          {error}
        </p>
      )}
      <div className="form-actions">
        <button className="button" disabled={busy}>
          <Save size={15} />
          {busy ? "Saving…" : "Save settings"}
        </button>
      </div>
    </form>
  );
}
const policyDefaults = [
  { slug: "shipping-policy", title: "Shipping policy", content: "" },
  { slug: "return-exchange", title: "Returns & exchanges", content: "" },
  { slug: "privacy-policy", title: "Privacy policy", content: "" },
  { slug: "terms", title: "Terms & conditions", content: "" },
];
export function PolicyForm({ policies }: { policies: Policy[] }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const { register, handleSubmit } = useForm<{
    policies: { slug: string; title: string; content: string }[];
  }>({
    defaultValues: {
      policies: policyDefaults.map(
        (p) => policies.find((v) => v.slug === p.slug) || p,
      ),
    },
  });
  return (
    <form
      className="admin-form"
      onSubmit={handleSubmit(async (values) => {
        setBusy(true);
        const result = await savePolicies(values.policies);
        setBusy(false);
        if (result.ok) toast.success("Policies saved");
        else setError(result.error || "Unable to save policies.");
      })}
    >
      <h2>Your published policies</h2>
      <p className="setup-note">
        Replace initial notices with your actual policies before accepting
        enquiries. Text is displayed safely as plain text with line breaks.
      </p>
      {policyDefaults.map((p, i) => (
        <div key={p.slug}>
          <h3>{p.title}</h3>
          <input type="hidden" {...register(`policies.${i}.slug`)} />
          <label className="field">
            <span>Page title</span>
            <input
              {...register(`policies.${i}.title`)}
              required
              maxLength={200}
            />
          </label>
          <label className="field" style={{ marginTop: 15 }}>
            <span>Policy text</span>
            <textarea
              {...register(`policies.${i}.content`)}
              required
              rows={10}
              maxLength={30000}
            />
          </label>
        </div>
      ))}
      {error && (
        <p role="alert" className="field-error">
          {error}
        </p>
      )}
      <div className="form-actions">
        <button className="button" disabled={busy}>
          <Save size={15} />
          {busy ? "Saving…" : "Publish policies"}
        </button>
      </div>
    </form>
  );
}
