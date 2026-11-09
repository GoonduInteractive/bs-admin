"use client";

import { usePathname } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";

/**
 * A thin red bar across the top while another page loads: the instant answer
 * to a click, before the page's own skeleton (`loading.tsx`) or the page.
 *
 * It starts on a click on a link to another admin page, or when code navigates
 * itself (`startNavigation`, which the tables call when a row is clicked), and
 * it's done when the address changes. A navigation that never lands - an
 * error, a redirect back here - lets it go after 15 seconds.
 */
let from: string | null = null;
let giveUp: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();

function set(next: string | null) {
  from = next;
  clearTimeout(giveUp);
  if (next) giveUp = setTimeout(() => set(null), 15_000);
  listeners.forEach((listener) => listener());
}

/** Call before `router.push` to another page. */
export function startNavigation() {
  set(window.location.pathname);
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export function NavProgress() {
  const pathname = usePathname();
  const started = useSyncExternalStore(
    subscribe,
    () => from,
    () => null,
  );

  // Arrived: the address moved on from where it started.
  useEffect(() => {
    if (from && from !== pathname) set(null);
  }, [pathname]);

  useEffect(() => {
    // Captured, before the link's own handler: Next's `Link` cancels the click to navigate itself.
    const onClick = (event: MouseEvent) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = (event.target as Element | null)?.closest?.("a[href]");
      if (!(link instanceof HTMLAnchorElement) || link.target === "_blank" || link.hasAttribute("download")) return;
      const url = new URL(link.href, window.location.href);
      // Another page of this admin; a query change on this page (a tab, a filter) shows nothing.
      if (url.origin !== window.location.origin || url.pathname === window.location.pathname) return;
      startNavigation();
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  if (!started || started !== pathname) return null;
  return (
    <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-100 h-0.5">
      <div className="h-full animate-nav-progress bg-signal motion-reduce:w-full motion-reduce:animate-none motion-reduce:opacity-60" />
    </div>
  );
}
