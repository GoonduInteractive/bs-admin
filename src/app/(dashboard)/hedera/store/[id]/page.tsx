import { requireHedera } from "@/lib/hedera/mode";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { getHbarRate, getStoreItem } from "@/lib/api/hedera";
import { formatCount } from "@/lib/format";
import { storeItemState } from "@/lib/hedera/catalogue";
import { ASSET_FAMILY, STORE_ITEM_STATE } from "@/lib/labels";
import { StoreItemForm } from "../store-item-form";

export const metadata: Metadata = { title: "Edit exclusive" };

export default async function EditStoreItemPage({ params }: PageProps<"/hedera/store/[id]">) {
  requireHedera();
  const { id } = await params;
  const [item, rate] = await Promise.all([getStoreItem(decodeURIComponent(id)), getHbarRate()]);
  if (!item) notFound();

  return (
    <>
      <PageHeader
        back={{ href: "/hedera/store", label: "Game store" }}
        title={
          <span className="flex flex-wrap items-center gap-3">
            {item.name}
            <StatusBadge {...STORE_ITEM_STATE[storeItemState(item)]} className="font-sans text-xs tracking-normal normal-case" />
          </span>
        }
        description={`${ASSET_FAMILY[item.family]} · ${formatCount(item.sold)} ${item.access === "free" ? "claimed" : "sold"} · ${item.id}`}
      />
      <StoreItemForm item={item} rate={rate} />
    </>
  );
}
