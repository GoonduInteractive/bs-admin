"use client";

import { Loader2 } from "lucide-react";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { ORDER_STATUS } from "@/lib/labels";
import type { OrderStatus } from "@/types";
import { NEXT_STATUS, useOrderStatus } from "../order-status-menu";

const VERB: Partial<Record<OrderStatus, string>> = {
  processing: "Start processing",
  inTransit: "Mark as shipped",
  delivered: "Mark as delivered",
};

export function OrderActions({ id, reference, status }: { id: string; reference: string; status: OrderStatus }) {
  const { pending, update } = useOrderStatus(id, reference);
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
          {VERB[forward] ?? `Mark ${ORDER_STATUS[forward].label.toLowerCase()}`}
        </Button>
      )}
    </>
  );
}
