import { Check } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { Panel } from "@/components/shared/panel";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { NotFoundError } from "@/lib/api/client";
import { getRegions, getTournament } from "@/lib/api/competition";
import { formatDateTime, formatNaira } from "@/lib/format";
import { STAGE, TOURNAMENT_STATUS } from "@/lib/labels";
import { regionName, regionNames } from "@/lib/regions";
import { ordinal, prizeAmounts, slotsFill, splitSummary, stagePosition } from "@/lib/tournaments";
import { cn } from "@/lib/utils";
import type { Tournament } from "@/types";
import { TournamentForm } from "../tournament-form";
import { Bracket } from "./bracket";
import { QualifierBoard } from "./qualifier-board";
import { Lifecycle } from "./lifecycle";
import { Participants } from "./participants";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "bracket", label: "Bracket" },
  { id: "players", label: "Players" },
  { id: "settings", label: "Settings" },
] as const;
type Tab = (typeof TABS)[number]["id"];

export async function generateMetadata({ params }: PageProps<"/tournaments/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const t = await getTournament(slug).catch(() => null);
  return { title: t?.name ?? "Tournament" };
}

function Stages({ t }: { t: Tournament }) {
  // Skipped stages sit out of the numbering: the Journey counts the stages this tournament plays.
  let n = 0;
  return (
    <ol className="grid gap-3 sm:grid-cols-4 xl:grid-cols-7">
      {t.stages.map((s) => {
        const skipped = s.status === "skipped";
        if (!skipped) n++;
        const done = s.status === "completed";
        return (
          <li
            key={s.key}
            className={cn(
              "rounded-lg border p-3",
              s.status === "inProgress" && "border-amber bg-amber-soft",
              done && "border-primary bg-primary text-primary-foreground",
              skipped && "border-dashed opacity-55",
            )}
          >
            <p className={cn("flex items-center justify-between text-xs", done ? "text-primary-foreground/60" : "text-muted-foreground")}>
              {skipped ? "Not needed" : `Stage ${n}`}
              {done && <Check className="size-3.5 text-primary-foreground" />}
            </p>
            <p className={cn("mt-1 text-sm font-medium", skipped && "line-through decoration-muted-foreground/50")}>{STAGE[s.key]}</p>
            <p className={cn("mt-0.5 text-xs", done ? "text-primary-foreground/60" : "text-muted-foreground")}>
              {skipped
                ? "Skipped"
                : s.status === "inProgress" && s.endsAt
                  ? `Closes ${formatDateTime(s.endsAt)}`
                  : s.startsAt && s.status !== "upcoming"
                    ? `${done ? "Started" : "Starts"} ${formatDateTime(s.startsAt)}`
                    : done
                      ? "Done"
                      : s.status === "inProgress"
                        ? "In progress"
                        : "Upcoming"}
            </p>
          </li>
        );
      })}
    </ol>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs tracking-wide text-muted-foreground uppercase">{label}</dt>
      <dd className="mt-1 text-sm font-medium">{children}</dd>
    </div>
  );
}

function Overview({ t, region }: { t: Tournament; region: string }) {
  const played = t.bracket.flatMap((r) => r.matches).filter((m) => m.playedAt).length;
  const total = t.bracket.flatMap((r) => r.matches).length;
  const remaining = t.participants.filter((p) => p.status === "active" || p.status === "registered").length;

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Registered"
          value={t.slots.total === null ? String(t.slots.taken) : `${t.slots.taken} / ${t.slots.total}`}
          footer={t.slots.total === null ? "Unlimited slots" : `${slotsFill(t)}% of slots filled`}
        />
        <StatCard label="Still in" value={remaining} footer={t.status === "active" ? "Not yet eliminated" : "Players registered"} />
        <StatCard label="Matches played" value={total ? `${played} / ${total}` : "—"} footer={total ? `${total - played} to go` : "Bracket not drawn"} />
        <StatCard
          label="Prize pool"
          value={formatNaira(t.prizePool)}
          footer={`${t.prizeSplit.length} paid position${t.prizeSplit.length === 1 ? "" : "s"} · free to enter`}
        />
      </div>

      <Panel title="Journey to ascension" description="Qualifiers run only when over 32 players register; rounds bigger than the field are skipped.">
        <Stages t={t} />
      </Panel>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          <Panel title="About">
            <p className="text-sm leading-relaxed text-muted-foreground">{t.description}</p>
          </Panel>
          <Panel title="Prize payouts" description={`${formatNaira(t.prizePool)} · ${splitSummary(t.prizeSplit)}. Change the split in Settings.`}>
            <ol className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {prizeAmounts(t.prizePool, t.prizeSplit).map((amount, i) => (
                <li key={i} className="flex items-baseline justify-between gap-3 rounded-lg bg-paper px-3 py-2.5">
                  <span className="text-sm">
                    <span className="font-medium">{ordinal(i + 1)}</span>{" "}
                    <span className="text-muted-foreground tabular">{t.prizeSplit[i]}%</span>
                  </span>
                  <span className="text-sm font-semibold tabular">{formatNaira(amount)}</span>
                </li>
              ))}
            </ol>
          </Panel>
        </div>
        <Panel title="Facts">
          <dl className="grid grid-cols-2 gap-4">
            <Fact label="Region">{region}</Fact>
            <Fact label="Format">1v1, single elimination</Fact>
            <Fact label="Prize pool">{formatNaira(t.prizePool)}</Fact>
            <Fact label="In-game rewards">{t.inGameRewards ? "Available" : "None"}</Fact>
            <Fact label="Starts">{t.startsAt ? formatDateTime(t.startsAt) : "TBC"}</Fact>
            <Fact label="Ends">{t.endsAt ? formatDateTime(t.endsAt) : "TBC"}</Fact>
            {t.registrationClosesAt && <Fact label="Registration closes">{formatDateTime(t.registrationClosesAt)}</Fact>}
          </dl>
        </Panel>
      </div>
    </>
  );
}

export default async function TournamentPage({ params, searchParams }: PageProps<"/tournaments/[slug]">) {
  const { slug } = await params;
  const { tab: rawTab } = await searchParams;
  const tab: Tab = TABS.some((t) => t.id === rawTab) ? (rawTab as Tab) : "overview";
  const t = await getTournament(slug).catch((e) => {
    if (e instanceof NotFoundError) notFound();
    throw e;
  });
  const regions = await getRegions();
  const names = regionNames(regions);
  const region = regionName(t.region, names);

  return (
    <>
      <PageHeader
        back={{ href: "/tournaments", label: "Tournaments" }}
        title={
          <span className="flex flex-wrap items-center gap-3">
            {t.name}
            <StatusBadge {...TOURNAMENT_STATUS[t.status]} className="font-sans text-xs tracking-normal normal-case" />
          </span>
        }
        description={`${region} · ${formatNaira(t.prizePool)} prize pool${t.featured ? " · Featured on the Competition page" : ""}`}
        actions={<Lifecycle tournament={t} />}
      />

      <nav aria-label="Tournament sections" className="-mb-2 flex gap-1 overflow-x-auto border-b">
        {TABS.map((x) => (
          <Link
            key={x.id}
            href={x.id === "overview" ? `/tournaments/${slug}` : `/tournaments/${slug}?tab=${x.id}`}
            scroll={false}
            aria-current={tab === x.id ? "page" : undefined}
            className={cn(
              "-mb-px border-b-2 border-transparent px-4 py-2.5 text-sm whitespace-nowrap text-muted-foreground hover:text-foreground",
              tab === x.id && "border-signal font-medium text-foreground",
            )}
          >
            {x.label}
            {x.id === "players" && <span className="ml-1.5 text-xs text-muted-foreground">{t.participants.length}</span>}
          </Link>
        ))}
      </nav>

      {tab === "overview" && <Overview t={t} region={region} />}
      {tab === "bracket" && (stagePosition(t.stages).current?.key === "qualifiers" ? <QualifierBoard tournament={t} /> : <Bracket rounds={t.bracket} slug={t.slug} projected={t.projected} />)}
      {tab === "players" && <Participants slug={t.slug} name={t.name} participants={t.participants} names={names} />}
      {tab === "settings" && <TournamentForm tournament={t} regions={regions} />}
    </>
  );
}
