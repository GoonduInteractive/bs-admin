import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { NotFoundError } from "@/lib/api/client";
import { getProduct } from "@/lib/api/merch";
import { unitsSold } from "@/lib/comics";
import { formatCount } from "@/lib/format";
import { PRODUCT_TYPE } from "@/lib/labels";
import { getIssueOptions } from "../issues";
import { ProductForm } from "../product-form";

export const metadata: Metadata = { title: "Edit product" };

export default async function EditProductPage({ params }: PageProps<"/products/[id]">) {
  const { id } = await params;
  const product = await getProduct(id).catch((e) => {
    if (e instanceof NotFoundError) notFound();
    throw e;
  });
  const issues = await getIssueOptions();

  return (
    <>
      <PageHeader
        back={{ href: "/products", label: "Products" }}
        title={product.name}
        description={`${PRODUCT_TYPE[product.type]} · ${formatCount(unitsSold(product))} sold · /merch/${product.slug} on the store`}
      />
      <ProductForm product={product} issues={issues} />
    </>
  );
}
