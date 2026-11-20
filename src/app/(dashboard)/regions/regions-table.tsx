"use client";

import { LocateFixed, MapPin, MoreHorizontal, Plus } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { DataTable, type Column, type Filter } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Field, FieldDescription, FieldError, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { formatCount, formatDate } from "@/lib/format";
import type { Tone } from "@/lib/labels";
import { cn } from "@/lib/utils";
import type { Region } from "@/types";
import { deleteRegionAction, findRegionPinAction, saveRegionAction, setRegionStatusAction } from "./actions";

/** A region with how many players and tournaments use it. `players` is null while the API doesn't say who is where. */
export type RegionRow = Region & { players: number | null; tournaments: number };

const STATUS: Record<Region["status"], { label: string; tone: Tone }> = {
  active: { label: "Active", tone: "success" },
  archived: { label: "Archived", tone: "neutral" },
};

/** A coordinate as the form shows it: as stored, or blank. */
const typed = (n: number | undefined) => (n === undefined ? "" : String(n));

/** Add a region, or edit one. One dialog for both; `region` present means editing. */
function RegionDialog({ open, onOpenChange, region }: { open: boolean; onOpenChange: (o: boolean) => void; region?: RegionRow }) {
  const [name, setName] = useState(region?.name ?? "");
  const [lat, setLat] = useState(typed(region?.pin?.lat));
  const [lng, setLng] = useState(typed(region?.pin?.lng));
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  // The pin from the name (`findRegionPinAction`). Leaving the name looks it up and fills the
  // fields only when they're empty or still hold an earlier lookup's numbers, never over numbers
  // typed by hand; Find pin is the admin asking, so it replaces them.
  const [found, setFound] = useState<{ text: string; ok: boolean } | null>(null);
  const [autoFilled, setAutoFilled] = useState(false);
  const [lookedUp, setLookedUp] = useState<string | null>(null);
  const [looking, startLookup] = useTransition();

  function lookup(asked: boolean) {
    const query = name.trim();
    if (query.length < 2) return;
    if (!asked && (query === lookedUp || ((lat || lng) && !autoFilled))) return;
    setLookedUp(query);
    startLookup(async () => {
      const res = await findRegionPinAction(query);
      if ("pin" in res) {
        setLat(String(res.pin.lat));
        setLng(String(res.pin.lng));
        setAutoFilled(true);
        setError(null);
        setFound({ ok: true, text: `Found: ${res.pin.label} · © OpenStreetMap contributors` });
      } else if ("notFound" in res) {
        setFound({ ok: false, text: `Nothing called "${query}" was found. Type the coordinates.` });
      } else {
        setFound({ ok: false, text: res.error });
      }
    });
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const res = await saveRegionAction(region?.id ?? null, { name, lat, lng });
      if ("error" in res) return setError(res.error ?? "Check the name");
      toast.success(region ? `${res.region.name} saved` : `${res.region.name} added`);
      onOpenChange(false);
    });
  }

  const edit = (set: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    set(e.target.value);
    setError(null);
  };
  // A number typed by hand is the admin's: no later lookup on leaving the name replaces it.
  const editPin = (set: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    edit(set)(e);
    setAutoFilled(false);
    setFound(null);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (o) {
          setName(region?.name ?? "");
          setLat(typed(region?.pin?.lat));
          setLng(typed(region?.pin?.lng));
          setError(null);
          setFound(null);
          setAutoFilled(false);
          setLookedUp(null);
        }
      }}
    >
      <DialogContent>
        <form onSubmit={submit} noValidate className="flex flex-col gap-5">
          <DialogHeader>
            <DialogTitle>{region ? `Edit ${region.name}` : "Add a region"}</DialogTitle>
            <DialogDescription>
              {region
                ? region.players === null
                  ? "The new name shows everywhere at once. Its players and tournaments stay in it."
                  : `The new name shows everywhere at once. Its ${formatCount(region.players)} players and ${formatCount(region.tournaments)} tournaments stay in it.`
                : "New regions are offered to players at registration straight away."}
            </DialogDescription>
          </DialogHeader>
          <Field>
            <FieldLabel htmlFor="region-name">Name</FieldLabel>
            <Input
              id="region-name"
              autoFocus
              maxLength={40}
              value={name}
              placeholder="Kano"
              className="h-10"
              onChange={(e) => {
                edit(setName)(e);
                setFound(null);
              }}
              onBlur={() => lookup(false)}
            />
            <FieldDescription>As players will see it, e.g. a state, city or country. The map pin fills in from it.</FieldDescription>
          </Field>
          <FieldSet>
            <FieldLegend variant="label">Map pin</FieldLegend>
            <div className="grid grid-cols-2 items-end gap-3 sm:grid-cols-[1fr_1fr_auto]">
              <Field>
                <FieldLabel htmlFor="region-lat" className="font-normal text-muted-foreground">
                  Latitude
                </FieldLabel>
                <Input id="region-lat" inputMode="decimal" value={lat} placeholder="12.0022" className="h-10 tabular" onChange={editPin(setLat)} />
              </Field>
              <Field>
                <FieldLabel htmlFor="region-lng" className="font-normal text-muted-foreground">
                  Longitude
                </FieldLabel>
                <Input id="region-lng" inputMode="decimal" value={lng} placeholder="8.5920" className="h-10 tabular" onChange={editPin(setLng)} />
              </Field>
              <Button
                type="button"
                variant="outline"
                className="col-span-2 h-10 sm:col-span-1"
                disabled={looking || name.trim().length < 2}
                aria-busy={looking || undefined}
                onClick={() => lookup(true)}
              >
                <LocateFixed />
                {looking ? "Finding…" : "Find pin"}
              </Button>
            </div>
            {found && (
              <p role="status" className={cn("text-xs leading-snug", found.ok ? "text-moss" : "text-muted-foreground")}>
                {found.text}
              </p>
            )}
            <FieldDescription>
              Where its active players show on the website&apos;s player map, in decimal degrees.{" "}
              {region && !region.pin ? "Leave both empty to keep the pin it has." : "Leave both empty for no pin."}
            </FieldDescription>
          </FieldSet>
          {error && <FieldError>{error}</FieldError>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {region ? "Save" : "Add region"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RowMenu({ row }: { row: RegionRow }) {
  const [pending, start] = useTransition();
  const [renaming, setRenaming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const archived = row.status === "archived";
  const used = (row.players ?? 0) + row.tournaments > 0;

  const run = (fn: () => Promise<{ ok: true } | { error: string }>, done: string) =>
    start(async () => {
      const res = await fn();
      if ("error" in res) toast.error(res.error);
      else toast.success(done);
    });

  return (
    <div className="flex justify-end">
      {/* Beside the menu, not in it: the menu closes when an item is clicked. */}
      <RegionDialog open={renaming} onOpenChange={setRenaming} region={row} />
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title={`Delete ${row.name}?`}
        description="No player or tournament uses it, so nothing else changes. This can't be undone."
        confirmLabel="Delete"
        destructive
        onConfirm={() => run(() => deleteRegionAction(row.id), `${row.name} deleted`)}
      />
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label={`Actions for ${row.name}`} disabled={pending} />}>
          <MoreHorizontal />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem onClick={() => setRenaming(true)}>Edit name and pin</DropdownMenuItem>
          <DropdownMenuItem
            onClick={() =>
              run(
                () => setRegionStatusAction(row.id, archived ? "active" : "archived"),
                archived ? `${row.name} is offered at registration again` : `${row.name} archived`,
              )
            }
          >
            {archived ? "Restore" : "Archive"}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {/* In use, it can only be archived: deleting would leave players with no region. */}
          <DropdownMenuItem variant="destructive" disabled={used} onClick={() => setDeleting(true)}>
            {used ? "In use: archive instead" : "Delete"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

const columns: Column<RegionRow>[] = [
  {
    id: "name",
    header: "Region",
    cell: (r) => (
      <span className="flex items-center gap-2 font-medium">
        <MapPin className="size-4 text-muted-foreground" />
        {r.name}
      </span>
    ),
    sortValue: (r) => r.name,
    csv: (r) => r.name,
  },
  {
    id: "players",
    header: "Players",
    cell: (r) => <span className="tabular">{r.players === null ? "—" : formatCount(r.players)}</span>,
    sortValue: (r) => r.players ?? -1,
    csv: (r) => r.players ?? "",
  },
  {
    id: "tournaments",
    header: "Tournaments",
    cell: (r) => <span className="tabular">{formatCount(r.tournaments)}</span>,
    sortValue: (r) => r.tournaments,
    csv: (r) => r.tournaments,
  },
  {
    id: "pin",
    header: "Map pin",
    cell: (r) => <span className="text-muted-foreground tabular">{r.pin ? `${r.pin.lat}, ${r.pin.lng}` : "—"}</span>,
    csv: (r) => (r.pin ? `${r.pin.lat}, ${r.pin.lng}` : ""),
  },
  { id: "status", header: "Status", cell: (r) => <StatusBadge {...STATUS[r.status]} />, csv: (r) => STATUS[r.status].label },
  { id: "created", header: "Added", cell: (r) => <span className="text-muted-foreground">{formatDate(r.createdAt)}</span>, sortValue: (r) => r.createdAt, csv: (r) => r.createdAt },
  { id: "actions", header: <span className="sr-only">Actions</span>, cell: (r) => <RowMenu row={r} />, className: "w-12" },
];

const filters: Filter<RegionRow>[] = [
  {
    id: "status",
    label: "Status",
    options: Object.entries(STATUS).map(([value, s]) => ({ value, label: s.label })),
    predicate: (r, v) => r.status === v,
  },
];

export function RegionsTable({ rows }: { rows: RegionRow[] }) {
  const [adding, setAdding] = useState(false);
  const add = (
    <Button onClick={() => setAdding(true)}>
      <Plus />
      Add region
    </Button>
  );

  return (
    <>
      <RegionDialog open={adding} onOpenChange={setAdding} />
      <DataTable
        rows={rows}
        // The pin column only once the API sends pins back: the spec doesn't list them on the region record.
        columns={rows.some((r) => r.pin) ? columns : columns.filter((c) => c.id !== "pin")}
        getRowId={(r) => r.id}
        searchText={(r) => r.name}
        searchPlaceholder="Search regions…"
        filters={filters}
        toolbar={add}
        exportName="regions"
        exportTitle="Regions"
        empty={{ icon: MapPin, title: "No regions yet", description: "Add the first region players can pick at registration.", action: add }}
      />
    </>
  );
}
