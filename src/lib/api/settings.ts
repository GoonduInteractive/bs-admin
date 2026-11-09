import "server-only";
import { z } from "zod";
import type { InviteInput } from "@/lib/schemas";
import type { AdminRole, NotificationSettings, StoreSettings, TeamMember } from "@/types";
import { apiFetch } from "./client";

/**
 * Settings (added to the API 2026-10-28):
 *
 *   GET    /v1/admin/settings/team                getTeam()
 *   POST   /v1/admin/settings/team/invite         inviteMember()
 *   POST   /v1/admin/settings/team/accept-invite  acceptInvite()
 *   PATCH  /v1/admin/settings/team/{id}/role      setMemberRole()
 *   DELETE /v1/admin/settings/team/{id}           removeMember()
 *   GET    /v1/admin/settings/store               getStoreSettings()
 *   PUT    /v1/admin/settings/store               saveStoreSettings()
 *   GET    /v1/admin/settings/notifications       getNotificationSettings()
 *   PUT    /v1/admin/settings/notifications       saveNotificationSettings()
 *
 * FLAGGED: the invite email's link has to open `/accept-invite?token=<token>`
 * on this admin; the backend writes that link. The spec marks accept-invite as
 * needing a token, but whoever accepts isn't signed in yet, so it's sent
 * without one. The profile has no role, so the signed-in admin's role is read
 * from the team.
 */

const apiMember = z.object({
  id: z.string(),
  email: z.string(),
  first_name: z.string().nullish(),
  last_name: z.string().nullish(),
  role: z.enum(["owner", "admin", "support"]),
  // null: never signed in.
  last_login_at: z.string().nullish(),
});

function toMember(m: z.output<typeof apiMember>): TeamMember {
  const name = `${m.first_name ?? ""} ${m.last_name ?? ""}`.trim();
  return {
    id: m.id,
    name: name || m.email,
    email: m.email,
    role: m.role,
    lastSeen: m.last_login_at ?? null,
  };
}

const RANK: Record<AdminRole, number> = { owner: 0, admin: 1, support: 2 };

/** Everyone who can sign in to the admin, owners first. */
export async function getTeam(): Promise<TeamMember[]> {
  // The spec says a plain list; the API's other lists come paged, so either is read.
  const list = z.union([z.array(apiMember), z.object({ items: z.array(apiMember) }).transform((p) => p.items)]);
  const team = (await apiFetch("/v1/admin/settings/team", list)).map(toMember);
  return team.sort((a, b) => RANK[a.role] - RANK[b.role] || a.name.localeCompare(b.name));
}

/** Emails them a link to set a password and join. */
export async function inviteMember(v: InviteInput): Promise<void> {
  await apiFetch("/v1/admin/settings/team/invite", z.unknown(), {
    method: "POST",
    body: { email: v.email, first_name: v.firstName, last_name: v.lastName, role: v.role },
  });
}

/** From the invite email, signed out: sets their password, so they can sign in. */
export async function acceptInvite(token: string, password: string): Promise<void> {
  await apiFetch("/v1/admin/settings/team/accept-invite", z.unknown(), { method: "POST", body: { token, password }, token: null });
}

export async function setMemberRole(id: string, role: AdminRole): Promise<void> {
  await apiFetch(`/v1/admin/settings/team/${encodeURIComponent(id)}/role`, z.unknown(), { method: "PATCH", body: { role } });
}

/** They can no longer sign in. */
export async function removeMember(id: string): Promise<void> {
  await apiFetch(`/v1/admin/settings/team/${encodeURIComponent(id)}`, z.unknown(), { method: "DELETE" });
}

const apiStore = z.object({ low_stock_threshold: z.coerce.number() });

export async function getStoreSettings(): Promise<StoreSettings> {
  return { lowStockAt: (await apiFetch("/v1/admin/settings/store", apiStore)).low_stock_threshold };
}

export async function saveStoreSettings(s: StoreSettings): Promise<void> {
  await apiFetch("/v1/admin/settings/store", z.unknown(), { method: "PUT", body: { low_stock_threshold: s.lowStockAt } });
}

const apiNotifications = z.object({
  notify_new_orders: z.boolean(),
  notify_low_stock: z.boolean(),
  notify_tournament_registrations: z.boolean(),
  notify_match_results: z.boolean(),
});

export async function getNotificationSettings(): Promise<NotificationSettings> {
  const n = await apiFetch("/v1/admin/settings/notifications", apiNotifications);
  return { orders: n.notify_new_orders, stock: n.notify_low_stock, registrations: n.notify_tournament_registrations, results: n.notify_match_results };
}

/** All four at once: the API replaces the set. */
export async function saveNotificationSettings(n: NotificationSettings): Promise<void> {
  await apiFetch("/v1/admin/settings/notifications", z.unknown(), {
    method: "PUT",
    body: {
      notify_new_orders: n.orders,
      notify_low_stock: n.stock,
      notify_tournament_registrations: n.registrations,
      notify_match_results: n.results,
    },
  });
}
