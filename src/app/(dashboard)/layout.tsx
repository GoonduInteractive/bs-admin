import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { Topbar, type Notice } from "@/components/layout/topbar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { getCurrentAdmin } from "@/lib/api/auth";
import { getTournaments } from "@/lib/api/competition";
import { getProducts } from "@/lib/api/merch";
import { getOrders } from "@/lib/api/orders";
import { stockStatus } from "@/lib/stock";

/** What needs a human today, derived from the data rather than stored. */
async function getNotices(): Promise<{ notices: Notice[]; pendingOrders: number }> {
  const [orders, products, tournaments] = await Promise.all([
    getOrders(),
    getProducts(),
    getTournaments(),
  ]);

  const pendingOrders = orders.filter((o) => o.status === "pending").length;
  const notices: Notice[] = [];
  for (const p of products) {
    const s = stockStatus(p);
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
  return { notices, pendingOrders };
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/login");

  const [{ notices, pendingOrders }, jar] = await Promise.all([getNotices(), cookies()]);
  // The sidebar remembers open/collapsed in a cookie; read it so the first paint matches.
  const sidebarOpen = jar.get("sidebar_state")?.value !== "false";

  return (
    <SidebarProvider defaultOpen={sidebarOpen}>
      <AppSidebar badges={{ "/orders": pendingOrders }} />
      <SidebarInset className="min-w-0 bg-background">
        <Topbar admin={admin} notices={notices} />
        <div className="mx-auto flex w-full max-w-[1400px] flex-1 flex-col gap-6 p-4 md:p-6 lg:p-8">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
