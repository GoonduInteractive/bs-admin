"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { failureMessage } from "@/lib/api/client";
import { updateOrderStatus } from "@/lib/api/orders";
import { API_ORDER_STATUS_LABEL } from "@/lib/labels";
import type { ApiOrderStatus } from "@/types";

const input = z.object({
  id: z.string().min(1),
  status: z.enum(Object.keys(API_ORDER_STATUS_LABEL) as [ApiOrderStatus, ...ApiOrderStatus[]]),
});

export async function setOrderStatusAction(id: string, status: string) {
  const parsed = input.safeParse({ id, status });
  if (!parsed.success) return { error: "Unknown status" };
  try {
    await updateOrderStatus(parsed.data.id, parsed.data.status);
  } catch (e) {
    return { error: failureMessage(e, "Couldn't update the order") };
  }
  revalidatePath("/orders");
  revalidatePath(`/orders/${id}`);
  revalidatePath("/");
  return { ok: true as const };
}
