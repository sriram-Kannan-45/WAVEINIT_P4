import { notFound } from "next/navigation";
import { z } from "zod";
import { adminTaxonomies, adminProduct } from "@/lib/admin-data";
import { ProductForm } from "@/components/admin/product-form";
export default async function EditProduct({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const [product, categories, collections] = await Promise.all([
    adminProduct(id),
    adminTaxonomies("categories"),
    adminTaxonomies("collections"),
  ]);
  if (!product) notFound();
  return (
    <>
      <div className="admin-page-title">
        <div>
          <h1>Edit your piece</h1>
          <p>{product.name}</p>
        </div>
      </div>
      <ProductForm
        product={product}
        categories={categories}
        collections={collections}
      />
    </>
  );
}
