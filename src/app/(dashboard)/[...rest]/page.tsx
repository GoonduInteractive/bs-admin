import type { Metadata } from "next";
import { notFound } from "next/navigation";

export const metadata: Metadata = { title: "Page not found" };

/**
 * Any address the admin doesn't have. Next sends an unmatched URL to the root
 * 404, outside every layout; caught here instead, it gets the dashboard's 404,
 * inside the shell with the sidebar.
 */
export default function UnknownPage() {
  notFound();
}
