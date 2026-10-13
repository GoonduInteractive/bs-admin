import {
  ArrowLeftRight,
  BookOpen,
  LayoutDashboard,
  MapPin,
  Settings,
  Shirt,
  ShoppingBag,
  Trophy,
  Truck,
  Users,
  type LucideIcon,
} from "lucide-react";

export type NavItem = { title: string; href: string; icon: LucideIcon };
export type NavGroup = { label: string; items: NavItem[] };

/** The sidebar, in order. Add a section here and it appears everywhere. */
export const NAV: NavGroup[] = [
  {
    label: "Overview",
    items: [{ title: "Dashboard", href: "/", icon: LayoutDashboard }],
  },
  {
    label: "Store",
    items: [
      { title: "Orders", href: "/orders", icon: ShoppingBag },
      { title: "Transactions", href: "/transactions", icon: ArrowLeftRight },
      { title: "Products", href: "/products", icon: Shirt },
      { title: "Comics", href: "/comics", icon: BookOpen },
      { title: "Shipping", href: "/shipping", icon: Truck },
    ],
  },
  {
    label: "Competition",
    items: [
      { title: "Tournaments", href: "/tournaments", icon: Trophy },
      { title: "Players", href: "/players", icon: Users },
      { title: "Regions", href: "/regions", icon: MapPin },
    ],
  },
];

export const SETTINGS_NAV: NavItem = { title: "Settings", href: "/settings", icon: Settings };

export function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}
