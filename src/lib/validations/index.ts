import { z } from "zod";
const short = z.string().trim().max(250).default("");
const text = z.string().trim().max(10000).default("");
const name = z.string().trim().min(1, "This field is required.").max(200);
const slug = z
  .string()
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Use lowercase letters, numbers, and hyphens.",
  )
  .max(200);
const price = z
  .number()
  .min(0)
  .max(9999999)
  .refine(
    (n) =>
      Number.isInteger(Math.round(n * 100)) &&
      Math.abs(n * 100 - Math.round(n * 100)) < 0.000001,
    "Use at most two decimal places.",
  );
const image = z
  .string()
  .max(500)
  .refine(
    (s) =>
      s === "" ||
      /^\/(?!\/)[a-zA-Z0-9/_.-]+$/.test(s) ||
      /^(products|categories|collections|banners)\/[a-zA-Z0-9_.-]+$/.test(s),
    "Upload an image using the image picker.",
  )
  .default("");
const destination = z
  .string()
  .max(300)
  .regex(
    /^\/(?!\/)[a-zA-Z0-9/_?=&.%-]*$/,
    "Use a local page path, such as /shop.",
  );
const phone = z
  .string()
  .trim()
  .transform((s) => s.replace(/[\s()+-]/g, ""));
export const indianPhone = phone.refine(
  (s) => /^(?:91)?[6-9][0-9]{9}$/.test(s),
  "Enter a valid 10-digit Indian mobile number, optionally with +91.",
);
const optionalIndianPhone = z.union([z.literal(""), indianPhone]).default("");
const webUrl = (hosts: string[]) =>
  z
    .string()
    .max(1000)
    .refine((s) => {
      if (!s) return true;
      try {
        const u = new URL(s);
        return (
          u.protocol === "https:" &&
          !u.username &&
          !u.password &&
          hosts.some((h) => u.hostname === h || u.hostname.endsWith("." + h))
        );
      } catch {
        return false;
      }
    }, "Enter a valid HTTPS URL from the expected provider.")
    .default("");
export const taxonomySchema = z.object({
  name,
  slug,
  description: text,
  image,
  active: z.boolean(),
  display_order: z.number().int().min(0),
  featured: z.boolean().optional(),
});
export const productSchema = z
  .object({
    name,
    slug,
    category_id: z.uuid(),
    short_description: text,
    description: text,
    fabric: short,
    colour: short,
    care_instructions: text,
    sku: short,
    keywords: short,
    original_price: price.nullable(),
    selling_price: price,
    status: z.enum(["draft", "active", "hidden"]),
    is_featured: z.boolean(),
    is_new_arrival: z.boolean(),
    is_best_seller: z.boolean(),
    meta_title: short,
    meta_description: short,
    variants: z
      .array(
        z.object({
          size: z.string().trim().min(1).max(40),
          stock_quantity: z.number().int().min(0).max(999999),
          active: z.boolean(),
          sku: short,
        }),
      )
      .min(1)
      .max(30)
      .refine(
        (v) => new Set(v.map((v) => v.size)).size === v.length,
        "Sizes must be unique.",
      ),
    images: z
      .array(
        z.object({
          storage_path: image.refine(Boolean, "An image is required."),
          alt_text: short,
          sort_order: z.number().int().min(0),
          is_cover: z.boolean(),
        }),
      )
      .max(20)
      .refine(
        (images) =>
          !images.length || images.filter((i) => i.is_cover).length === 1,
        "Select exactly one cover image.",
      ),
    collection_ids: z.array(z.uuid()).max(30),
  })
  .refine(
    (p) => p.status !== "active" || p.images.length > 0,
    "Published products need at least one image.",
  );
export const settingsSchema = z.object({
  business_name: name,
  whatsapp_number: phone.refine(
    (s) => !s || /^[1-9]\d{7,14}$/.test(s),
    "Include country code, e.g. 91 followed by your mobile number.",
  ),
  phone_number: phone.refine(
    (s) => !s || /^[1-9]\d{7,14}$/.test(s),
    "Include a valid country code.",
  ),
  instagram_url: webUrl(["instagram.com"]),
  email: z.union([z.literal(""), z.email()]),
  address: text,
  maps_url: webUrl(["google.com", "google.co.in", "maps.app.goo.gl", "goo.gl"]),
  map_embed_url: webUrl(["google.com", "google.co.in"]).refine(
    (s) => !s || new URL(s).pathname.startsWith("/maps/embed"),
    "Use a Google Maps embed URL.",
  ),
  opening_hours: short,
  currency: z.literal("INR"),
  low_stock_threshold: z.number().int().min(0).max(100),
  about_heading: name,
  about_story: text,
  about_philosophy: text,
  size_guide: z
    .array(
      z.object({
        size: name,
        bust: short,
        waist: short,
        hip: short,
        length: short,
      }),
    )
    .max(30),
});
export const homepageSchema = z.object({
  hero_image: image,
  hero_mobile_image: image,
  hero_heading: name,
  hero_subtitle: text,
  hero_enabled: z.boolean(),
  primary_text: name,
  primary_url: destination,
  secondary_text: short,
  secondary_url: destination,
  featured_collection_id: z.union([z.literal(""), z.uuid()]).nullable(),
  featured_title: name,
  featured_description: text,
  featured_image: image,
  promo_image: image,
  promo_heading: name,
  promo_subtitle: text,
  promo_text: name,
  promo_url: destination,
  show_categories: z.boolean(),
  show_new_arrivals: z.boolean(),
  show_featured: z.boolean(),
  show_best_sellers: z.boolean(),
  show_promo: z.boolean(),
  show_instagram: z.boolean(),
  show_store: z.boolean(),
});
export const customerSchema = z.object({
  full_name: z.string().trim().min(2, "Enter your full name.").max(100),
  phone: indianPhone,
  alternate_phone: optionalIndianPhone,
  address_line_1: z
    .string()
    .trim()
    .min(5, "Enter a complete street address.")
    .max(250),
  address_line_2: short,
  city: z.string().trim().min(2).max(100),
  state: z.string().trim().min(2).max(100),
  pincode: z
    .string()
    .regex(/^[1-9][0-9]{5}$/, "Enter a valid 6-digit pincode."),
  landmark: short,
  note: z.string().trim().max(1500).default(""),
  consent: z.literal(true, {
    error: "Please acknowledge how your details will be used.",
  }),
});
export const enquirySchema = z.object({
  customer: customerSchema,
  items: z
    .array(
      z.object({
        product_id: z.uuid(),
        variant_id: z.uuid(),
        quantity: z.number().int().min(1).max(99),
        expected_price: price,
      }),
    )
    .min(1)
    .max(30)
    .refine(
      (items) => new Set(items.map((i) => i.variant_id)).size === items.length,
      "Duplicate cart items.",
    ),
  idempotency_key: z.uuid(),
});
export type CustomerInput = z.input<typeof customerSchema>;
export type Customer = z.output<typeof customerSchema>;
