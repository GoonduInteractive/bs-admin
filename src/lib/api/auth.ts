import "server-only";
import { cookies } from "next/headers";
import type { AdminUser } from "@/types";
import { mockDelay } from "./client";

/**
 * Admin auth.
 *
 * MOCK: there is no identity service yet. Sign-in is a two-step flow -
 * password, then a six-digit code sent to the admin's email - and both steps
 * are simulated here so the screens and the route guard can be built against
 * the real shape. Any valid email with a password of 8+ characters signs in;
 * the code is always DEMO_CODE.
 *
 * Swap: `signIn` and `verifyCode` become POSTs to the auth service, and the
 * session cookie holds the token it returns instead of the admin's email.
 */

export const SESSION_COOKIE = "bs_admin_session";
export const PENDING_COOKIE = "bs_admin_pending";
export const DEMO_CODE = "123456";

const SESSION_MAX_AGE = 60 * 60 * 8; // one working day

function adminFromEmail(email: string): AdminUser {
  const local = email.split("@")[0] ?? "admin";
  const name = local
    .split(/[._-]/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
  return { id: "adm_0001", name: name || "Admin", email, role: "admin", emailVerified: true };
}

/** Step 1. Checks the password and starts the email-verification step. */
export async function signIn(email: string, password: string): Promise<{ ok: true } | { ok: false; error: string }> {
  await mockDelay(500);
  if (password.length < 8) return { ok: false, error: "Wrong email or password" };
  if (email.toLowerCase().endsWith("@blocked.test")) {
    return { ok: false, error: "This account has been disabled. Contact the studio owner." };
  }
  const jar = await cookies();
  jar.set(PENDING_COOKIE, email, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 10 });
  return { ok: true };
}

/** The email waiting for its code, if a sign-in is in progress. */
export async function getPendingEmail(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(PENDING_COOKIE)?.value ?? null;
}

/** Step 2. Checks the emailed code and opens the session. */
export async function verifyCode(code: string): Promise<{ ok: true } | { ok: false; error: string }> {
  await mockDelay(500);
  const jar = await cookies();
  const email = jar.get(PENDING_COOKIE)?.value;
  if (!email) return { ok: false, error: "Your sign-in has expired. Start again." };
  if (code !== DEMO_CODE) return { ok: false, error: "That code is not right. Check the email and try again." };

  jar.delete(PENDING_COOKIE);
  jar.set(SESSION_COOKIE, email, { httpOnly: true, sameSite: "lax", path: "/", maxAge: SESSION_MAX_AGE });
  return { ok: true };
}

export async function resendCode(): Promise<void> {
  await mockDelay(400);
}

export async function signOut(): Promise<void> {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

export async function getCurrentAdmin(): Promise<AdminUser | null> {
  const jar = await cookies();
  const email = jar.get(SESSION_COOKIE)?.value;
  return email ? adminFromEmail(email) : null;
}
