export const money = (amount: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
export const paise = (amount: number) => Math.round(Number(amount) * 100);
export const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
export const stockTotal = (
  variants: { active: boolean; stock_quantity: number }[],
) =>
  variants
    .filter((v) => v.active)
    .reduce((sum, v) => sum + v.stock_quantity, 0);
export const safeJson = (value: unknown) =>
  JSON.stringify(value).replace(/</g, "\\u003c");
export const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
export function imageUrl(path: string) {
  if (path.startsWith("/")) return path;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return base && path
    ? `${base}/storage/v1/object/public/boutique/${path}`
    : "/brand/achu-designer-boutique-logo.png";
}
