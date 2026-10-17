import type { Customer } from "@/lib/validations";
import { money, paise, siteUrl } from "@/lib/utils";

/**
 * Validates and normalizes a phone number for WhatsApp links.
 * Must conform to ITU-T E.164 (without '+' or leading zero), 8 to 15 digits.
 */
export function validateWhatsAppNumber(number?: string | null): {
  valid: boolean;
  normalized: string;
  error?: string;
} {
  if (!number) {
    return { valid: false, normalized: "", error: "Phone number is missing." };
  }
  const normalized = number.replace(/\D/g, "");
  if (!/^[1-9][0-9]{7,14}$/.test(normalized)) {
    return {
      valid: false,
      normalized,
      error: "Phone number must include a valid country code (8-15 digits without leading + or 0).",
    };
  }
  return { valid: true, normalized };
}

/**
 * Creates an official wa.me WhatsApp chat URL with encoded prefilled message text.
 * Returns null if the phone number is invalid.
 */
export function whatsappUrl(number: string, message: string): string | null {
  const check = validateWhatsAppNumber(number);
  if (!check.valid) return null;
  return `https://wa.me/${check.normalized}?text=${encodeURIComponent(message)}`;
}

export type OrderItem = {
  name: string;
  size?: string;
  colour?: string;
  quantity: number;
  price: number;
  product_id?: string;
  variant_id?: string;
  vendor_name?: string;
  vendor_whatsapp_number?: string;
};

export type OrderSnapshot = {
  reference: string;
  subtotal: number;
  items: OrderItem[];
  whatsapp_number: string;
  vendor_name?: string;
};

export type VendorOrderGroup = {
  vendor_name: string;
  whatsapp_number: string;
  items: OrderItem[];
  subtotal: number;
  whatsapp_url: string | null;
  reference?: string;
};

/**
 * Builds an encoded pre-filled WhatsApp message containing all relevant order details:
 * - Boutique & Order Reference header
 * - Customer details and delivery address (if collected)
 * - Itemized list with sizes, quantities, unit prices, and subtotals
 * - Total quantity, order total, and PENDING status
 * - Availability confirmation request
 */
export function orderMessage(
  order: OrderSnapshot,
  c?: Customer | null,
  vendorName?: string,
): string {
  const header = vendorName && vendorName !== "Achu Designer Boutique"
    ? `${vendorName.toUpperCase()} — NEW ORDER`
    : "ACHU DESIGNER BOUTIQUE — NEW ORDER";

  const totalQty = order.items.reduce((sum, i) => sum + i.quantity, 0);

  const lines = order.items
    .map((i, n) => {
      const lineSubtotal = (paise(i.price) * i.quantity) / 100;
      const sizeLine = `\nSize: ${i.size || "Standard"}`;
      const colorLine = i.colour ? `\nColor: ${i.colour}` : "";
      return `${n + 1}. ${i.name}${sizeLine}${colorLine}\nQuantity: ${i.quantity}\nUnit Price: ${money(i.price)}\nSubtotal: ${money(lineSubtotal)}`;
    })
    .join("\n\n");

  const orderRefLine = order.reference
    ? `\nOrder Reference: ${order.reference}`
    : "";

  let customerSection = "";
  if (c) {
    const addressLines = [c.address_line_1, c.address_line_2]
      .filter(Boolean)
      .join(", ");
    customerSection = `\n\nCUSTOMER DETAILS\nCustomer Name: ${c.full_name}\nCustomer Phone: ${c.phone}${c.alternate_phone ? `\nAlternate Phone: ${c.alternate_phone}` : ""}\nDelivery Address: ${addressLines}, ${c.city}, ${c.state} - ${c.pincode}${c.landmark ? `\nLandmark: ${c.landmark}` : ""}${c.note ? `\nNote: ${c.note}` : ""}`;
  }

  return `${header}${orderRefLine}${customerSection}\n\n--------------------------------\nORDER ITEMS\n--------------------------------\n\n${lines}\n\n--------------------------------\nTotal Quantity: ${totalQty}\nOrder Total: ${money(order.subtotal)}\nOrder Status: PENDING\n--------------------------------\n\nPlease review the order and confirm availability.\n\nThank you.`;
}

/**
 * Builds a WhatsApp message for a single product enquiry or restock question.
 */
export function productEnquiryMessage(
  product: {
    name: string;
    slug: string;
    vendor_name?: string | null;
  },
  options: {
    variant?: { size: string } | null;
    currentPrice?: number;
    inStock?: boolean;
    vendorName?: string;
    quantity?: number;
  } = {},
): string {
  const vendor =
    options.vendorName ||
    product.vendor_name ||
    "Achu Designer Boutique";
  const link = `${siteUrl}/product/${product.slug}`;

  if (options.inStock === false) {
    return `Hi ${vendor},\n\nI would like to enquire about restocking for:\n\nProduct: ${product.name}\nProduct Link: ${link}`;
  }

  const variantLine = options.variant ? `\nSize: ${options.variant.size}` : "";
  const qtyLine =
    options.quantity && options.quantity > 1
      ? `\nQuantity: ${options.quantity}`
      : "";
  const totalAmount =
    options.currentPrice !== undefined &&
    options.quantity &&
    options.quantity > 1
      ? ` (= ${money((paise(options.currentPrice) * options.quantity) / 100)})`
      : "";
  const priceLine =
    options.currentPrice !== undefined
      ? `\nPrice: ${money(options.currentPrice)}${totalAmount}`
      : "";

  return `Hi ${vendor},\n\nI would like to know more about:\n\nProduct: ${product.name}${variantLine}${qtyLine}${priceLine}\nProduct Link: ${link}`;
}

/**
 * Builds a direct purchase / checkout WhatsApp message for a single product.
 */
export function productDirectOrderMessage(
  product: {
    name: string;
    slug: string;
    vendor_name?: string | null;
  },
  options: {
    variant: { size: string };
    price: number;
    quantity: number;
    vendorName?: string;
  },
): string {
  const vendor =
    options.vendorName ||
    product.vendor_name ||
    "Achu Designer Boutique";
  const link = `${siteUrl}/product/${product.slug}`;
  const total = (paise(options.price) * options.quantity) / 100;

  return `Hi ${vendor} 👋\n\nI would like to purchase this piece via WhatsApp:\n\n--------------------------------\nORDER DETAILS\n--------------------------------\n\nProduct: ${product.name}\nSize: ${options.variant.size}\nQuantity: ${options.quantity}\nPrice: ${money(options.price)}${options.quantity > 1 ? ` × ${options.quantity}` : ""}\nTotal Amount: ${money(total)}\nProduct Link: ${link}\n\nPlease confirm availability and payment details.\n\nThank you.`;
}

/**
 * Groups order or cart items by vendor (based on vendor_whatsapp_number and vendor_name).
 * If items originate from different vendors, handles each vendor's order separately.
 */
export function createVendorOrderGroups(
  items: OrderItem[],
  defaultVendor: { name: string; whatsapp_number: string },
  customer?: Customer | null,
  reference?: string,
): VendorOrderGroup[] {
  if (!items.length) return [];

  const map = new Map<
    string,
    { vendor_name: string; whatsapp_number: string; items: OrderItem[] }
  >();

  for (const item of items) {
    const rawNumber =
      item.vendor_whatsapp_number || defaultVendor.whatsapp_number;
    const check = validateWhatsAppNumber(rawNumber);
    const norm = check.valid ? check.normalized : rawNumber;
    const vendorName =
      item.vendor_name || defaultVendor.name || "Achu Designer Boutique";
    const groupKey = `${vendorName}::${norm}`;

    if (!map.has(groupKey)) {
      map.set(groupKey, {
        vendor_name: vendorName,
        whatsapp_number: norm,
        items: [],
      });
    }
    map.get(groupKey)!.items.push(item);
  }

  const groups: VendorOrderGroup[] = [];
  for (const group of map.values()) {
    const groupSubtotal =
      group.items.reduce(
        (sum, it) => sum + paise(it.price) * it.quantity,
        0,
      ) / 100;

    const groupSnapshot: OrderSnapshot = {
      reference: reference || "",
      subtotal: groupSubtotal,
      items: group.items,
      whatsapp_number: group.whatsapp_number,
      vendor_name: group.vendor_name,
    };

    const message = orderMessage(groupSnapshot, customer, group.vendor_name);
    const url = whatsappUrl(group.whatsapp_number, message);

    groups.push({
      vendor_name: group.vendor_name,
      whatsapp_number: group.whatsapp_number,
      items: group.items,
      subtotal: groupSubtotal,
      whatsapp_url: url,
      reference,
    });
  }

  return groups;
}
