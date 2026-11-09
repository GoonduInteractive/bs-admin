import "server-only";
import { cookies } from "next/headers";
import { redirect, unstable_rethrow } from "next/navigation";
import { z } from "zod";

/**
 * The HTTP client for the Beyond Service API.
 *
 * Every adapter calls the API through `apiFetch`. `BS_API_URL` is required:
 * `next.config.ts` stops the app starting without it. Pages never import this
 * file directly.
 *
 * Every reply is the API's envelope, `{ success, status, message, data }`.
 * `apiFetch` returns `data`, parsed with the zod schema the adapter passes, so
 * a field the backend renames fails loudly here instead of drawing blank in a
 * table. Failures arrive as `{ success: false, message, code, details? }` and
 * become an `ApiError`.
 */

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

/**
 * THE ADMIN'S NETWORK TAB IS THE TERMINAL. Every call is made here, on the
 * server, with the session's token, so the browser never sees one. In
 * development each is logged to the terminal running `next dev` (and its dev
 * log): method, path, status, time, and for a refusal what was sent and what
 * came back. `BS_API_DEBUG=1` in `.env.local` adds those for every call. Cut
 * short, with passwords, tokens and codes blanked. Nothing is logged in production.
 */
const DEV = process.env.NODE_ENV !== "production";
const DEBUG = DEV && process.env.BS_API_DEBUG === "1";
// Blanked: in what's sent, the sign-in code too; a reply's `code` is the API's error code, kept.
const SENT_SECRET = /password|token|code|secret/i;
const REPLY_SECRET = /password|token|secret/i;
const clip = (value: unknown, secret: RegExp) => {
  const text = JSON.stringify(value, (key, v) => (key && secret.test(key) && typeof v === "string" ? "•••" : v)) ?? "";
  return text.length > 2000 ? `${text.slice(0, 2000)}…` : text;
};
function logCall(method: string, url: URL, status: number | string, started: number, sent?: unknown, reply?: unknown) {
  if (!DEV) return;
  console.log(`[api] ${method} ${url.pathname}${url.search} → ${status} in ${Math.round(performance.now() - started)}ms`);
  // A refusal says why, debug or not: what was sent and the API's reply.
  const refused = typeof status === "number" && status >= 400;
  if (!DEBUG && !refused) return;
  if (sent !== undefined) console.log(`[api]   sent: ${clip(sent, SENT_SECRET)}`);
  console.log(`[api]   got:  ${clip(reply, REPLY_SECRET)}`);
}

type Query = Record<string, string | number | undefined>;

type ApiInit = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  query?: Query;
  body?: unknown;
  /** The signed-in admin's token by default; `null` for the sign-in calls, made before there is one. */
  token?: string | null;
};

export async function apiFetch<S extends z.ZodType>(path: string, schema: S, init: ApiInit = {}): Promise<z.output<S>> {
  const base = process.env.BS_API_URL;
  if (!base) throw new Error("BS_API_URL is not set.");

  const url = new URL(path, base);
  for (const [key, value] of Object.entries(init.query ?? {})) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }
  const fromSession = init.token === undefined;
  const token = fromSession ? (await cookies()).get(SESSION_COOKIE)?.value : init.token;
  const method = init.method ?? "GET";
  const started = performance.now();

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
    logCall(method, url, "no answer", started, init.body);
    throw new ApiError(0, "The server didn't answer. It may be waking up: try again in a minute.");
  }

  const json: unknown = await res.json().catch(() => null);
  logCall(method, url, res.status, started, init.body, json);
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
    // In development the reply goes to the dev log, so a contract change can be read rather than guessed.
    if (process.env.NODE_ENV !== "production") {
      console.error(`[api] ${method} ${url.pathname} replied:`, JSON.stringify(json)?.slice(0, 4000));
    }
    throw new ApiError(502, `Unexpected reply from ${method} ${url.pathname}: ${describeIssue(parsed.error.issues[0])}`, UNEXPECTED_REPLY);
  }
  return parsed.data;
}

/**
 * Where a reply first fails its schema, e.g. "items.0.chapters.0.title:
 * expected string". Where several shapes are allowed, it follows the one the
 * reply came closest to (the deepest failure) rather than stopping at "Invalid input".
 */
function describeIssue(issue: z.core.$ZodIssue | undefined, prefix: PropertyKey[] = []): string {
  if (!issue) return "the reply: invalid";
  const path = [...prefix, ...issue.path];
  if (issue.code === "invalid_union") {
    const closest = issue.errors
      .map((branch) => branch[0])
      .filter((i): i is z.core.$ZodIssue => !!i)
      .sort((a, b) => b.path.length - a.path.length)[0];
    if (closest) return describeIssue(closest, path);
  }
  return `${path.length ? path.map(String).join(".") : "the reply"}: ${issue.message}`;
}

/**
 * The API's replies count money in kobo (`*_minor`); the admin counts naira.
 * What the admin sends is naira already (`price`, `prize_pool`: since 2026-11-02).
 */
export const fromMinor = (minor: number) => minor / 100;

/* ---- Paged lists ------------------------------------------------------- */

const paging = z.object({ total: z.number(), page: z.number(), limit: z.number() });

/**
 * One page of a list: `{ items, paging }`. Also read: an array holding the
 * page (how the spec types some lists), a page with no `paging`, and a bare
 * array of items (how some lists answer, e.g. when empty).
 */
function pageOf<T extends z.ZodType>(item: T) {
  const page = z.object({ items: z.array(item), paging: paging.optional() });
  return z.union([page, z.tuple([page]).transform(([p]) => p), z.array(item).transform((items) => ({ items, paging: undefined }))]);
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
    // No paging means the reply was the whole list.
    if (!result.paging || result.items.length === 0 || all.length >= result.paging.total) break;
  }
  return all;
}

/* ---- Files ------------------------------------------------------------- */

/** The first http(s) URL in a reply: the spec doesn't say what the upload answers, so the usual names come first. */
function findUrl(value: unknown): string | undefined {
  if (typeof value === "string") return /^https?:\/\//.test(value) ? value : undefined;
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  for (const key of ["url", "location", "file_url", "secure_url", "public_url", "src"]) {
    const hit = findUrl(record[key]);
    if (hit) return hit;
  }
  for (const v of Object.values(record)) {
    const hit = findUrl(v);
    if (hit) return hit;
  }
  return undefined;
}

/*
 * Uploads go to the API's public storage (the backend, 2026-10-27): one file
 * through `POST /v1/files/upload`, several through `POST /v1/files/multi-uploads`.
 * Each file comes back as `{ url, mimeType, size }`. Files uploaded before the
 * switch sit on the old private storage, which browsers can't read: upload them
 * again.
 */

/** Uploads one file and returns its public URL. */
export async function apiUpload(file: File): Promise<string> {
  const body = new FormData();
  body.append("file", file);
  const url = findUrl(await postFiles("/v1/files/upload", body));
  if (!url) throw new ApiError(502, "The file was uploaded, but the server's reply has no URL for it.", UNEXPECTED_REPLY);
  return url;
}

/** Uploads several files in one request and returns their public URLs, in the order sent. */
export async function apiUploadMany(files: File[]): Promise<string[]> {
  const body = new FormData();
  for (const file of files) body.append("files", file);
  const data = await postFiles("/v1/files/multi-uploads", body);
  const urls = Array.isArray(data) ? data.map(findUrl) : [];
  if (urls.length !== files.length || urls.some((u) => !u)) {
    throw new ApiError(502, "The files were uploaded, but the server's reply doesn't give a URL for each.", UNEXPECTED_REPLY);
  }
  return urls as string[];
}

/** POSTs multipart form data to the API as the signed-in admin; the reply's `data`. */
async function postFiles(path: string, body: FormData): Promise<unknown> {
  const base = process.env.BS_API_URL;
  if (!base) throw new Error("BS_API_URL is not set.");
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const url = new URL(path, base);
  const started = performance.now();
  // What's sent is files: logged by name and size, not content.
  const sent = DEBUG ? [...body.entries()].map(([field, v]) => (typeof v === "string" ? { field, value: v } : { field, file: v.name, bytes: v.size })) : undefined;

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { Accept: "application/json", ...(token && { Authorization: `Bearer ${token}` }) },
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    logCall("POST", url, "no answer", started, sent);
    throw new ApiError(0, "The server didn't answer. It may be waking up: try again in a minute.");
  }

  const json: unknown = await res.json().catch(() => null);
  logCall("POST", url, res.status, started, sent, json);
  if (!res.ok) {
    const info = failure.safeParse(json);
    throw new ApiError(res.status, (info.success && info.data.message) || res.statusText || "Upload failed", info.data?.code);
  }
  return envelope.safeParse(json).data?.data ?? json;
}

/* ---- For server actions ------------------------------------------------ */

/**
 * What an action tells the admin when a call fails. Next's own redirects (a
 * session that ended mid-action) are let through, not swallowed.
 */
export function failureMessage(e: unknown, fallback: string): string {
  unstable_rethrow(e);
  if (e instanceof ApiError) {
    if (e.status >= 500 && e.code !== UNEXPECTED_REPLY) {
      // The API's own words where it gave some; its stock "Internal server error" says nothing to act on.
      const said = e.details[0] ?? (/^internal server error\.?$/i.test(e.message) ? "" : e.message);
      return said
        ? `The server hit an error (${e.status}): ${said}`
        : `The server hit an error (${e.status}). Try again; if it keeps happening, tell the backend team.`;
    }
    return e.details[0] ?? e.message;
  }
  return e instanceof Error ? e.message : fallback;
}
