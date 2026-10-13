import { NextResponse, type NextRequest } from "next/server";

/**
 * Route guard. An optimistic check only - it looks for the session cookie and
 * redirects; the real authorisation belongs to the API once it exists.
 * Cookie names are duplicated from `lib/api/auth.ts` because that module is
 * server-only and reads `next/headers`, which the proxy cannot import.
 */

const SESSION_COOKIE = "bs_admin_session";
const PENDING_COOKIE = "bs_admin_pending";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const signedIn = request.cookies.has(SESSION_COOKIE);
  const pending = request.cookies.has(PENDING_COOKIE);

  if (pathname === "/login") {
    return signedIn ? NextResponse.redirect(new URL("/", request.url)) : NextResponse.next();
  }

  if (pathname === "/verify-email") {
    if (signedIn) return NextResponse.redirect(new URL("/", request.url));
    if (!pending) return NextResponse.redirect(new URL("/login", request.url));
    return NextResponse.next();
  }

  if (!signedIn) {
    const url = new URL("/login", request.url);
    if (pathname !== "/") url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  // Everything except Next internals and static files.
  matcher: ["/((?!_next/|assets/|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)"],
};
