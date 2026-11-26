import {
  ArrowLeftRight,
  BookOpen,
  Gem,
  HandCoins,
  Landmark,
  LayoutDashboard,
  ListRestart,
  MapPin,
  Settings,
  Shirt,
  ShoppingBag,
  StickyNote,
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
  {
    label: "Community",
    items: [{ title: "Notes", href: "/notes", icon: StickyNote }],
  },
];

/**
 * The Hedera screens (Sophia's v2 scope, "Admin screens (internal)"). Shown
 * only while they run, which for now means on mock data (`lib/hedera/mode.ts`).
 */
export const HEDERA_NAV: NavGroup = {
  label: "Hedera",
  items: [
    { title: "Game store", href: "/hedera/store", icon: Gem },
    { title: "Payouts", href: "/hedera/payouts", icon: HandCoins },
    { title: "Hedera jobs", href: "/hedera/jobs", icon: ListRestart },
    { title: "Treasury", href: "/hedera/treasury", icon: Landmark },
  ],
};

export const SETTINGS_NAV: NavItem = { title: "Settings", href: "/settings", icon: Settings };

export function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}
