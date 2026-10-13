"use client";

import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  Download,
  FileSpreadsheet,
  FileText,
  Loader2,
  ListFilter,
  Search,
  X,
  type LucideIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { exportCsv, exportPdf, type ExportTable } from "@/lib/export";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { EmptyState } from "./empty-state";

/**
 * The admin's one table. Search, single-choice filters (the inspiration's
 * Filters -> Status submenu), sortable columns, pagination and CSV export,
 * all client-side over the rows it is handed.
 *
 * WHEN THE API LANDS, large lists should page on the server instead: keep
 * this component's props and move `query`, `filters`, `sort` and `page` into
 * the URL so the server page can pass them to the adapter.
 */

export type Column<T> = {
  id: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  /** Present = sortable. */
  sortValue?: (row: T) => string | number;
  /** Present = included in exports. The raw value, for CSV. */
  csv?: (row: T) => string | number;
  /** The readable value for PDF (₦85,000 rather than 85000). Defaults to `csv`, with ISO dates formatted. */
  pdf?: (row: T) => string;
  className?: string;
  headClassName?: string;
};

export type Filter<T> = {
  id: string;
  label: string;
  options: { value: string; label: string }[];
  predicate: (row: T, value: string) => boolean;
};

type Sort = { id: string; dir: "asc" | "desc" } | null;

const PAGE_SIZE = 10;

/** 1 2 3 … 14, the inspiration's pager. */
function pageList(current: number, total: number): (number | "gap")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = new Set([1, total, current - 1, current, current + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  return sorted.flatMap((p, i) => (i > 0 && p - sorted[i - 1] > 1 ? (["gap", p] as const) : [p]));
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}T/;

function buildExport<T>(rows: T[], columns: Column<T>[], title: string, fileName: string, notes: string[]): ExportTable {
  const cols = columns.filter((c) => c.csv);
  return {
    title,
    fileName,
    notes,
    headers: cols.map((c) => (typeof c.header === "string" ? c.header : c.id)),
    // A column whose raw values are all numbers is right-aligned in the PDF.
    numeric: cols.map((c) => rows.length > 0 && rows.every((r) => typeof c.csv!(r) === "number")),
    csvRows: rows.map((r) => cols.map((c) => c.csv!(r))),
    pdfRows: rows.map((r) =>
      cols.map((c) => {
        if (c.pdf) return c.pdf(r);
        const v = c.csv!(r);
        return typeof v === "string" && ISO_DATE.test(v) ? formatDate(v) : String(v);
      }),
    ),
  };
}

export function DataTable<T>({
  rows,
  columns,
  getRowId,
  rowHref,
  onRowClick,
  searchPlaceholder = "Search…",
  searchText,
  initialQuery = "",
  filters = [],
  exportName,
  exportTitle,
  toolbar,
  empty,
  pageSize = PAGE_SIZE,
}: {
  rows: T[];
  columns: Column<T>[];
  getRowId: (row: T) => string;
  rowHref?: (row: T) => string;
  /** Alternative to rowHref: open a sheet or dialog instead of navigating. */
  onRowClick?: (row: T) => void;
  searchPlaceholder?: string;
  /** Text a row is searched by. Absent = no search box. */
  searchText?: (row: T) => string;
  initialQuery?: string;
  filters?: Filter<T>[];
  exportName?: string;
  /** PDF heading. Defaults to exportName, capitalised. */
  exportTitle?: string;
  /** Extra controls, rendered before Filter and Export. */
  toolbar?: ReactNode;
  empty?: { icon: LucideIcon; title: string; description?: string; action?: ReactNode };
  pageSize?: number;
}) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [active, setActive] = useState<Record<string, string>>({});
  const [sort, setSort] = useState<Sort>(null);
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let out = rows.filter((row) => {
      if (q && searchText && !searchText(row).toLowerCase().includes(q)) return false;
      return filters.every((f) => !active[f.id] || f.predicate(row, active[f.id]));
    });
    if (sort) {
      const col = columns.find((c) => c.id === sort.id);
      if (col?.sortValue) {
        const get = col.sortValue;
        out = [...out].sort((a, b) => {
          const av = get(a);
          const bv = get(b);
          const cmp = typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv));
          return sort.dir === "asc" ? cmp : -cmp;
        });
      }
    }
    return out;
  }, [rows, query, searchText, filters, active, sort, columns]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const current = Math.min(page, pageCount);
  const visible = filtered.slice((current - 1) * pageSize, current * pageSize);
  const activeCount = Object.values(active).filter(Boolean).length;

  function setFilter(id: string, value: string) {
    setActive((a) => ({ ...a, [id]: value }));
    setPage(1);
  }

  function toggleSort(id: string) {
    setSort((s) => (s?.id !== id ? { id, dir: "desc" } : s.dir === "desc" ? { id, dir: "asc" } : null));
  }

  const [exporting, startExport] = useTransition();

  /** What was exported, so a PDF says which slice of the data it shows. */
  function exportNotes() {
    const notes = filters
      .filter((f) => active[f.id])
      .map((f) => `${f.label}: ${f.options.find((o) => o.value === active[f.id])?.label}`);
    if (query.trim()) notes.unshift(`Search: "${query.trim()}"`);
    return notes;
  }

  function runExport(kind: "csv" | "pdf") {
    const name = exportName ?? "export";
    const title = exportTitle ?? name.replace(/[-_]/g, " ").replace(/^\w/, (c) => c.toUpperCase());
    const table = buildExport(filtered, columns, title, name, exportNotes());
    if (kind === "csv") return exportCsv(table);
    startExport(async () => {
      try {
        await exportPdf(table);
      } catch {
        toast.error("Couldn't create the PDF. Try again, or export CSV.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        {searchText && (
          <div className="relative w-full sm:max-w-xs">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
              placeholder={searchPlaceholder}
              aria-label={searchPlaceholder}
              className="h-10 bg-card pl-9"
            />
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
          {toolbar}

          {filters.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant="outline" size="lg" className="h-10 bg-card px-3.5" />}>
                <ListFilter />
                Filter
                {activeCount > 0 && (
                  <span className="grid size-5 place-items-center rounded-full bg-primary text-[0.7rem] text-primary-foreground">
                    {activeCount}
                  </span>
                )}
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuGroup>
                  <DropdownMenuLabel>Filters</DropdownMenuLabel>
                </DropdownMenuGroup>
                {filters.map((f) => (
                  <DropdownMenuSub key={f.id}>
                    <DropdownMenuSubTrigger>
                      {f.label}
                      {active[f.id] && (
                        <span className="ml-auto text-xs text-muted-foreground">
                          {f.options.find((o) => o.value === active[f.id])?.label}
                        </span>
                      )}
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent className="w-44">
                      <DropdownMenuRadioGroup value={active[f.id] ?? ""} onValueChange={(v) => setFilter(f.id, v as string)}>
                        <DropdownMenuRadioItem value="">All</DropdownMenuRadioItem>
                        {f.options.map((o) => (
                          <DropdownMenuRadioItem key={o.value} value={o.value}>
                            {o.label}
                          </DropdownMenuRadioItem>
                        ))}
                      </DropdownMenuRadioGroup>
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem disabled={activeCount === 0} onClick={() => setActive({})}>
                  <X />
                  Reset filters
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {exportName && (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={<Button variant="outline" size="lg" className="h-10 bg-card px-3.5" disabled={exporting || filtered.length === 0} />}
              >
                {exporting ? <Loader2 className="animate-spin" /> : <Download />}
                Export
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuGroup>
                  <DropdownMenuLabel>
                    {filtered.length} {filtered.length === 1 ? "row" : "rows"}
                    {filtered.length !== rows.length && " (filtered)"}
                  </DropdownMenuLabel>
                  <DropdownMenuItem onClick={() => runExport("csv")}>
                    <FileSpreadsheet />
                    Export as CSV
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => runExport("pdf")}>
                    <FileText />
                    Export as PDF
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl bg-card p-2 ring-1 ring-foreground/8 sm:p-4">
        {visible.length === 0 ? (
          empty ? (
            <EmptyState
              icon={empty.icon}
              title={rows.length === 0 ? empty.title : "No matches"}
              description={rows.length === 0 ? empty.description : "Try a different search or clear the filters."}
              action={rows.length === 0 ? empty.action : undefined}
            />
          ) : (
            <p className="py-12 text-center text-sm text-muted-foreground">Nothing to show.</p>
          )
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-none bg-paper hover:bg-paper">
                {columns.map((col, i) => (
                  <TableHead
                    key={col.id}
                    className={cn(
                      "h-12 px-3 font-medium text-muted-foreground",
                      i === 0 && "rounded-l-lg",
                      i === columns.length - 1 && "rounded-r-lg",
                      col.headClassName,
                    )}
                    aria-sort={sort?.id === col.id ? (sort.dir === "asc" ? "ascending" : "descending") : undefined}
                  >
                    {col.sortValue ? (
                      <button
                        type="button"
                        onClick={() => toggleSort(col.id)}
                        className="-mx-1 inline-flex items-center gap-1 rounded px-1 hover:text-foreground"
                      >
                        {col.header}
                        {sort?.id === col.id ? (
                          sort.dir === "asc" ? <ArrowUp className="size-3.5" /> : <ArrowDown className="size-3.5" />
                        ) : (
                          <ChevronsUpDown className="size-3.5 opacity-50" />
                        )}
                      </button>
                    ) : (
                      col.header
                    )}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((row) => {
                const href = rowHref?.(row);
                return (
                  <TableRow
                    key={getRowId(row)}
                    className={cn((href || onRowClick) && "cursor-pointer")}
                    onClick={(e) => {
                      // Let links, buttons and menus inside the row do their own thing.
                      if ((e.target as HTMLElement).closest("a,button,[role=menuitem],input,label")) return;
                      if (onRowClick) onRowClick(row);
                      else if (href) router.push(href);
                    }}
                  >
                    {columns.map((col) => (
                      <TableCell key={col.id} className={cn("h-16 px-3", col.className)}>
                        {col.cell(row)}
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      {filtered.length > 0 && (
        <div className="flex flex-col items-center justify-between gap-3 text-sm text-muted-foreground sm:flex-row">
          <p>
            Showing {(current - 1) * pageSize + 1}–{Math.min(current * pageSize, filtered.length)} of {filtered.length}
          </p>
          {pageCount > 1 && (
            <nav aria-label="Pagination" className="flex items-center gap-1">
              <Button variant="ghost" size="icon" disabled={current === 1} onClick={() => setPage(current - 1)} aria-label="Previous page">
                <ChevronLeft />
              </Button>
              {pageList(current, pageCount).map((p, i) =>
                p === "gap" ? (
                  <span key={`gap-${i}`} className="px-1">
                    …
                  </span>
                ) : (
                  <Button
                    key={p}
                    variant={p === current ? "default" : "outline"}
                    size="icon"
                    className={cn("size-8 tabular", p !== current && "bg-card")}
                    onClick={() => setPage(p)}
                    aria-current={p === current ? "page" : undefined}
                  >
                    {p}
                  </Button>
                ),
              )}
              <Button variant="ghost" size="icon" disabled={current === pageCount} onClick={() => setPage(current + 1)} aria-label="Next page">
                <ChevronRight />
              </Button>
            </nav>
          )}
        </div>
      )}
    </div>
  );
}
