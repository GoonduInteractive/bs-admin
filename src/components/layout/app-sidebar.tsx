"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { NAV, SETTINGS_NAV, isActive, type NavItem } from "./nav";

type Badges = Partial<Record<string, number>>;

function NavLink({ item, pathname, badge }: { item: NavItem; pathname: string; badge?: number }) {
  const active = isActive(pathname, item.href);
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        isActive={active}
        tooltip={item.title}
        className="h-10 gap-3 px-3 group-data-[collapsible=icon]:size-10! group-data-[collapsible=icon]:p-3!"
        render={<Link href={item.href} aria-current={active ? "page" : undefined} />}
      >
        <item.icon />
        <span>{item.title}</span>
      </SidebarMenuButton>
      {!!badge && <SidebarMenuBadge className="top-2.5 rounded-full bg-signal px-1.5 text-white">{badge}</SidebarMenuBadge>}
    </SidebarMenuItem>
  );
}

export function AppSidebar({ badges = {} }: { badges?: Badges }) {
  const pathname = usePathname();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="h-18 justify-center px-4 group-data-[collapsible=icon]:px-2">
        <Link
          href="/"
          className="flex h-11 items-center gap-2.5 overflow-hidden rounded-lg bg-ink px-3 dark:ring-1 dark:ring-white/10 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
        >
          {/* Full wordmark when open; the red "BS" monogram when collapsed. */}
          <Image
            src="/assets/brand/beyond-service-logo.png"
            alt="Beyond Service"
            width={96}
            height={34}
            priority
            className="h-auto w-24 group-data-[collapsible=icon]:hidden"
          />
          <span className="hidden font-display text-2xl leading-none font-semibold text-signal group-data-[collapsible=icon]:block">
            BS
          </span>
          <span className="ml-auto font-display text-xs tracking-widest text-white/60 uppercase group-data-[collapsible=icon]:hidden">
            Admin
          </span>
        </Link>
      </SidebarHeader>

      <SidebarSeparator className="mx-4 group-data-[collapsible=icon]:mx-2" />

      <SidebarContent className="gap-0 py-2">
        {NAV.map((group) => (
          <SidebarGroup key={group.label} className="px-3 group-data-[collapsible=icon]:px-3">
            <SidebarGroupLabel className="text-[0.7rem] tracking-wider text-muted-foreground/80 uppercase">
              {group.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="gap-1 group-data-[collapsible=icon]:items-center">
                {group.items.map((item) => (
                  <NavLink key={item.href} item={item} pathname={pathname} badge={badges[item.href]} />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarSeparator className="mx-4 group-data-[collapsible=icon]:mx-2" />
      <SidebarFooter className="px-3 py-3">
        <SidebarMenu className="group-data-[collapsible=icon]:items-center">
          <NavLink item={SETTINGS_NAV} pathname={pathname} />
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
