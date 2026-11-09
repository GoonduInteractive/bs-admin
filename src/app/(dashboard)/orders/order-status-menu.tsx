"use client";

import { MoreHorizontal } from "lucide-react";
import Link from "next/link";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { API_ORDER_STATUS_LABEL } from "@/lib/labels";
import type { ApiOrderStatus, OrderStatus } from "@/types";
import { setOrderStatusAction } from "./actions";

/**
 * Where an order can go next, by the API's name for the status. Unpaid, it can
 * only be cancelled. A delivered, cancelled or refunded order is closed.
 */
export const NEXT_STATUS: Record<OrderStatus, ApiOrderStatus[]> = {
  awaitingPayment: ["cancelled"],
  pending: ["processing", "cancelled"],
  processing: ["in_transit", "cancelled"],
  inTransit: ["delivered"],
  delivered: [],
  cancelled: [],
  refunded: [],
};

export function useOrderStatus(id: string, reference: string, current?: ApiOrderStatus) {
  const [pending, start] = useTransition();
  const update = (to: ApiOrderStatus) =>
    start(async () => {
      const label = API_ORDER_STATUS_LABEL[to];
      const res = await setOrderStatusAction(id, to);
      if ("error" in res) toast.error(res.error, { description: current && `${API_ORDER_STATUS_LABEL[current]} to ${label}` });
      else toast.success(`${reference} marked ${label.toLowerCase()}`);
    });
  return { pending, update };
}

export function OrderRowMenu({ id, reference, status, current }: { id: string; reference: string; status: OrderStatus; current?: ApiOrderStatus }) {
  const { pending, update } = useOrderStatus(id, reference, current);
  const next = NEXT_STATUS[status];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label={`Actions for ${reference}`} disabled={pending} />}>
        <MoreHorizontal />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem render={<Link href={`/orders/${id}`} />}>View order</DropdownMenuItem>
        {next.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuLabel>Mark as</DropdownMenuLabel>
              {next.map((s) => (
                <DropdownMenuItem key={s} variant={s === "cancelled" ? "destructive" : "default"} onClick={() => update(s)}>
                  {API_ORDER_STATUS_LABEL[s]}
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
