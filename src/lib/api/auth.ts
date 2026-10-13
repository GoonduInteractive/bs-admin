import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import { z } from "zod";
import type { AdminUser } from "@/types";
import { ApiError, LIVE, SESSION_COOKIE, apiFetch, failureMessage, mockDelay } from "./client";

/**
 * Admin auth: a password, then a six-digit code emailed to the admin.
 *
 * LIVE: `POST /v1/admin/auth/login` checks the password and returns a
 * short-lived token, which the pending cookie holds while the admin reads their
 * email. `POST /v1/admin/auth/verify-login` trades that token and the code for
 * the access token, which the session cookie holds until the token expires.
 * The profile is `GET /v1/admin/auth/profile`. There is no refresh token: when
 * the access token runs out, the next call gets a 401 and `apiFetch` sends the
 * admin back to /login.
 *
 * MOCK: any valid email with a password of 8+ characters signs in, and the
 * code is always DEMO_CODE.
 */

export { SESSION_COOKIE };
export const PENDING_COOKIE = "bs_admin_pending";
export const DEMO_CODE = "123456";
/** On mock data: the sign-in screen shows the any-password hint. */
export const DEMO = !LIVE;

/** One working day: the mock's session, and the fallback when a token carries no expiry. */
const SESSION_MAX_AGE = 60 * 60 * 8;
const PENDING_MAX_AGE = 60 * 10;

const COOKIE = { httpOnly: true, sameSite: "lax", path: "/", secure: process.env.NODE_ENV === "production" } as const;

type Result = { ok: true } | { ok: false; error: string };

/** A sign-in waiting for its code: who, and (live) the short token the code is checked against. */
const pendingSchema = z.object({ email: z.string(), token: z.string().optional() });
type Pending = z.infer<typeof pendingSchema>;

async function readPending(): Promise<Pending | null> {
  const raw = (await cookies()).get(PENDING_COOKIE)?.value;
  if (!raw) return null;
  try {
    const parsed = pendingSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

async function writePending(pending: Pending) {
  (await cookies()).set(PENDING_COOKIE, JSON.stringify(pending), { ...COOKIE, maxAge: PENDING_MAX_AGE });
}

/** Seconds until a JWT's `exp`, read without verifying it: only so the cookie expires with the token. */
function secondsLeft(token: string): number {
  try {
    const payload: unknown = JSON.parse(Buffer.from(token.split(".")[1] ?? "", "base64url").toString("utf8"));
    const exp = z.object({ exp: z.number() }).safeParse(payload);
    if (exp.success) return Math.max(0, Math.floor(exp.data.exp - Date.now() / 1000));
  } catch {
    // Not a JWT this can read; fall back to a working day.
  }
  return SESSION_MAX_AGE;
}

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
export async function signIn(email: string, password: string): Promise<Result> {
  if (!LIVE) {
    await mockDelay(500);
    if (password.length < 8) return { ok: false, error: "Wrong email or password" };
    if (email.toLowerCase().endsWith("@blocked.test")) {
      return { ok: false, error: "This account has been disabled. Contact the studio owner." };
    }
    await writePending({ email });
    return { ok: true };
  }

  try {
    const { token } = await apiFetch("/v1/admin/auth/login", z.object({ token: z.string() }), {
      method: "POST",
      body: { sub: email, password },
      token: null,
    });
    await writePending({ email, token });
    return { ok: true };
  } catch (e) {
    // The API says "Invalid Credentials"; the screen has always said this.
    if (e instanceof ApiError && e.status === 401) return { ok: false, error: "Wrong email or password" };
    return { ok: false, error: failureMessage(e, "Sign-in failed. Try again.") };
  }
}

/** The email waiting for its code, if a sign-in is in progress. */
export async function getPendingEmail(): Promise<string | null> {
  return (await readPending())?.email ?? null;
}

/** Step 2. Checks the emailed code and opens the session. */
export async function verifyCode(code: string): Promise<Result> {
  const jar = await cookies();
  const pending = await readPending();
  const expired = { ok: false, error: "Your sign-in has expired. Start again." } as const;

  if (!LIVE) {
    await mockDelay(500);
    if (!pending) return expired;
    if (code !== DEMO_CODE) return { ok: false, error: "That code is not right. Check the email and try again." };
    jar.delete(PENDING_COOKIE);
    jar.set(SESSION_COOKIE, pending.email, { ...COOKIE, maxAge: SESSION_MAX_AGE });
    return { ok: true };
  }

  if (!pending?.token) return expired;
  try {
    const { access_token } = await apiFetch("/v1/admin/auth/verify-login", z.object({ access_token: z.string() }), {
      method: "POST",
      body: { code, token: pending.token },
      token: null,
    });
    jar.delete(PENDING_COOKIE);
    jar.set(SESSION_COOKIE, access_token, { ...COOKIE, maxAge: secondsLeft(access_token) });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: failureMessage(e, "That code didn't work. Try again.") };
  }
}

/**
 * Sends a new code. LIVE: the API has no resend endpoint yet, and the password
 * is never kept to sign in again behind the admin's back, so they start over.
 */
export async function resendCode(): Promise<Result> {
  if (LIVE) return { ok: false, error: "Codes can't be resent yet. Go back and sign in again for a new one." };
  await mockDelay(400);
  return { ok: true };
}

/** Ends the session here. The API has no sign-out endpoint; the token simply stops being sent. */
export async function signOut(): Promise<void> {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
  jar.delete(PENDING_COOKIE);
}

const profileSchema = z.object({ email: z.string(), first_name: z.string(), last_name: z.string() });

/** The signed-in admin, or null. Cached per request: the layout and the page share one call. */
export const getCurrentAdmin = cache(async (): Promise<AdminUser | null> => {
  const session = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!session) return null;
  if (!LIVE) return adminFromEmail(session);

  const p = await apiFetch("/v1/admin/auth/profile", profileSchema);
  const name = `${p.first_name} ${p.last_name}`.trim();
  // The API has no roles yet, so every admin shows as one.
  return { id: p.email, name: name || p.email, email: p.email, role: "admin", emailVerified: true };
});
