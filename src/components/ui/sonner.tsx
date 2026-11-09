"use client";

import { Check, Info, Loader2, TriangleAlert, X, type LucideIcon } from "lucide-react";
import { Toaster as Sonner, type ToasterProps } from "sonner";
import { cn } from "@/lib/utils";

/**
 * The admin's toast: a card like every other panel (white, or the menu
 * overlay's #1a1a1a in dark mode, with the faint ring), and the status pattern
 * the tables already use, a soft-filled circle in the status colour: moss for
 * success, flare for errors, amber for warnings, sky for information.
 *
 * Callers keep sonner's own API (`toast.success("…")`, `toast.error("…")`).
 * `unstyled` hands every part of the toast to the classes below; sonner keeps
 * the stacking, swipe-to-dismiss, pause-on-hover and the live region that
 * reads each toast to a screen reader.
 *
 * The toaster stays on sonner's light theme on purpose: its dark theme recolours
 * the description and close button with selectors that outrank these classes,
 * and the tokens used here already flip with the admin's dark mode.
 */

function StatusIcon({ icon: Icon, className, spin }: { icon: LucideIcon; className: string; spin?: boolean }) {
  return (
    <span className={cn("grid size-8 place-items-center rounded-full", className)}>
      <Icon className={cn("size-4", spin && "animate-spin")} strokeWidth={2.5} aria-hidden />
    </span>
  );
}

/** The top bar is 72px tall (`h-18`); toasts sit just under it, clear of the bell and the account menu. */
const BELOW_TOPBAR = 84;

const Toaster = (props: ToasterProps) => (
  <Sonner
    className="toaster group"
    position="top-right"
    offset={{ top: BELOW_TOPBAR, right: 24 }}
    mobileOffset={{ top: BELOW_TOPBAR, right: 16, left: 16 }}
    closeButton
    icons={{
      success: <StatusIcon icon={Check} className="bg-moss-soft text-moss" />,
      error: <StatusIcon icon={X} className="bg-flare-soft text-flare" />,
      warning: <StatusIcon icon={TriangleAlert} className="bg-amber-soft text-amber-ink" />,
      info: <StatusIcon icon={Info} className="bg-sky-soft text-sky-ink" />,
      loading: <StatusIcon icon={Loader2} className="bg-slate-soft text-slate" spin />,
    }}
    toastOptions={{
      unstyled: true,
      classNames: {
        toast:
          "group/toast relative flex w-(--width) items-start gap-3 rounded-xl bg-card p-4 pr-11 font-sans text-card-foreground shadow-lg shadow-ink/5 ring-1 ring-foreground/8",
        icon: "shrink-0",
        // pt-1.5 centres the first line of text on the 32px icon.
        content: "flex min-w-0 flex-1 flex-col gap-0.5 pt-1.5",
        title: "text-sm leading-5 font-medium",
        description: "text-sm leading-5 text-muted-foreground",
        closeButton:
          "absolute top-3 right-3 grid size-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-paper hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none [&_svg]:size-3.5",
        actionButton:
          "h-8 shrink-0 self-center rounded-lg bg-primary px-3 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/85",
        cancelButton: "h-8 shrink-0 self-center rounded-lg px-3 text-xs font-medium transition-colors hover:bg-paper",
      },
    }}
    {...props}
  />
);

export { Toaster };
