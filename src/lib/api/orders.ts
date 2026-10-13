import "server-only";
import type { Order, OrderStatus, Transaction } from "@/types";
import { ORDERS } from "@/lib/mock/orders";
import { TRANSACTIONS } from "@/lib/mock/transactions";
import { NotFoundError, mockDelay } from "./client";

/** Orders and the transaction ledger. MOCK - see `merch.ts` for the swap rule. */

export async function getOrders(): Promise<Order[]> {
  await mockDelay();
  return [...ORDERS];
}

export async function getOrder(id: string): Promise<Order> {
  await mockDelay();
  const order = ORDERS.find((o) => o.id === id);
  if (!order) throw new NotFoundError("Order", id);
  return order;
}

export async function updateOrderStatus(id: string, status: OrderStatus): Promise<Order> {
  await mockDelay();
  const order = ORDERS.find((o) => o.id === id);
  if (!order) throw new NotFoundError("Order", id);
  order.status = status;
  order.timeline = [...order.timeline, { status, at: new Date().toISOString() }];
  return order;
}

export async function getTransactions(): Promise<Transaction[]> {
  await mockDelay();
  return [...TRANSACTIONS];
}

export async function getTransactionsFor(relatedId: string): Promise<Transaction[]> {
  await mockDelay(0);
  return TRANSACTIONS.filter((t) => t.relatedId === relatedId);
}
