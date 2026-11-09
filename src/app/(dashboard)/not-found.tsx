import { NotFoundPanel } from "@/components/shared/not-found-panel";

/**
 * A 404 inside the dashboard: an address that matches nothing (`[...rest]`) or
 * a record that's gone (`notFound()` on an order, product, chapter, volume or
 * tournament). It keeps the sidebar, so the admin carries on from here.
 */
export default function DashboardNotFound() {
  return <NotFoundPanel />;
}
