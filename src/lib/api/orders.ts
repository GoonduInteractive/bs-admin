import "server-only";
import { cache } from "react";
import { z } from "zod";
import type { ApiOrderStatus, Order, OrderLine, OrderStatus, PaymentMethod, Transaction, TransactionStatus } from "@/types";
import { ApiError, NotFoundError, apiFetch, apiFetchAll, fromMinor } from "./client";

/**
 * Orders and the transaction ledger.
 *
 * The API counts money in kobo (`*_minor`); the admin counts whole naira.
 */

const naira = fromMinor;

/* ---- The API's shapes -------------------------------------------------- */

export const API_ORDER_STATUS = {
  pending_payment: "awaitingPayment",
  paid: "pending",
  processing: "processing",
  in_transit: "inTransit",
  delivered: "delivered",
  fulfilled: "delivered",
  cancelled: "cancelled",
  refunded: "refunded",
} as const satisfies Record<ApiOrderStatus, OrderStatus>;

const API_METHOD = { paystack: "paystack", bank_transfer: "bankTransfer" } as const satisfies Record<string, PaymentMethod>;

const orderStatus = z.enum(Object.keys(API_ORDER_STATUS) as [keyof typeof API_ORDER_STATUS]);
const paymentMethod = z.enum(Object.keys(API_METHOD) as [keyof typeof API_METHOD]);

/**
 * A line's product - its title and picture - and whether it ships come in its
 * `variant` (seen 2026-11-02: `variant.product`, `variant.fulfillment`).
 * Top-level `name` and `image` are still read if they're ever sent. The spec
 * makes `sku`, `price_minor` and `quantity` required, but the order list has
 * sent only `variant` since 2026-10-30, so a line can arrive without them: it
 * still counts as a line, with no name or price.
 */
const apiItem = z.object({
  sku: z.string().optional(),
  price_minor: z.coerce.number().optional(),
  quantity: z.number().optional(),
  name: z.string().optional(),
  image: z.string().optional(),
  variant: z
    .object({
      color: z.string().nullish(),
      size: z.union([z.string(), z.number()]).nullish(),
      fulfillment: z.string().nullish(),
      product: z.object({ title: z.string().nullish(), cover_image_url: z.string().nullish() }).nullish(),
    })
    .nullish(),
});

/**
 * One schema for the list item and the detail: the list has `total_minor` and
 * `payment_method`; the detail has the email, phone, shipping, payments and
 * timeline. Whatever a reply leaves out stays out of the `Order`.
 */
const apiOrder = z.object({
  id: z.string(),
  order_number: z.string(),
  created_at: z.string(),
  status: orderStatus,
  payment_method: paymentMethod.nullish(),
  total_minor: z.coerce.number().nullish(),
  customer: z.object({
    full_name: z.string(),
    // A player who signed up on the site has no username until they set one.
    username: z.string().nullish(),
    email: z.string().nullish(),
    phone: z.string().nullish(),
    // Where it goes, in parts since 2026-11-04. An older order or a digital one sends `{}`, though the spec requires
    // `method` and `address`; a pickup has no street address, only its state and local government.
    shipping: z
      .object({
        method: z.string().nullish(),
        address: z.string().nullish(),
        city: z.string().nullish(),
        state: z.string().nullish(),
        lga: z.string().nullish(),
        zipcode: z.string().nullish(),
        country: z.string().nullish(),
      })
      .nullish(),
  }),
  items: z.array(apiItem),
  payments: z
    .array(z.object({ status: z.enum(["initiated", "pending", "succeeded", "failed"]), amount_minor: z.coerce.number(), provider_ref: z.string(), created_at: z.string() }))
    .optional(),
  timelines: z.array(z.object({ status: orderStatus, fulfilled_at: z.string().nullish(), note: z.string().nullish() })).optional(),
});
type ApiOrder = z.output<typeof apiOrder>;

const API_TXN_STATUS = { initiated: "pending", pending: "pending", succeeded: "successful", failed: "failed" } as const satisfies Record<
  string,
  TransactionStatus
>;

const apiTransaction = z.object({
  direction: z.enum(["credit", "debit"]),
  status: z.enum(["pending", "initiated", "succeeded", "failed"]),
  purpose: z.enum(["order", "tournament_entry"]),
  provider: paymentMethod,
  provider_ref: z.string(),
  amount_minor: z.coerce.number(),
  created_at: z.string(),
  order_id: z.string().nullish(),
  tournament_id: z.string().nullish(),
  customer: z.object({ full_name: z.string(), email: z.string() }).nullish(),
});

/* ---- Mapping ----------------------------------------------------------- */

function toLine(i: z.output<typeof apiItem>): OrderLine {
  const product = i.variant?.product;
  const image = i.image ?? product?.cover_image_url;
  // Digital is an online comic, read in the reader: nothing to ship.
  const online = i.variant?.fulfillment === "digital";
  return {
    ...(online ? { kind: "comic" as const, format: "online" as const } : { kind: "product" as const }),
    refId: i.sku ?? "",
    name: i.name ?? product?.title ?? i.sku ?? "—",
    ...(image && { image }),
    ...(i.variant?.color && { colour: i.variant.color }),
    ...(i.variant?.size != null && { size: String(i.variant.size) }),
    quantity: i.quantity ?? 0,
    unitPrice: naira(i.price_minor ?? 0),
  };
}

function toOrder(o: ApiOrder): Order {
  const lines = o.items.map(toLine);
  const subtotal = lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);
  const shipping = o.customer.shipping;
  return {
    id: o.id,
    reference: o.order_number,
    customer: {
      id: o.customer.username || o.customer.email || o.customer.full_name,
      name: o.customer.full_name,
      handle: o.customer.username || o.customer.email || o.customer.full_name,
      ...(o.customer.email && { email: o.customer.email }),
    },
    lines,
    subtotal,
    pointsDiscount: 0,
    total: o.total_minor != null ? naira(o.total_minor) : subtotal,
    status: API_ORDER_STATUS[o.status],
    apiStatus: o.status,
    ...(o.payment_method && { paymentMethod: API_METHOD[o.payment_method] }),
    // Whether anything ships is the lines' (`fulfillment`); where it goes is shown when the API sends it.
    ...(shipping?.method && { deliveryMethod: /pickup/i.test(shipping.method) ? "pickup" : "homeDelivery" }),
    ...((shipping?.address || shipping?.state || shipping?.lga) && {
      shippingAddress: {
        ...(shipping.address && { line1: shipping.address }),
        ...(shipping.city && { city: shipping.city }),
        ...(shipping.lga && { lga: shipping.lga }),
        ...(shipping.state && { state: shipping.state }),
        ...(shipping.zipcode && { zipcode: shipping.zipcode }),
        ...(shipping.country && { country: shipping.country }),
        ...(o.customer.phone && { phone: o.customer.phone }),
      },
    }),
    placedAt: o.created_at,
    timeline: (o.timelines ?? [])
      .filter((t) => t.fulfilled_at)
      .map((t) => ({ status: API_ORDER_STATUS[t.status], at: t.fulfilled_at! })),
    // The detail sends every stage, reached or not; the list sends none.
    ...(o.timelines?.length && { stages: o.timelines.map((t) => API_ORDER_STATUS[t.status]) }),
  };
}

function toTransaction(t: z.output<typeof apiTransaction>, i: number): Transaction {
  const tournament = t.purpose === "tournament_entry";
  return {
    // The API's ledger rows carry no id of their own; the provider's reference is the closest.
    id: `${t.provider_ref}-${i}`,
    reference: t.provider_ref,
    type: t.direction === "debit" ? (tournament ? "prizePayout" : "refund") : tournament ? "tournamentEntry" : "order",
    direction: t.direction === "credit" ? "in" : "out",
    amount: naira(t.amount_minor),
    status: API_TXN_STATUS[t.status],
    method: API_METHOD[t.provider],
    party: { name: t.customer?.full_name ?? "Unknown", email: t.customer?.email ?? "" },
    ...((t.order_id || t.tournament_id) && { relatedId: (t.order_id || t.tournament_id)! }),
    createdAt: t.created_at,
  };
}

/* ---- Orders ------------------------------------------------------------ */

export async function getOrders(): Promise<Order[]> {
  return (await apiFetchAll("/v1/admin/orders", apiOrder)).map(toOrder);
}

/** One order with its payments. Cached per request: the order page reads it twice (the order, then its payments). */
const getApiOrder = cache(async (id: string): Promise<ApiOrder> => {
  try {
    return await apiFetch(`/v1/admin/orders/${encodeURIComponent(id)}`, apiOrder);
  } catch (e) {
    if (e instanceof ApiError && (e.status === 404 || e.status === 400)) throw new NotFoundError("Order", id);
    throw e;
  }
});

export async function getOrder(id: string): Promise<Order> {
  return toOrder(await getApiOrder(id));
}

/**
 * Move an order to a status, named as the API names it. Cancelling is its own
 * endpoint; every other move is the timeline endpoint, and the API decides
 * whether it allows that move from where the order stands.
 */
export async function updateOrderStatus(id: string, to: ApiOrderStatus): Promise<void> {
  const path = `/v1/admin/orders/${encodeURIComponent(id)}`;
  if (to === "cancelled") {
    await apiFetch(`${path}/cancel`, z.unknown(), { method: "PATCH" });
    return;
  }
  await apiFetch(`${path}/timelines`, z.unknown(), { method: "PATCH", body: { to } });
}

/** The Orders page's headline counts. */
export type OrderStats = { total: number; awaitingAction: number; inTransit: number; delivered: number; cancelled: number };

const apiOrderStats = z.object({
  total: z.number(),
  cancelled: z.number(),
  awaiting_action: z.number(),
  delivered: z.number(),
  in_transit: z.number(),
});

export async function getOrderStats(): Promise<OrderStats> {
  const s = await apiFetch("/v1/admin/orders/stats", apiOrderStats);
  return { total: s.total, awaitingAction: s.awaiting_action, inTransit: s.in_transit, delivered: s.delivered, cancelled: s.cancelled };
}

/* ---- Transactions ------------------------------------------------------ */

export async function getTransactions(): Promise<Transaction[]> {
  return (await apiFetchAll("/v1/admin/transactions", apiTransaction)).map(toTransaction);
}

/** The money moved for one order: its own payments, from the order record. */
export async function getTransactionsFor(relatedId: string): Promise<Transaction[]> {
  const o = await getApiOrder(relatedId);
  return (o.payments ?? []).map((p, i) => ({
    id: `${p.provider_ref}-${i}`,
    reference: p.provider_ref,
    type: "order",
    direction: "in",
    amount: naira(p.amount_minor),
    status: API_TXN_STATUS[p.status],
    method: o.payment_method ? API_METHOD[o.payment_method] : "paystack",
    party: { name: o.customer.full_name, email: o.customer.email ?? "" },
    relatedId,
    createdAt: p.created_at,
  }));
}
