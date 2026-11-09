"use server";

import { revalidatePath } from "next/cache";
import { failureMessage } from "@/lib/api/client";
import { inviteMember, removeMember, saveNotificationSettings, saveStoreSettings, setMemberRole } from "@/lib/api/settings";
import {
  inviteSchema,
  notificationSettingsSchema,
  storeSettingsSchema,
  type InviteInput,
  type StoreSettingsInput,
} from "@/lib/schemas";
import type { AdminRole, NotificationSettings } from "@/types";

type Result = { ok: true } | { error: string };

const ROLES: readonly AdminRole[] = ["owner", "admin", "support"];

export async function inviteMemberAction(input: InviteInput): Promise<Result> {
  const parsed = inviteSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check their details" };
  try {
    await inviteMember(parsed.data);
  } catch (e) {
    return { error: failureMessage(e, "Couldn't send the invite") };
  }
  revalidatePath("/settings");
  return { ok: true };
}

export async function setMemberRoleAction(id: string, role: AdminRole): Promise<Result> {
  if (!ROLES.includes(role)) return { error: "Unknown role" };
  try {
    await setMemberRole(id, role);
  } catch (e) {
    return { error: failureMessage(e, "Couldn't change their role") };
  }
  revalidatePath("/settings");
  return { ok: true };
}

export async function removeMemberAction(id: string): Promise<Result> {
  try {
    await removeMember(id);
  } catch (e) {
    return { error: failureMessage(e, "Couldn't remove them") };
  }
  revalidatePath("/settings");
  return { ok: true };
}

export async function saveStoreSettingsAction(input: StoreSettingsInput): Promise<Result> {
  const parsed = storeSettingsSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the settings" };
  try {
    await saveStoreSettings(parsed.data);
  } catch (e) {
    return { error: failureMessage(e, "Couldn't save the store settings") };
  }
  revalidatePath("/settings");
  return { ok: true };
}

export async function saveNotificationSettingsAction(input: NotificationSettings): Promise<Result> {
  const parsed = notificationSettingsSchema.safeParse(input);
  if (!parsed.success) return { error: "Unexpected settings" };
  try {
    await saveNotificationSettings(parsed.data);
  } catch (e) {
    return { error: failureMessage(e, "Couldn't save your notifications") };
  }
  return { ok: true };
}
