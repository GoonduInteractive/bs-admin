import { requireHedera } from "@/lib/hedera/mode";
import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { getHbarRate } from "@/lib/api/hedera";
import { StoreItemForm } from "../store-item-form";

export const metadata: Metadata = { title: "New exclusive" };

export default async function NewStoreItemPage() {
  requireHedera();
  const rate = await getHbarRate();
  return (
    <>
      <PageHeader back={{ href: "/hedera/store", label: "Game store" }} title="New exclusive" />
      <StoreItemForm rate={rate} />
    </>
  );
}
