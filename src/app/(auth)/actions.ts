"use server";

import { redirect } from "next/navigation";
import { resendCode, signIn, signOut, verifyCode } from "@/lib/api/auth";
import { failureMessage } from "@/lib/api/client";
import { acceptInvite } from "@/lib/api/settings";
import {
  acceptInviteSchema,
  loginSchema,
  verifySchema,
  type AcceptInviteInput,
  type LoginInput,
  type VerifyInput,
} from "@/lib/schemas";

export type ActionResult = { error: string } | undefined;

/** Only same-site paths survive the round trip - never an open redirect. */
function safeNext(next: string | undefined) {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

export async function loginAction(input: LoginInput, next?: string): Promise<ActionResult> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check your details" };

  const result = await signIn(parsed.data.email, parsed.data.password);
  if (!result.ok) return { error: result.error };

  const target = safeNext(next);
  redirect(target === "/" ? "/verify-email" : `/verify-email?next=${encodeURIComponent(target)}`);
}

export async function verifyAction(input: VerifyInput, next?: string): Promise<ActionResult> {
  const parsed = verifySchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Enter the code" };

  const result = await verifyCode(parsed.data.code);
  if (!result.ok) return { error: result.error };

  redirect(safeNext(next));
}

export async function resendAction(): Promise<ActionResult> {
  const result = await resendCode();
  if (!result.ok) return { error: result.error };
}

/** From the invite email: sets their password, then on to sign in. */
export async function acceptInviteAction(token: string, input: AcceptInviteInput): Promise<ActionResult> {
  const parsed = acceptInviteSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check your password" };
  try {
    await acceptInvite(token, parsed.data.password);
  } catch (e) {
    return { error: failureMessage(e, "Couldn't accept the invite. Try again.") };
  }
  redirect("/login?joined=1");
}

export async function logoutAction(): Promise<void> {
  await signOut();
  redirect("/login");
}
