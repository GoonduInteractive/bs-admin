"use client";

import { ArrowLeft, LayoutDashboard } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSyncExternalStore } from "react";
import { NAV, SETTINGS_NAV, isActive } from "@/components/layout/nav";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** The sidebar section a missing page sits under: "/orders/abc" is Orders. Null for none. */
function sectionOf(pathname: string) {
  const items = [...NAV.flatMap((group) => group.items), SETTINGS_NAV].filter((item) => item.href !== "/");
  return items.find((item) => isActive(pathname, item.href)) ?? null;
}

/** Whether there's a page to go back to. Unknown on the server, so the button waits for the browser. */
const noop = () => () => {};
const useCanGoBack = () => useSyncExternalStore(noop, () => window.history.length > 1, () => false);

/**
 * The admin's 404, in the sign-in screen's brand panel: the entry ground and
 * the key art behind the Teko numerals.
 *
 * A page that doesn't exist and a record that's gone (an order, a product, a
 * chapter) reach it the same way, so it says both, shows the address, and
 * offers the way back: to the section the address was under, else the
 * dashboard. Inside the dashboard it sits in the shell, sidebar and all;
 * anywhere else (the comic reader) it fills the screen.
 */
export function NotFoundPanel({ fullScreen = false }: { fullScreen?: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const canGoBack = useCanGoBack();
  const section = sectionOf(pathname);
  const Home = section?.icon ?? LayoutDashboard;

  return (
    <div className={cn("grid place-items-center", fullScreen ? "min-h-svh bg-background p-4 sm:p-6" : "py-2 sm:py-8")}>
      <section
        aria-labelledby="not-found-title"
        className="relative isolate w-full max-w-3xl overflow-hidden rounded-2xl bg-entry text-white shadow-xl ring-1 ring-foreground/10"
      >
        <Image
          src="/assets/brand/trial-of-the-gods.png"
          alt=""
          fill
          loading="eager"
          sizes="(min-width: 768px) 768px, 100vw"
          className="-z-20 object-cover object-[70%_center] opacity-35 mix-blend-screen"
        />
        <div aria-hidden className="absolute inset-0 -z-10 bg-linear-to-r from-ink via-ink/85 to-ink/30" />

        <div className="px-6 py-10 sm:px-12 sm:py-14">
          <p className="font-display text-sm tracking-[0.3em] text-signal uppercase">Error 404</p>
          <p aria-hidden className="mt-1 font-display text-[7.5rem] leading-[0.8] font-semibold tracking-tight sm:text-[10rem]">
            4<span className="text-signal">0</span>4
          </p>
          <h1 id="not-found-title" className="mt-5 font-display text-4xl leading-none font-semibold uppercase sm:text-5xl">
            This page isn&apos;t here
          </h1>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-white/75">
            The link may be out of date, or what it pointed to (an order, a product, a chapter) has been removed.
          </p>
          <p className="mt-4">
            <code className="inline-block max-w-full rounded-md bg-white/10 px-2.5 py-1 font-mono text-xs break-all text-white/80">
              {pathname}
            </code>
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            {/* Signal red in both themes: the default button is black in light mode, and the panel is black. */}
            <Button size="xl" className="bg-signal text-white hover:bg-signal/90" render={<Link href={section?.href ?? "/"} />}>
              <Home />
              {section ? `Back to ${section.title}` : "Back to the dashboard"}
            </Button>
            {section && (
              <Button
                size="xl"
                variant="outline"
                className="border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white dark:border-white/30 dark:bg-transparent dark:hover:bg-white/10"
                render={<Link href="/" />}
              >
                <LayoutDashboard />
                Dashboard
              </Button>
            )}
            {canGoBack && (
              <Button size="xl" variant="ghost" className="text-white/80 hover:bg-white/10 hover:text-white dark:hover:bg-white/10" onClick={() => router.back()}>
                <ArrowLeft />
                Go back
              </Button>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
