import test from "node:test";
import assert from "node:assert/strict";
import {
  customerSchema,
  enquirySchema,
  productSchema,
  subcategorySchema,
  settingsSchema,
} from "../src/lib/validations/index";
import { money, paise, stockTotal, safeJson, imageUrl } from "../src/lib/utils";
import { buildImageKitUrl, isImageKitUrl } from "../src/lib/imagekit";
import {
  orderMessage,
  whatsappUrl,
  validateWhatsAppNumber,
  productEnquiryMessage,
  productDirectOrderMessage,
  createVendorOrderGroups,
} from "../src/lib/whatsapp/index";
import { defaultStore } from "../src/lib/defaults";
import { demoProducts } from "../src/lib/demo";
import { validateUploadFile } from "../src/lib/validations/image";
import { savedCartSchema } from "../src/lib/cart-validation";
import { sameOrigin } from "../src/lib/request-origin";
const customer = {
  full_name: "Asha Kumar",
  phone: "+91 98765 43210",
  alternate_phone: "",
  address_line_1: "12, Garden Road",
  address_line_2: "Apartment 4",
  city: "Chennai",
  state: "Tamil Nadu",
  pincode: "600001",
  landmark: "Near the park",
  note: "Please confirm the fabric & fit.",
  consent: true,
} as const;
test("checkout validates and normalizes Indian phone and pincode", () => {
  const c = customerSchema.parse(customer);
  assert.equal(c.phone, "919876543210");
  assert.equal(c.note, customer.note);
  assert.equal(
    customerSchema.safeParse({ ...customer, phone: "123" }).success,
    false,
  );
  assert.equal(
    customerSchema.safeParse({ ...customer, pincode: "000000" }).success,
    false,
  );
  assert.equal(
    customerSchema.safeParse({ ...customer, consent: false }).success,
    false,
  );
});
test("enquiry rejects duplicate variants, fake IDs, and negative quantities", () => {
  const item = {
    product_id: "f7454e17-02a2-4073-81c5-f72366da3d21",
    variant_id: "8d3c8fc6-19be-4d86-9e02-7b5732fd984a",
    quantity: 1,
    expected_price: 1299,
  };
  const input = {
    customer,
    items: [item],
    idempotency_key: "30b4e04a-c8ba-4030-85fc-0631169e0cb7",
  };
  assert.ok(enquirySchema.safeParse(input).success);
  assert.equal(
    enquirySchema.safeParse({ ...input, items: [item, item] }).success,
    false,
  );
  assert.equal(
    enquirySchema.safeParse({ ...input, items: [{ ...item, quantity: -1 }] })
      .success,
    false,
  );
  assert.equal(
    enquirySchema.safeParse({
      ...input,
      items: [{ ...item, variant_id: "sample" }],
    }).success,
    false,
  );
});
test("WhatsApp summary encodes Unicode, ampersands, address, and snapshots", () => {
  const c = customerSchema.parse(customer);
  const order = {
    reference: "ACHU-20261002-ABC123",
    subtotal: 5297,
    whatsapp_number: "919876543210",
    items: [
      { name: "Emerald kurti", size: "M", quantity: 1, price: 1299 },
      { name: "Peacock blue kurti", size: "L", quantity: 2, price: 1999 },
    ],
  };
  const message = orderMessage(order, c);
  const link = whatsappUrl(order.whatsapp_number, message)!;
  assert.equal(new URL(link).searchParams.get("text"), message);
  assert.match(message, /₹5,297/);
  assert.match(message, /Quantity: 2/);
  assert.ok(message.includes("fabric & fit"));
  assert.ok(message.includes("Apartment 4"));
  assert.equal(whatsappUrl("", "test"), null);
  assert.equal(whatsappUrl("not-a-number", "test"), null);
});
test("money math uses integer paise and ignores inactive inventory", () => {
  assert.equal(money(1299.5), "₹1,299.5");
  assert.equal(paise(0.1) + paise(0.2), 30);
  assert.equal(
    stockTotal([
      { active: true, stock_quantity: 3 },
      { active: false, stock_quantity: 100 },
      { active: true, stock_quantity: 0 },
    ]),
    3,
  );
  assert.equal(money(1299), "₹1,299");
});
test("settings reject script URLs, foreign embeds, and unsupported currencies", () => {
  assert.ok(settingsSchema.safeParse(defaultStore).success);
  assert.equal(
    settingsSchema.safeParse({
      ...defaultStore,
      instagram_url: "javascript:alert(1)",
    }).success,
    false,
  );
  assert.equal(
    settingsSchema.safeParse({
      ...defaultStore,
      map_embed_url: "https://evil.example/maps/embed",
    }).success,
    false,
  );
  assert.equal(
    settingsSchema.safeParse({
      ...defaultStore,
      map_embed_url: "https://www.google.com/search?q=a",
    }).success,
    false,
  );
  assert.equal(
    settingsSchema.safeParse({ ...defaultStore, currency: "USD" }).success,
    false,
  );
});
test("publishing needs images and variants cannot repeat a size", () => {
  const p = demoProducts[1];
  const form = {
    ...p,
    category_id: "f7454e17-02a2-4073-81c5-f72366da3d21",
    variants: p.product_variants.map((v) => ({ ...v, sku: "" })),
    images: p.product_images,
    collection_ids: [],
  };
  assert.ok(productSchema.safeParse(form).success);
  assert.equal(productSchema.safeParse({ ...form, images: [] }).success, false);
  assert.equal(
    productSchema.safeParse({
      ...form,
      variants: [form.variants[0], form.variants[0]],
    }).success,
    false,
  );
  assert.equal(
    productSchema.safeParse({ ...form, selling_price: 1.999 }).success,
    false,
  );
});
test("JSON-LD cannot close a script tag from admin content", () => {
  assert.equal(
    safeJson({ name: "</script><script>alert(1)</script>" }).includes(
      "</script>",
    ),
    false,
  );
});
test("upload validation accepts actual image bytes and rejects disguised files and oversize input", async () => {
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aY9sAAAAASUVORK5CYII=",
    "base64",
  );
  const image = await validateUploadFile(
    new File([png], "fixture.png", { type: "image/png" }),
  );
  assert.equal(image.extension, "png");
  await assert.rejects(
    validateUploadFile(
      new File(["<svg/>"], "fixture.svg", { type: "image/svg+xml" }),
    ),
    /JPG/,
  );
  await assert.rejects(
    validateUploadFile(
      new File(["not an image"], "disguised.png", { type: "image/png" }),
    ),
    /file content/,
  );
  await assert.rejects(
    validateUploadFile(
      new File([png.subarray(0, 8)], "truncated.png", { type: "image/png" }),
    ),
    /valid, non-animated/,
  );
  await assert.rejects(
    validateUploadFile(
      new File([new Uint8Array(3145729)], "large.png", { type: "image/png" }),
    ),
    /3 MB/,
  );
});
test("persisted cart rejects malformed quantities, remote image injection, and duplicate variants", () => {
  const p = demoProducts[0];
  const i = {
    product_id: p.id,
    variant_id: p.product_variants[0].id,
    name: p.name,
    slug: p.slug,
    size: "FREE SIZE",
    image: "/images/saree.png",
    price: 3490,
    quantity: 1,
    stock: 4,
  };
  assert.ok(savedCartSchema.safeParse({ items: [i] }).success);
  assert.equal(
    savedCartSchema.safeParse({ items: [{ ...i, quantity: -1 }] }).success,
    false,
  );
  assert.equal(
    savedCartSchema.safeParse({
      items: [{ ...i, image: "https://evil.example/image.png" }],
    }).success,
    false,
  );
  assert.equal(savedCartSchema.safeParse({ items: [i, i] }).success, false);
});
test("origin validation uses the browser-facing host and rejects foreign protocols, ports, and malformed origins", () => {
  assert.equal(
    sameOrigin("http://localhost:3000", "localhost:3000", "http:"),
    true,
  );
  assert.equal(
    sameOrigin("https://achu.example", "achu.example", "https:"),
    true,
  );
  assert.equal(
    sameOrigin("https://evil.example", "achu.example", "https:"),
    false,
  );
  assert.equal(
    sameOrigin("http://achu.example", "achu.example", "https:"),
    false,
  );
  assert.equal(
    sameOrigin("http://localhost:3001", "localhost:3000", "http:"),
    false,
  );
  assert.equal(sameOrigin(null, "localhost:3000", "http:"), false);
  assert.equal(sameOrigin("null", "localhost:3000", "http:"), false);
});
test("admin authentication accepts achu/1234 credentials and verifies secure signed session token", async () => {
  const { checkAdminCredentials, signAdminToken, verifyAdminToken } =
    await import("../src/lib/admin-auth");
  assert.equal(checkAdminCredentials("achu", "1234"), true);
  assert.equal(checkAdminCredentials("ACHU", "1234"), true);
  assert.equal(checkAdminCredentials("  achu  ", "1234"), true);
  assert.equal(checkAdminCredentials("achu@achuboutique.com", "1234"), true);
  assert.equal(checkAdminCredentials("achu", "wrongpass"), false);
  assert.equal(checkAdminCredentials("unknown", "1234"), false);
  assert.equal(checkAdminCredentials("", "1234"), false);

  const token = await signAdminToken("achu");
  assert.ok(typeof token === "string" && token.length > 20);
  assert.equal(await verifyAdminToken(token), true);
  assert.equal(await verifyAdminToken(token + "tampered"), false);
  assert.equal(await verifyAdminToken("invalid.token"), false);
  assert.equal(await verifyAdminToken(null), false);
  assert.equal(await verifyAdminToken(""), false);
});
test("subcategory validation requires parent category UUID, valid slug and positive order", () => {
  const valid = {
    category_id: "f7454e17-02a2-4073-81c5-f72366da3d21",
    name: "Stone work",
    slug: "stone-work",
    description: "Detailed embellishments",
    image: "/images/saree.png",
    active: true,
    display_order: 1,
  };
  assert.ok(subcategorySchema.safeParse(valid).success);
  assert.equal(
    subcategorySchema.safeParse({ ...valid, slug: "Invalid Slug With Spaces" })
      .success,
    false,
  );
  assert.equal(
    subcategorySchema.safeParse({ ...valid, category_id: "not-a-uuid" })
      .success,
    false,
  );
  assert.equal(
    subcategorySchema.safeParse({ ...valid, display_order: -1 }).success,
    false,
  );
  assert.equal(
    subcategorySchema.safeParse({ ...valid, name: "" }).success,
    false,
  );
});

test("WhatsApp number validation strictly enforces ITU-T E.164 without leading plus or zeroes", () => {
  assert.equal(validateWhatsAppNumber("919876543210").valid, true);
  assert.equal(validateWhatsAppNumber("+91 98765 43210").valid, true);
  assert.equal(
    validateWhatsAppNumber("+91 98765 43210").normalized,
    "919876543210",
  );
  assert.equal(validateWhatsAppNumber("0987654321").valid, false);
  assert.equal(validateWhatsAppNumber("12345").valid, false);
  assert.equal(validateWhatsAppNumber("").valid, false);
  assert.equal(validateWhatsAppNumber(null).valid, false);
});

test("productEnquiryMessage personalizes greeting for vendor, product, and stock status", () => {
  const product = {
    name: "Banarasi Silk Saree",
    slug: "banarasi-silk-saree",
    vendor_name: "Varanasi Weaves",
  };
  const inStockMsg = productEnquiryMessage(product, {
    variant: { size: "Free Size" },
    currentPrice: 8500,
    inStock: true,
  });
  assert.ok(inStockMsg.includes("Hi Varanasi Weaves"));
  assert.ok(inStockMsg.includes("Banarasi Silk Saree"));
  assert.ok(inStockMsg.includes("Size: Free Size"));
  assert.ok(inStockMsg.includes("Price: ₹8,500"));

  const restockMsg = productEnquiryMessage(product, {
    inStock: false,
    vendorName: "Specialty Vendor",
  });
  assert.ok(restockMsg.includes("Hi Specialty Vendor"));
  assert.ok(restockMsg.includes("restocking"));
});

test("multi-vendor cart creates separate orders with individual WhatsApp URLs and item lists", () => {
  const items = [
    {
      name: "Chanderi Kurti",
      size: "M",
      quantity: 1,
      price: 2499,
      vendor_name: "Vendor Alpha",
      vendor_whatsapp_number: "919800011111",
    },
    {
      name: "Chanderi Dupatta",
      size: "Free Size",
      quantity: 2,
      price: 1200,
      vendor_name: "Vendor Alpha",
      vendor_whatsapp_number: "919800011111",
    },
    {
      name: "Kanjivaram Saree",
      size: "Free Size",
      quantity: 1,
      price: 9999,
      vendor_name: "Vendor Beta",
      vendor_whatsapp_number: "919800022222",
    },
  ];

  const defaultVendor = {
    name: "Achu Designer Boutique",
    whatsapp_number: "919876543210",
  };

  const groups = createVendorOrderGroups(
    items,
    defaultVendor,
    null,
    "TEST-REF-123",
  );
  assert.equal(groups.length, 2);

  const groupA = groups.find((g) => g.vendor_name === "Vendor Alpha");
  assert.ok(groupA);
  assert.equal(groupA.whatsapp_number, "919800011111");
  assert.equal(groupA.items.length, 2);
  assert.equal(groupA.subtotal, 4899);
  assert.ok(groupA.whatsapp_url?.startsWith("https://wa.me/919800011111"));
  assert.ok(groupA.whatsapp_url?.includes("Chanderi%20Kurti"));
  assert.ok(groupA.whatsapp_url?.includes("Chanderi%20Dupatta"));
  assert.ok(!groupA.whatsapp_url?.includes("Kanjivaram%20Saree"));

  const groupB = groups.find((g) => g.vendor_name === "Vendor Beta");
  assert.ok(groupB);
  assert.equal(groupB.whatsapp_number, "919800022222");
  assert.equal(groupB.items.length, 1);
  assert.equal(groupB.subtotal, 9999);
  assert.ok(groupB.whatsapp_url?.startsWith("https://wa.me/919800022222"));
  assert.ok(groupB.whatsapp_url?.includes("Kanjivaram%20Saree"));
  assert.ok(!groupB.whatsapp_url?.includes("Chanderi%20Kurti"));
});

test("productDirectOrderMessage generates direct purchase pre-filled message with quantity and total", () => {
  const msg = productDirectOrderMessage(
    { name: "Silk Lehenga", slug: "silk-lehenga", vendor_name: "Surat Silks" },
    { variant: { size: "L" }, price: 4500, quantity: 2, vendorName: "Surat Silks" },
  );
  assert.ok(msg.includes("Hi Surat Silks"));
  assert.ok(msg.includes("Product: Silk Lehenga"));
  assert.ok(msg.includes("Size: L"));
  assert.ok(msg.includes("Quantity: 2"));
  assert.ok(msg.includes("Price: ₹4,500 × 2"));
  assert.ok(msg.includes("Total Amount: ₹9,000"));
});

test("ImageKit URL builder formats WebP/AVIF auto delivery, quality compression, and responsive widths", () => {
  const url1 = buildImageKitUrl("products/saree-1.webp");
  assert.ok(
    url1.startsWith(
      "https://ik.imagekit.io/9nwmg4m7o/products/saree-1.webp",
    ),
  );
  assert.ok(url1.includes("tr=f-auto,q-80"));

  const url2 = buildImageKitUrl(
    "https://ik.imagekit.io/9nwmg4m7o/products/saree-1.webp",
    {
      width: 600,
      height: 800,
      quality: 85,
      format: "webp",
    },
  );
  assert.ok(url2.includes("w-600"));
  assert.ok(url2.includes("h-800"));
  assert.ok(url2.includes("q-85"));
  assert.ok(url2.includes("f-webp"));

  // imageUrl utility delivers via ImageKit with f-auto
  const resolved = imageUrl(
    "https://ik.imagekit.io/9nwmg4m7o/products/test.jpg",
  );
  assert.ok(resolved.includes("f-auto"));

  // Local assets are preserved without modification
  assert.equal(imageUrl("/images/saree.png"), "/images/saree.png");
  assert.equal(isImageKitUrl("https://ik.imagekit.io/9nwmg4m7o/test.png"), true);
  assert.equal(isImageKitUrl("/images/saree.png"), false);
});

test("savedCartSchema allows ImageKit URLs and rejects foreign untrusted image origins", () => {
  const validItem = {
    product_id: "prod-1",
    variant_id: "var-1",
    slug: "emerald-silk-saree",
    name: "Emerald Silk Saree",
    size: "Free Size",
    image:
      "https://ik.imagekit.io/9nwmg4m7o/products/emerald-saree.webp?tr=f-auto,q-80",
    price: 3490,
    quantity: 1,
    stock: 5,
  };

  const validCart = savedCartSchema.safeParse({ items: [validItem] });
  assert.equal(validCart.success, true);

  const invalidCart = savedCartSchema.safeParse({
    items: [
      {
        ...validItem,
        image: "https://malicious-site.example/photo.jpg",
      },
    ],
  });
  assert.equal(invalidCart.success, false);
});


