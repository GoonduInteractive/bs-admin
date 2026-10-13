import "server-only";
import { cookies } from "next/headers";
import { redirect, unstable_rethrow } from "next/navigation";
import { z } from "zod";

/**
 * The HTTP client for the Beyond Service API.
 *
 * LIVE OR MOCK. With `BS_API_URL` set, every adapter that has an endpoint calls
 * the API through `apiFetch`; without it, they all resolve from
 * `src/lib/mock/*` as before. Adapters with no endpoint yet stay on mocks
 * either way. Pages never import this file directly.
 *
 * Every reply is the API's envelope, `{ success, status, message, data }`.
 * `apiFetch` returns `data`, parsed with the zod schema the adapter passes, so
 * a field the backend renames fails loudly here instead of drawing blank in a
 * table. Failures arrive as `{ success: false, message, code, details? }` and
 * become an `ApiError`.
 */

export const LIVE = Boolean(process.env.BS_API_URL);

/** Holds the API's access token once an admin is signed in. httpOnly: the browser never reads it. */
export const SESSION_COOKIE = "bs_admin_session";

/** The API is on Render, which sleeps when idle and can take up to a minute to wake. */
const TIMEOUT_MS = 90_000;

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code?: string,
    readonly details: string[] = [],
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export class NotFoundError extends Error {
  constructor(what: string, id: string) {
    super(`${what} "${id}" not found`);
    this.name = "NotFoundError";
  }
}

const failure = z.object({
  message: z.string().optional(),
  code: z.string().optional(),
  details: z.array(z.string()).optional(),
});
const envelope = z.object({ data: z.unknown() });

/** A 2xx whose body isn't what the adapter expects: the contract changed, so the message names the field. */
const UNEXPECTED_REPLY = "UNEXPECTED_REPLY";

type Query = Record<string, string | number | undefined>;

type ApiInit = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  query?: Query;
  body?: unknown;
  /** The signed-in admin's token by default; `null` for the sign-in calls, made before there is one. */
  token?: string | null;
};

export async function apiFetch<S extends z.ZodType>(path: string, schema: S, init: ApiInit = {}): Promise<z.output<S>> {
  const base = process.env.BS_API_URL;
  if (!base) throw new Error("BS_API_URL is not set - the admin is running on mock data.");

  const url = new URL(path, base);
  for (const [key, value] of Object.entries(init.query ?? {})) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }
  const fromSession = init.token === undefined;
  const token = fromSession ? (await cookies()).get(SESSION_COOKIE)?.value : init.token;
  const method = init.method ?? "GET";

  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers: {
        Accept: "application/json",
        ...(init.body !== undefined && { "Content-Type": "application/json" }),
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    throw new ApiError(0, "The server didn't answer. It may be waking up: try again in a minute.");
  }

  const json: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    // The token has expired or been revoked: the session is over. The proxy clears the cookie on the way in.
    if (res.status === 401 && fromSession && token) redirect("/login?expired=1");
    const body = failure.safeParse(json);
    const info = body.success ? body.data : {};
    throw new ApiError(res.status, info.message || res.statusText || "Request failed", info.code, info.details);
  }

  const data = envelope.safeParse(json);
  const parsed = schema.safeParse(data.success ? data.data.data : undefined);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const where = issue?.path.length ? issue.path.join(".") : "the reply";
    throw new ApiError(502, `Unexpected reply from ${method} ${url.pathname}: ${where}: ${issue?.message ?? "invalid"}`, UNEXPECTED_REPLY);
  }
  return parsed.data;
}

/* ---- Paged lists ------------------------------------------------------- */

const paging = z.object({ total: z.number(), page: z.number(), limit: z.number() });

/** One page of a list. The spec types some lists' `data` as an array holding the page, so both shapes are read. */
function pageOf<T extends z.ZodType>(item: T) {
  const page = z.object({ items: z.array(item), paging });
  return z.union([page, z.tuple([page]).transform(([p]) => p)]);
}

const PAGE_SIZE = 100;
const MAX_PAGES = 50;

/**
 * Every item of a paged list, a page at a time. The tables search, filter and
 * sort in the browser, so they need the whole list; fine at today's scale.
 * Past a few thousand rows, page on the server instead (README, step 5).
 */
export async function apiFetchAll<T extends z.ZodType>(path: string, item: T, query: Query = {}): Promise<z.output<T>[]> {
  const all: z.output<T>[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const result = await apiFetch(path, pageOf(item), { query: { ...query, page, limit: PAGE_SIZE } });
    all.push(...(result.items as z.output<T>[]));
    if (result.items.length === 0 || all.length >= result.paging.total) break;
  }
  return all;
}

/* ---- For server actions ------------------------------------------------ */

/**
 * What an action tells the admin when a call fails. Next's own redirects (a
 * session that ended mid-action) are let through, not swallowed.
 */
export function failureMessage(e: unknown, fallback: string): string {
  unstable_rethrow(e);
  if (e instanceof ApiError) {
    if (e.status >= 500 && e.code !== UNEXPECTED_REPLY) return `The server hit an error (${e.status}). Try again; if it keeps happening, tell the backend team.`;
    return e.details[0] ?? e.message;
  }
  return e instanceof Error ? e.message : fallback;
}

/** Simulated latency so loading states are visible while on mocks. */
export function mockDelay(ms = 250) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
