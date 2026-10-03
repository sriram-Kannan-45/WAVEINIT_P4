import type { Customer } from "@/lib/validations";
import { money } from "@/lib/utils";
export function whatsappUrl(number: string, message: string) {
  const normalized = number.replace(/\D/g, "");
  if (!/^[1-9][0-9]{7,14}$/.test(normalized)) return null;
  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;
}
export type OrderSnapshot = {
  reference: string;
  subtotal: number;
  items: { name: string; size: string; quantity: number; price: number }[];
  whatsapp_number: string;
};
export function orderMessage(order: OrderSnapshot, c: Customer) {
  const lines = order.items
    .map(
      (i, n) =>
        `${n + 1}. ${i.name}\nSize: ${i.size}\nQuantity: ${i.quantity}\nPrice: ${money(i.price)}${i.quantity > 1 ? ` × ${i.quantity}` : ""}`,
    )
    .join("\n\n");
  return `Hi Achu Designer Boutique 👋\n\nI would like to place an order.\n\nOrder Ref: ${order.reference}\n\n--------------------------------\nORDER DETAILS\n--------------------------------\n\n${lines}\n\n--------------------------------\nSubtotal: ${money(order.subtotal)}\n--------------------------------\n\nCUSTOMER DETAILS\n\nName: ${c.full_name}\nPhone: ${c.phone}${c.alternate_phone ? `\nAlternate phone: ${c.alternate_phone}` : ""}\nAddress: ${[c.address_line_1, c.address_line_2].filter(Boolean).join(", ")}\nCity: ${c.city}\nState: ${c.state}\nPincode: ${c.pincode}${c.landmark ? `\nLandmark: ${c.landmark}` : ""}${c.note ? `\n\nNote:\n${c.note}` : ""}\n\nPlease confirm availability and order details.\n\nThank you.`;
}
