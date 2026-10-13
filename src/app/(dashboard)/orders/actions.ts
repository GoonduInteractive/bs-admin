"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { updateOrderStatus } from "@/lib/api/orders";

const input = z.object({
  id: z.string().min(1),
  status: z.enum(["pending", "processing", "inTransit", "delivered", "cancelled"]),
});

export async function setOrderStatusAction(id: string, status: string) {
  const parsed = input.safeParse({ id, status });
  if (!parsed.success) return { error: "Unknown status" };
  await updateOrderStatus(parsed.data.id, parsed.data.status);
  revalidatePath("/orders");
  revalidatePath(`/orders/${id}`);
  revalidatePath("/");
  return { ok: true as const };
}
