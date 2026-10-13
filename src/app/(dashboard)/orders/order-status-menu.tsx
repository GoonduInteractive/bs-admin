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
import { ORDER_STATUS } from "@/lib/labels";
import type { OrderStatus } from "@/types";
import { setOrderStatusAction } from "./actions";

/** Where an order can go next. A delivered or cancelled order is closed. */
export const NEXT_STATUS: Record<OrderStatus, OrderStatus[]> = {
  pending: ["processing", "cancelled"],
  processing: ["inTransit", "cancelled"],
  inTransit: ["delivered"],
  delivered: [],
  cancelled: [],
};

export function useOrderStatus(id: string, reference: string) {
  const [pending, start] = useTransition();
  const update = (status: OrderStatus) =>
    start(async () => {
      const res = await setOrderStatusAction(id, status);
      if ("error" in res) toast.error(res.error);
      else toast.success(`${reference} marked ${ORDER_STATUS[status].label.toLowerCase()}`);
    });
  return { pending, update };
}

export function OrderRowMenu({ id, reference, status }: { id: string; reference: string; status: OrderStatus }) {
  const { pending, update } = useOrderStatus(id, reference);
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
                  {ORDER_STATUS[s].label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
