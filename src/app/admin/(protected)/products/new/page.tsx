import { adminTaxonomies } from "@/lib/admin-data";
import { ProductForm } from "@/components/admin/product-form";
export default async function NewProduct() {
  const [categories, collections] = await Promise.all([
    adminTaxonomies("categories"),
    adminTaxonomies("collections"),
  ]);
  return (
    <>
      <div className="admin-page-title">
        <div>
          <h1>A new piece</h1>
          <p>Add the details, photographs, and available sizes.</p>
        </div>
      </div>
      <ProductForm categories={categories} collections={collections} />
    </>
  );
}
