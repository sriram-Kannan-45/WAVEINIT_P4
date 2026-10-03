import Storefront from "@/components/layout/storefront";
export const dynamic = "force-dynamic";
export default async function StoreLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <Storefront>{children}</Storefront>;
}
