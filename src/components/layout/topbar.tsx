"use client";

import { Bell, ChevronDown, LogOut, Search, Settings, UserRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { SignOutDialog } from "./sign-out-dialog";
import { initials } from "@/lib/format";
import type { AdminUser } from "@/types";
import { cn } from "@/lib/utils";

export type Notice = {
  id: string;
  title: string;
  body: string;
  href: string;
  tone: "warning" | "danger" | "info";
};

const ROLE: Record<AdminUser["role"], string> = { owner: "Owner", admin: "Admin", support: "Support" };

/**
 * One search box for the whole admin. An order reference (BS-1042) goes to
 * Orders; anything else is treated as a player name, handle or email.
 */
function GlobalSearch() {
  const router = useRouter();
  const [q, setQ] = useState("");

  return (
    <form
      role="search"
      className="relative hidden w-full max-w-sm sm:block"
      onSubmit={(e) => {
        e.preventDefault();
        const term = q.trim();
        if (!term) return;
        const target = /^bs-?\d+/i.test(term) ? "/orders" : "/players";
        router.push(`${target}?q=${encodeURIComponent(term)}`);
      }}
    >
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search orders or players…"
        aria-label="Search orders or players"
        className="h-10 rounded-lg border-transparent bg-paper pl-9"
      />
    </form>
  );
}

function Notifications({ notices }: { notices: Notice[] }) {
  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button variant="outline" size="icon" className="relative size-10 rounded-full" aria-label={`Notifications (${notices.length})`} />
        }
      >
        <Bell className="size-4.5" />
        {notices.length > 0 && (
          <span className="absolute top-2 right-2.5 size-2 rounded-full bg-signal ring-2 ring-card" />
        )}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <p className="text-sm font-medium">Needs attention</p>
          <span className="text-xs text-muted-foreground">{notices.length}</span>
        </div>
        <ul className="max-h-80 divide-y overflow-y-auto">
          {notices.length === 0 && <li className="px-4 py-6 text-center text-sm text-muted-foreground">All clear.</li>}
          {notices.map((n) => (
            <li key={n.id}>
              <Link href={n.href} className="flex gap-3 px-4 py-3 hover:bg-paper">
                <span
                  className={cn(
                    "mt-1.5 size-2 shrink-0 rounded-full",
                    n.tone === "danger" && "bg-flare",
                    n.tone === "warning" && "bg-amber",
                    n.tone === "info" && "bg-sky",
                  )}
                />
                <span>
                  <span className="block text-sm font-medium">{n.title}</span>
                  <span className="block text-xs text-muted-foreground">{n.body}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

export function Topbar({ admin, notices }: { admin: AdminUser; notices: Notice[] }) {
  const [signingOut, setSigningOut] = useState(false);

  return (
    <header className="sticky top-0 z-20 flex h-18 shrink-0 items-center gap-3 border-b bg-card/95 px-4 backdrop-blur md:px-6">
      <SidebarTrigger className="size-9 text-muted-foreground" />
      <GlobalSearch />

      <div className="ml-auto flex items-center gap-3">
        <ThemeToggle />
        <Notifications notices={notices} />

        <DropdownMenu>
          <DropdownMenuTrigger
            render={<Button variant="ghost" className="h-auto gap-3 rounded-full py-1 pr-2 pl-1" />}
          >
            <Avatar className="size-9">
              <AvatarFallback className="bg-primary text-xs font-medium text-primary-foreground">{initials(admin.name)}</AvatarFallback>
            </Avatar>
            <span className="hidden text-left leading-tight md:block">
              <span className="block text-sm font-medium">{admin.name}</span>
              <span className="block text-xs text-muted-foreground">{ROLE[admin.role]}</span>
            </span>
            <ChevronDown className="hidden size-4 text-muted-foreground md:block" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuGroup>
              <DropdownMenuLabel className="font-normal">
                <span className="block text-sm font-medium text-foreground">{admin.name}</span>
                <span className="block truncate text-xs">{admin.email}</span>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem render={<Link href="/settings" />}>
              <UserRound />
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem render={<Link href="/settings?tab=team" />}>
              <Settings />
              Team &amp; settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={() => setSigningOut(true)}>
              <LogOut />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <SignOutDialog open={signingOut} onOpenChange={setSigningOut} email={admin.email} />
      </div>
    </header>
  );
}
