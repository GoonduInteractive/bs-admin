"use server";

import { revalidatePath } from "next/cache";
import { failureMessage } from "@/lib/api/client";
import { markAllNotificationsRead, markNotificationRead } from "@/lib/api/notifications";

/** The bell is in the layout: every page's copy of it is read again. */
const refresh = () => revalidatePath("/", "layout");

export async function markNotificationReadAction(id: string) {
  if (!id) return { error: "Invalid request" };
  try {
    await markNotificationRead(id);
  } catch (e) {
    return { error: failureMessage(e, "Couldn't mark it read") };
  }
  refresh();
  return { ok: true as const };
}

export async function markAllNotificationsReadAction() {
  try {
    await markAllNotificationsRead();
  } catch (e) {
    return { error: failureMessage(e, "Couldn't mark them read") };
  }
  refresh();
  return { ok: true as const };
}
