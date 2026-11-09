"use client";

import { Loader2 } from "lucide-react";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { API_ORDER_STATUS_LABEL } from "@/lib/labels";
import type { ApiOrderStatus, OrderStatus } from "@/types";
import { NEXT_STATUS, useOrderStatus } from "../order-status-menu";

const VERB: Partial<Record<ApiOrderStatus, string>> = {
  processing: "Start processing",
  in_transit: "Mark as shipped",
  delivered: "Mark as delivered",
};

export function OrderActions({ id, reference, status, current }: { id: string; reference: string; status: OrderStatus; current?: ApiOrderStatus }) {
  const { pending, update } = useOrderStatus(id, reference, current);
  const next = NEXT_STATUS[status];
  const forward = next.find((s) => s !== "cancelled");

  return (
    <>
      {next.includes("cancelled") && (
        <ConfirmDialog
          trigger={
            <Button variant="outline" size="xl" className="bg-card" disabled={pending}>
              Cancel order
            </Button>
          }
          title={`Cancel ${reference}?`}
          description="The customer is told by email. If they have paid, a refund is raised in Transactions."
          confirmLabel="Cancel order"
          cancelLabel="Keep order"
          destructive
          onConfirm={() => update("cancelled")}
        />
      )}
      {forward && (
        <Button size="xl" disabled={pending} onClick={() => update(forward)}>
          {pending && <Loader2 className="animate-spin" />}
          {VERB[forward] ?? `Mark ${API_ORDER_STATUS_LABEL[forward].toLowerCase()}`}
        </Button>
      )}
    </>
  );
}
