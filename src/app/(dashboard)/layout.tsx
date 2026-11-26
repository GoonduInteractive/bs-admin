import { cookies } from "next/headers";
import { redirect, unstable_rethrow } from "next/navigation";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { NavProgress } from "@/components/layout/nav-progress";
import { Topbar, type Notice } from "@/components/layout/topbar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { getCurrentAdmin } from "@/lib/api/auth";
import { getTournaments } from "@/lib/api/competition";
import { getProductRows } from "@/lib/api/merch";
import { getNoteStats } from "@/lib/api/notes";
import { getNotifications } from "@/lib/api/notifications";
import { getOrders } from "@/lib/api/orders";
import { getHederaSummary } from "@/lib/api/hedera";
import { formatHbar } from "@/lib/format";
import { HEDERA_ON } from "@/lib/hedera/mode";
import type { HederaSummary } from "@/types/hedera";

/**
 * The layout's extras (badges, notices, the bell) are optional: a source that
 * fails is left out rather than taking every page down, since an error here
 * isn't caught by the dashboard's `error.tsx`. An ended session still redirects.
 */
const orNone = <T,>(p: Promise<T>, none: T) =>
  p.catch((e: unknown) => {
    unstable_rethrow(e);
    console.error("[layout]", e instanceof Error ? e.message : e);
    return none;
  });

/** What needs a human today, derived from the data rather than stored. */
async function getNotices(): Promise<{ notices: Notice[]; pendingOrders: number; pendingNotes: number }> {
  const [orders, products, tournaments, noteStats] = await Promise.all([
    orNone(getOrders(), []),
    orNone(getProductRows(), []),
    orNone(getTournaments(), []),
    orNone(getNoteStats(), { flagged: 0, urgent: 0, pendingCheck: 0, onWall: 0, rejected: 0, postedThisWeek: 0 }),
  ]);

  const pendingOrders = orders.filter((o) => o.status === "pending").length;
  const notices: Notice[] = [];
  for (const p of products) {
    const s = p.stockStatus;
    // In stock, or a digital-only comic with no stock at all: nothing to do.
    if (!s || s === "inStock" || p.status !== "active") continue;
    notices.push({
      id: `stock-${p.id}`,
      title: s === "outOfStock" ? `${p.name} is sold out` : `${p.name} is running low`,
      body: "Restock or hide it from the store.",
      href: `/products/${p.id}`,
      tone: s === "outOfStock" ? "danger" : "warning",
    });
  }
  for (const t of tournaments) {
    if (t.status !== "registrationOpen") continue;
    notices.push({
      id: `reg-${t.id}`,
      title: `${t.name}: ${t.slots.total === null ? `${t.slots.taken} registered` : `${t.slots.taken}/${t.slots.total} registered`}`,
      body: "Registration is open.",
      href: `/tournaments/${t.slug}`,
      tone: "info",
    });
  }
  // Notes go up at once now; what needs a human is what the automatic check flagged. Self-harm first.
  if (noteStats.urgent > 0) {
    notices.push({
      id: "notes-urgent",
      title: `${noteStats.urgent} urgent self-harm ${noteStats.urgent === 1 ? "flag" : "flags"}`,
      body: "Reach out to the player personally. Open Notes to see who.",
      href: "/notes",
      tone: "danger",
    });
  }
  if (noteStats.flagged > 0) {
    notices.push({
      id: "notes-flagged",
      title: `${noteStats.flagged} ${noteStats.flagged === 1 ? "note" : "notes"} flagged for review`,
      body: "The automatic check took them off the Community Wall. Restore them or take them down.",
      href: "/notes",
      tone: "warning",
    });
  }
  return { notices, pendingOrders, pendingNotes: noteStats.flagged };
}

/** The Hedera screens' notices, while they run (`lib/hedera/mode.ts`): a low treasury first. */
function hederaNotices(h: HederaSummary): Notice[] {
  const notices: Notice[] = [];
  if (h.balance < h.alertBelow) {
    notices.push({
      id: "hedera-treasury-low",
      title: "The treasury is below its alert line",
      body: `${formatHbar(h.balance)} left; the alert is at ${formatHbar(h.alertBelow)}. Top it up before approving more payouts.`,
      href: "/hedera/treasury",
      tone: "danger",
    });
  }
  if (h.jobsOpen > 0) {
    notices.push({
      id: "hedera-jobs",
      title: `${h.jobsOpen} Hedera ${h.jobsOpen === 1 ? "job needs" : "jobs need"} a look`,
      body: "Failed mints, stuck payments or failed payouts. Retry or refund them.",
      href: "/hedera/jobs",
      tone: "warning",
    });
  }
  if (h.payoutsReady > 0) {
    notices.push({
      id: "hedera-payouts",
      title: `${h.payoutsReady} HBAR ${h.payoutsReady === 1 ? "prize is" : "prizes are"} ready to approve`,
      body: "The winners' identity checks are done and their wallets are linked.",
      href: "/hedera/payouts",
      tone: "info",
    });
  }
  return notices;
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/login");

  const [{ notices, pendingOrders, pendingNotes }, feed, jar, hedera] = await Promise.all([
    getNotices(),
    orNone(getNotifications(), null),
    cookies(),
    HEDERA_ON ? orNone(getHederaSummary(), null) : null,
  ]);
  // The sidebar remembers open/collapsed in a cookie; read it so the first paint matches.
  const sidebarOpen = jar.get("sidebar_state")?.value !== "false";
  // The treasury's alert leads: it stops payouts. Then the rest of the day's notices.
  const allNotices = hedera ? [...hederaNotices(hedera), ...notices] : notices;

  return (
    <SidebarProvider defaultOpen={sidebarOpen}>
      <NavProgress />
      <AppSidebar
        hedera={HEDERA_ON}
        badges={{
          "/orders": pendingOrders,
          "/notes": pendingNotes,
          ...(hedera && { "/hedera/payouts": hedera.payoutsReady, "/hedera/jobs": hedera.jobsOpen }),
        }}
      />
      <SidebarInset className="min-w-0 bg-background">
        <Topbar admin={admin} notices={allNotices} feed={feed} />
        <div className="mx-auto flex w-full max-w-[1400px] flex-1 flex-col gap-6 p-4 md:p-6 lg:p-8">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
