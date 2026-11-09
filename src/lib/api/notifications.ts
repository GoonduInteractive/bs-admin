import "server-only";
import { z } from "zod";
import { apiFetch } from "./client";

/**
 * The admin's notifications: what the API tells admins about (since the spec of
 * 2026-10-27). The bell shows them beside its own "Needs attention" list.
 *
 *   GET   /v1/admin/notifications            getNotifications(): the latest, and the unread count
 *   PATCH /v1/admin/notifications/{id}/read  markNotificationRead(id)
 *   PATCH /v1/admin/notifications/read-all   markAllNotificationsRead()
 *
 * `GET /v1/admin/notifications/{id}` isn't used: the list carries everything
 * the bell shows.
 *
 * A notification names what it's about with `context` and `context_id`. The
 * values aren't documented, so the obvious ones link to their page (`HREF`)
 * and anything else is shown without a link. FLAGGED: confirm the contexts.
 */

export type AdminNotification = {
  id: string;
  title: string;
  body: string;
  read: boolean;
  sentAt: string;
  /** Where it's about, when the admin has a page for it. */
  href?: string;
};

/** How many the bell shows. */
const LATEST = 20;

const HREF: Record<string, (id: string | null) => string> = {
  order: (id) => (id ? `/orders/${encodeURIComponent(id)}` : "/orders"),
  transaction: () => "/transactions",
  product: (id) => (id ? `/products/${encodeURIComponent(id)}` : "/products"),
  comic: () => "/comics",
  shipping: () => "/shipping",
  tournament: () => "/tournaments",
  player: () => "/players",
  region: () => "/regions",
  note: () => "/notes",
};

const apiNotification = z.object({
  id: z.string(),
  title: z.string(),
  body: z.string(),
  read: z.boolean(),
  sent_at: z.string(),
  context: z.string().nullish(),
  context_id: z.string().nullish(),
});

/** "orders", "Order", "ORDER_PAID" all read as `order`. */
const contextKey = (context: string) => Object.keys(HREF).find((k) => context.toLowerCase().replace(/[^a-z]/g, "").startsWith(k));

function toNotification(n: z.output<typeof apiNotification>): AdminNotification {
  const key = n.context ? contextKey(n.context) : undefined;
  return {
    id: n.id,
    title: n.title,
    body: n.body,
    read: n.read,
    sentAt: n.sent_at,
    ...(key && { href: HREF[key](n.context_id ?? null) }),
  };
}

/** The latest notifications and how many are unread. */
export async function getNotifications(): Promise<{ items: AdminNotification[]; unread: number }> {
  const reply = await apiFetch(
    "/v1/admin/notifications",
    z.object({ items: z.array(apiNotification), unread_count: z.coerce.number().default(0) }),
    { query: { page: 1, limit: LATEST } },
  );
  return { items: reply.items.map(toNotification), unread: reply.unread_count };
}

export async function markNotificationRead(id: string): Promise<void> {
  await apiFetch(`/v1/admin/notifications/${encodeURIComponent(id)}/read`, z.unknown(), { method: "PATCH" });
}

export async function markAllNotificationsRead(): Promise<void> {
  await apiFetch("/v1/admin/notifications/read-all", z.unknown(), { method: "PATCH" });
}
