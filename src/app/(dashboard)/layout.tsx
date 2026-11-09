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
    orNone(getNoteStats(), { pending: 0, approved: 0, rejected: 0, postedThisWeek: 0 }),
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
  if (noteStats.pending > 0) {
    notices.push({
      id: "notes-pending",
      title: `${noteStats.pending} ${noteStats.pending === 1 ? "note is" : "notes are"} waiting for review`,
      body: "Approve them onto the Community Wall, or reject them.",
      href: "/notes",
      tone: "warning",
    });
  }
  return { notices, pendingOrders, pendingNotes: noteStats.pending };
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/login");

  const [{ notices, pendingOrders, pendingNotes }, feed, jar] = await Promise.all([
    getNotices(),
    orNone(getNotifications(), null),
    cookies(),
  ]);
  // The sidebar remembers open/collapsed in a cookie; read it so the first paint matches.
  const sidebarOpen = jar.get("sidebar_state")?.value !== "false";

  return (
    <SidebarProvider defaultOpen={sidebarOpen}>
      <NavProgress />
      <AppSidebar badges={{ "/orders": pendingOrders, "/notes": pendingNotes }} />
      <SidebarInset className="min-w-0 bg-background">
        <Topbar admin={admin} notices={notices} feed={feed} />
        <div className="mx-auto flex w-full max-w-[1400px] flex-1 flex-col gap-6 p-4 md:p-6 lg:p-8">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
