"use client";

import { Ban, Mail, MoreHorizontal, RotateCcw, Users } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { DataTable, type Column, type Filter } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { formatCount, formatDate, formatNaira, initials } from "@/lib/format";
import { CHAMPION, PLAYER_STATUS } from "@/lib/labels";
import { regionName, regionNames } from "@/lib/regions";
import type { Player, Region, RegionId } from "@/types";
import { setPlayerStatusAction } from "./actions";

/**
 * Suspend and reinstate. Suspending asks for the player's handle, typed out,
 * so it lands on the player meant; reinstating gives access back and goes
 * straight through. `dialog` must be rendered wherever the hook is used.
 */
function useSuspend(p: Player) {
  const [pending, start] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const suspended = p.status === "suspended";

  const reinstate = () =>
    start(async () => {
      const res = await setPlayerStatusAction(p.id, "active");
      if ("error" in res) toast.error(res.error);
      else toast.success(`@${p.handle} reinstated`);
    });
  const suspend = (typed: string) =>
    start(async () => {
      const res = await setPlayerStatusAction(p.id, "suspended", typed);
      if ("error" in res) toast.error(res.error);
      else toast.success(`@${p.handle} suspended`);
    });

  const toggle = () => (suspended ? reinstate() : setConfirming(true));
  const dialog = (
    <ConfirmDialog
      open={confirming}
      onOpenChange={setConfirming}
      title={`Suspend @${p.handle}?`}
      description="Their account stays suspended until you reinstate it. Nothing is deleted: their profile, orders and tournament history are kept."
      confirmLabel="Suspend"
      destructive
      confirmText={p.handle}
      onConfirm={suspend}
    />
  );
  return { pending, suspended, toggle, dialog };
}

function RowMenu({ p, onView }: { p: Player; onView: () => void }) {
  const { pending, suspended, toggle, dialog } = useSuspend(p);
  return (
    <div className="flex justify-end">
      {/* Beside the menu, not in it: the menu closes when "Suspend" is clicked. */}
      {dialog}
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label={`Actions for @${p.handle}`} disabled={pending} />}>
          <MoreHorizontal />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={onView}>View profile</DropdownMenuItem>
          <DropdownMenuItem render={<a href={`mailto:${p.email}`} />}>
            <Mail />
            Email player
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant={suspended ? "default" : "destructive"} onClick={toggle}>
            {suspended ? <RotateCcw /> : <Ban />}
            {suspended ? "Reinstate" : "Suspend"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-paper p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-semibold">{value}</p>
    </div>
  );
}

function PlayerSheet({ player, names, onClose }: { player: Player | null; names: Record<RegionId, string>; onClose: () => void }) {
  return (
    <Sheet open={!!player} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-md">{player && <PlayerDetail p={player} names={names} />}</SheetContent>
    </Sheet>
  );
}

function PlayerDetail({ p, names }: { p: Player; names: Record<RegionId, string> }) {
  const { pending, suspended, toggle, dialog } = useSuspend(p);
  return (
    <>
      {dialog}
      <SheetHeader className="border-b p-6">
        <div className="flex items-center gap-4">
          <Avatar className="size-14">
            <AvatarFallback className="bg-entry font-display text-xl text-white">{initials(p.name)}</AvatarFallback>
          </Avatar>
          <div>
            <SheetTitle className="text-lg">@{p.handle}</SheetTitle>
            <SheetDescription>{p.name}</SheetDescription>
            <StatusBadge {...PLAYER_STATUS[p.status]} className="mt-1.5" />
          </div>
        </div>
      </SheetHeader>
      <div className="space-y-5 overflow-y-auto p-6">
        <div className="grid grid-cols-3 gap-2">
          <Stat label="Level" value={p.level} />
          <Stat label="Win rate" value={`${Math.round(p.winRate)}%`} />
          <Stat label="Points" value={formatCount(p.gamePoints)} />
          <Stat label="Tournaments" value={p.tournamentsPlayed} />
          <Stat label="Main" value={CHAMPION[p.main]} />
          <Stat label="Spent" value={formatNaira(p.totalSpend)} />
        </div>
        <dl className="divide-y text-sm">
          {[
            ["Email", <a key="e" href={`mailto:${p.email}`} className="hover:underline">{p.email}</a>],
            ["Region", regionName(p.region, names)],
            ["Joined", formatDate(p.joinedAt)],
            ["Last active", formatDate(p.lastActiveAt)],
          ].map(([k, v]) => (
            <div key={k as string} className="flex justify-between gap-4 py-2.5">
              <dt className="text-muted-foreground">{k}</dt>
              <dd className="text-right">{v}</dd>
            </div>
          ))}
        </dl>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" size="xl" render={<Link href={`/orders?q=${encodeURIComponent(p.name)}`} />}>
            View orders
          </Button>
          <Button variant={suspended ? "default" : "destructive"} size="xl" disabled={pending} onClick={toggle}>
            {suspended ? "Reinstate" : "Suspend"}
          </Button>
        </div>
      </div>
    </>
  );
}

export function PlayersTable({ players, regions, initialQuery }: { players: Player[]; regions: Region[]; initialQuery?: string }) {
  const names = regionNames(regions);
  const [openId, setOpenId] = useState<string | null>(null);
  const open = players.find((p) => p.id === openId) ?? null;

  const columns: Column<Player>[] = [
    {
      id: "player",
      header: "Player",
      cell: (p) => (
        <span className="flex items-center gap-3">
          <Avatar className="size-9">
            <AvatarFallback className="bg-entry text-xs text-white">{initials(p.name)}</AvatarFallback>
          </Avatar>
          <span>
            <span className="block font-medium">@{p.handle}</span>
            <span className="block text-xs text-muted-foreground">{p.name}</span>
          </span>
        </span>
      ),
      sortValue: (p) => p.handle,
      csv: (p) => p.handle,
    },
    { id: "region", header: "Region", cell: (p) => regionName(p.region, names), sortValue: (p) => regionName(p.region, names), csv: (p) => regionName(p.region, names) },
    { id: "level", header: "Level", cell: (p) => <span className="tabular">{p.level}</span>, sortValue: (p) => p.level, csv: (p) => p.level },
    { id: "winRate", header: "Win rate", cell: (p) => <span className="tabular">{Math.round(p.winRate)}%</span>, sortValue: (p) => p.winRate, csv: (p) => Math.round(p.winRate), pdf: (p) => `${Math.round(p.winRate)}%` },
    { id: "points", header: "Points", cell: (p) => <span className="tabular">{formatCount(p.gamePoints)}</span>, sortValue: (p) => p.gamePoints, csv: (p) => p.gamePoints },
    { id: "main", header: "Main", cell: (p) => CHAMPION[p.main], csv: (p) => CHAMPION[p.main] },
    { id: "status", header: "Status", cell: (p) => <StatusBadge {...PLAYER_STATUS[p.status]} />, sortValue: (p) => p.status, csv: (p) => PLAYER_STATUS[p.status].label },
    { id: "joined", header: "Joined", cell: (p) => <span className="whitespace-nowrap">{formatDate(p.joinedAt)}</span>, sortValue: (p) => p.joinedAt, csv: (p) => p.joinedAt },
    { id: "actions", header: <span className="sr-only">Actions</span>, cell: (p) => <RowMenu p={p} onView={() => setOpenId(p.id)} />, className: "w-12" },
  ];

  const filters: Filter<Player>[] = [
    { id: "status", label: "Status", options: Object.entries(PLAYER_STATUS).map(([value, s]) => ({ value, label: s.label })), predicate: (p, v) => p.status === v },
    // From the Regions list: an archived region stays filterable, since players are still in it.
    { id: "region", label: "Region", options: regions.map((r) => ({ value: r.id, label: r.name })), predicate: (p, v) => p.region === v },
    { id: "main", label: "Main champion", options: Object.entries(CHAMPION).map(([value, label]) => ({ value, label })), predicate: (p, v) => p.main === v },
  ];

  return (
    <>
      <DataTable
        rows={players}
        columns={columns}
        getRowId={(p) => p.id}
        onRowClick={(p) => setOpenId(p.id)}
        searchText={(p) => `${p.handle} ${p.name} ${p.email}`}
        searchPlaceholder="Search handle, name or email…"
        initialQuery={initialQuery}
        filters={filters}
        exportName="players"
        exportTitle="Players"
        empty={{ icon: Users, title: "No players yet", description: "Players who sign up in the game appear here." }}
      />
      <PlayerSheet player={open} names={names} onClose={() => setOpenId(null)} />
    </>
  );
}
