import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { getIssueOptions } from "../issues";
import { ProductForm } from "../product-form";

export const metadata: Metadata = { title: "Add product" };

/**
 * `?type=comics&comic=<id>` pre-fills the form - how "Add to store" on a chapter lands here.
 */
export default async function NewProductPage({ searchParams }: PageProps<"/products/new">) {
  const { type, comic } = await searchParams;
  const issues = await getIssueOptions();
  return (
    <>
      <PageHeader back={{ href: "/products", label: "Products" }} title="Add product" />
      <ProductForm
        issues={issues}
        start={{
          type: type === "comics" ? "comics" : "apparel",
          comicId: typeof comic === "string" ? comic : undefined,
        }}
      />
    </>
  );
}
