"use client";

import { ChevronLeft, ChevronRight, Columns2, GalleryVerticalEnd, LayoutGrid, Pencil, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Thumb } from "@/components/shared/thumb";
import { Button } from "@/components/ui/button";
import { chapterPlace } from "@/lib/comics";
import { cn } from "@/lib/utils";
import type { Comic, ComicVolume } from "@/types";

type Mode = "scroll" | "page";

const MODE_KEY = "bs-reader-mode";

/**
 * The preferred mode, remembered per device. Read through
 * useSyncExternalStore so the server render (always "scroll") and the stored
 * value reconcile without a setState-in-effect.
 */
const modeListeners = new Set<() => void>();
const modeStore = {
  subscribe(fn: () => void) {
    modeListeners.add(fn);
    return () => modeListeners.delete(fn);
  },
  get(): Mode {
    try {
      return localStorage.getItem(MODE_KEY) === "page" ? "page" : "scroll";
    } catch {
      return "scroll";
    }
  },
  set(m: Mode) {
    try {
      localStorage.setItem(MODE_KEY, m);
    } catch {}
    modeListeners.forEach((fn) => fn());
  },
};

/** Tailwind's `lg`: wide enough for two pages side by side. */
const WIDE_QUERY = "(min-width: 1024px)";

/** Whether the screen is large, followed live as the window resizes. Server render: not wide. */
const wideStore = {
  subscribe(fn: () => void) {
    const mq = window.matchMedia(WIDE_QUERY);
    mq.addEventListener("change", fn);
    return () => mq.removeEventListener("change", fn);
  },
  get: () => window.matchMedia(WIDE_QUERY).matches,
};

/**
 * Two ways to read: a continuous vertical scroll (webtoon style, best on a
 * phone) and pages (best for proofing). On a large screen pages mode shows the
 * spread - two pages side by side, turned together; a phone gets one page at a
 * time. Arrow keys, J/K and the thumbnail strip all move through it; Esc goes
 * back to the chapter.
 */
export function Reader({
  comic,
  volume,
  next,
}: {
  comic: Comic;
  volume?: ComicVolume;
  /** The chapter that follows in reading order, if there is one. */
  next?: { id: string; label: string };
}) {
  const pages = comic.pages;
  const router = useRouter();
  const mode = useSyncExternalStore(modeStore.subscribe, modeStore.get, () => "scroll" as Mode);
  const [current, setCurrent] = useState(0);
  const [thumbs, setThumbs] = useState(false);
  const refs = useRef<(HTMLElement | null)[]>([]);
  const changeMode = modeStore.set;

  // Pages mode on a large screen reads as a book: two pages side by side,
  // 1-2, 3-4…, turned a spread at a time. A phone keeps one page; scroll mode
  // is untouched. `first`/`last` are the pages on screen (the same page when single).
  const wide = useSyncExternalStore(wideStore.subscribe, wideStore.get, () => false);
  const spread = mode === "page" && wide;
  const step = spread ? 2 : 1;
  const first = spread ? current - (current % 2) : current;
  const last = spread ? Math.min(first + 1, pages.length - 1) : current;

  const goTo = useCallback(
    (i: number) => {
      const target = Math.max(0, Math.min(pages.length - 1, i));
      setCurrent(target);
      if (mode === "scroll") refs.current[target]?.scrollIntoView({ behavior: "smooth", block: "start" });
      else window.scrollTo({ top: 0 });
    },
    [mode, pages.length],
  );

  // Scroll mode: the page most in view is the current one.
  useEffect(() => {
    if (mode !== "scroll") return;
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) setCurrent(Number((visible.target as HTMLElement).dataset.index));
      },
      { threshold: [0.25, 0.5, 0.75] },
    );
    refs.current.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, [mode]);

  // When switching into scroll mode, land on the page you were reading.
  useEffect(() => {
    if (mode === "scroll") refs.current[current]?.scrollIntoView({ block: "start" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.key === "ArrowRight" || e.key === "j") goTo(first + step);
      else if (e.key === "ArrowLeft" || e.key === "k") goTo(first - step);
      else if (e.key === "Escape") router.push(`/comics/${comic.id}`);
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [first, step, goTo, comic.id, router]);

  const progress = ((last + 1) / pages.length) * 100;
  const pagePair = last > first;

  return (
    <div className="min-h-svh bg-onyx text-white">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-ink/85 backdrop-blur">
        <div className="flex h-14 items-center gap-2 px-3 sm:px-5">
          <Button variant="ghost" size="icon" className="text-white hover:bg-white/10 hover:text-white" render={<Link href={`/comics/${comic.id}`} aria-label="Close reader (Esc)" />}>
            <X />
          </Button>
          <div className="min-w-0">
            <p className="truncate font-display text-xl leading-none font-semibold tracking-wide uppercase">{comic.title}</p>
            <p className="truncate text-xs text-white/60">
              {chapterPlace(comic, volume)}
              {volume && ` · ${volume.title}`}
            </p>
          </div>

          <p className="mx-auto text-sm text-white/80 tabular" aria-live="polite">
            {pagePair ? `Pages ${first + 1}–${last + 1}` : `Page ${current + 1}`} <span className="text-white/40">/ {pages.length}</span>
          </p>

          <div className="flex items-center gap-1">
            <div className="hidden rounded-lg bg-white/10 p-0.5 sm:flex" role="group" aria-label="Reading mode">
              <Button size="sm" variant="ghost" aria-pressed={mode === "scroll"} onClick={() => changeMode("scroll")} className={cn("text-white/70 hover:bg-white/10 hover:text-white", mode === "scroll" && "bg-white text-ink hover:bg-white hover:text-ink")}>
                <GalleryVerticalEnd />
                Scroll
              </Button>
              <Button size="sm" variant="ghost" aria-pressed={mode === "page"} onClick={() => changeMode("page")} className={cn("text-white/70 hover:bg-white/10 hover:text-white", mode === "page" && "bg-white text-ink hover:bg-white hover:text-ink")}>
                <Columns2 />
                Pages
              </Button>
            </div>
            <Button variant="ghost" size="icon" aria-pressed={thumbs} onClick={() => setThumbs((t) => !t)} className={cn("text-white hover:bg-white/10 hover:text-white", thumbs && "bg-white/15")} aria-label="Page thumbnails">
              <LayoutGrid />
            </Button>
            <Button variant="ghost" size="icon" className="hidden text-white hover:bg-white/10 hover:text-white sm:inline-flex" render={<Link href={`/comics/${comic.id}`} aria-label="Edit chapter" />}>
              <Pencil />
            </Button>
          </div>
        </div>
        <div className="h-0.5 bg-white/10">
          <div className="h-full bg-signal transition-[width] duration-300" style={{ width: `${progress}%` }} />
        </div>
      </header>

      {thumbs && (
        <nav aria-label="Pages" className="fixed inset-y-0 right-0 z-20 w-40 overflow-y-auto border-l border-white/10 bg-ink/95 pt-18 pb-4">
          <ol className="space-y-3 px-3">
            {pages.map((p, i) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => goTo(i)}
                  aria-current={i >= first && i <= last ? "page" : undefined}
                  className={cn("relative block w-full overflow-hidden rounded-md ring-2 ring-transparent transition", i >= first && i <= last ? "ring-signal" : "opacity-60 hover:opacity-100")}
                >
                  <span className="relative block aspect-[2/3]">
                    <Thumb src={p.src} alt="" fill sizes="136px" className="object-cover" />
                  </span>
                  <span className="absolute bottom-1 left-1 rounded bg-ink/80 px-1.5 text-xs tabular">{i + 1}</span>
                </button>
              </li>
            ))}
          </ol>
        </nav>
      )}

      {mode === "scroll" ? (
        <main className={cn("mx-auto max-w-3xl pb-24", thumbs && "sm:pr-40 lg:pr-0")}>
          {pages.map((p, i) => (
            <section
              key={p.id}
              ref={(el) => {
                refs.current[i] = el;
              }}
              data-index={i}
              className="scroll-mt-16"
              aria-label={`Page ${i + 1}`}
            >
              <Thumb src={p.src} alt={`${comic.title}, page ${i + 1}`} width={1581} height={2768} sizes="(min-width: 768px) 768px, 100vw" priority={i < 2} className="h-auto w-full" />
            </section>
          ))}
          <div className="px-6 pt-16 text-center">
            <p className="font-display text-4xl font-semibold uppercase">End of Chapter {comic.chapter}</p>
            <p className="mt-1 text-sm text-white/60">
              {comic.title}
              {volume && ` · Vol. ${volume.number}, ${volume.title}`}
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              {next && (
                <Button variant="brand" size="xl" render={<Link href={`/comics/${next.id}/read`} />}>
                  Next: {next.label}
                  <ChevronRight />
                </Button>
              )}
              <Button variant={next ? "secondary" : "brand"} size="xl" onClick={() => goTo(0)}>
                Back to the start
              </Button>
            </div>
          </div>
        </main>
      ) : (
        <main className={cn("relative flex h-[calc(100svh-3.625rem)] items-center justify-center px-2 py-4 sm:px-16", spread && thumbs && "pr-44")}>
          <button type="button" aria-label={spread ? "Previous pages" : "Previous page"} onClick={() => goTo(first - step)} disabled={first === 0} className="absolute inset-y-0 left-0 z-10 w-1/3 cursor-w-resize disabled:cursor-default" />
          <button type="button" aria-label={spread ? "Next pages" : "Next page"} onClick={() => goTo(first + step)} disabled={last === pages.length - 1} className="absolute inset-y-0 right-0 z-10 w-1/3 cursor-e-resize disabled:cursor-default" />
          {/* One page, or on a large screen the spread: left and right pages meeting at the
              gutter, like an open book. An odd last page stands alone. */}
          <div key={pages[first].id} className="flex h-full max-w-full animate-in items-center justify-center gap-1 duration-200 fade-in-0">
            {pages.slice(first, last + 1).map((p, i) => (
              <Thumb
                key={p.id}
                src={p.src}
                alt={`${comic.title}, page ${first + i + 1}`}
                width={1581}
                height={2768}
                sizes={spread ? "(min-width: 1024px) 40vw, 100vw" : "(min-width: 768px) 60vw, 100vw"}
                priority
                className={cn("h-full w-auto object-contain", pagePair ? "max-w-1/2" : "max-w-full")}
              />
            ))}
          </div>
          <Button variant="secondary" size="icon-lg" onClick={() => goTo(first - step)} disabled={first === 0} className="absolute left-3 z-20 hidden rounded-full sm:inline-flex" aria-label={spread ? "Previous pages" : "Previous page"}>
            <ChevronLeft />
          </Button>
          <Button variant="secondary" size="icon-lg" onClick={() => goTo(first + step)} disabled={last === pages.length - 1} className={cn("absolute z-20 hidden rounded-full sm:inline-flex", thumbs ? "right-44" : "right-3")} aria-label={spread ? "Next pages" : "Next page"}>
            <ChevronRight />
          </Button>
        </main>
      )}
    </div>
  );
}
