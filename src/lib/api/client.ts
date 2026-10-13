import "server-only";

/**
 * The HTTP client the adapters will use once the backend exists.
 *
 * TODAY NOTHING CALLS THIS. Every adapter in `src/lib/api/*` resolves from
 * `src/lib/mock/*`. To go live, set `BS_API_URL`, then replace an adapter's
 * body with an `apiFetch` call and parse the response with the zod schema
 * beside it. Pages never import this file directly.
 */

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
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

export async function apiFetch<T>(path: string, init?: RequestInit & { token?: string }): Promise<T> {
  const base = process.env.BS_API_URL;
  if (!base) throw new Error("BS_API_URL is not set - the admin is still running on mock data.");

  const res = await fetch(new URL(path, base), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.token ? { Authorization: `Bearer ${init.token}` } : {}),
      ...init?.headers,
    },
    cache: "no-store",
  });

  if (!res.ok) throw new ApiError(res.status, await res.text());
  return (await res.json()) as T;
}

/** Simulated latency so loading states are visible while on mocks. */
export function mockDelay(ms = 250) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
