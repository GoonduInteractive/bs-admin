import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { getCurrentAdmin } from "@/lib/api/auth";
import { cn } from "@/lib/utils";
import { NotificationsForm, ProfileForm, StoreForm, TeamPanel } from "./settings-forms";

export const metadata: Metadata = { title: "Settings" };

const TABS = [
  { id: "profile", label: "Profile" },
  { id: "team", label: "Team" },
  { id: "store", label: "Store" },
  { id: "notifications", label: "Notifications" },
] as const;
type Tab = (typeof TABS)[number]["id"];

/** MOCK teammates until the team endpoint exists. */
const TEAM = [
  { id: "adm_0002", name: "Chinedu Okeke", email: "chinedu@goondu.games", role: "owner" as const, lastSeen: "2026-09-23T18:20:00+01:00" },
  { id: "adm_0003", name: "Ifeoma Nwachukwu", email: "ifeoma@goondu.games", role: "support" as const, lastSeen: "2026-09-24T09:05:00+01:00" },
];

export default async function SettingsPage({ searchParams }: PageProps<"/settings">) {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/login");
  const { tab: raw } = await searchParams;
  const tab: Tab = TABS.some((t) => t.id === raw) ? (raw as Tab) : "profile";

  return (
    <>
      <PageHeader title="Settings" description="Your account, the admin team and how the store runs." />

      <div className="grid gap-6 lg:grid-cols-[12rem_1fr]">
        <nav aria-label="Settings sections" className="flex gap-1 overflow-x-auto lg:flex-col">
          {TABS.map((t) => (
            <Link
              key={t.id}
              href={t.id === "profile" ? "/settings" : `/settings?tab=${t.id}`}
              scroll={false}
              aria-current={tab === t.id ? "page" : undefined}
              className={cn(
                "rounded-lg px-3 py-2 text-sm whitespace-nowrap text-muted-foreground hover:bg-card hover:text-foreground",
                tab === t.id && "bg-card font-medium text-foreground ring-1 ring-foreground/8",
              )}
            >
              {t.label}
            </Link>
          ))}
        </nav>

        <div className="min-w-0">
          {tab === "profile" && <ProfileForm admin={admin} />}
          {tab === "team" && <TeamPanel admin={admin} members={TEAM} />}
          {tab === "store" && <StoreForm />}
          {tab === "notifications" && <NotificationsForm />}
        </div>
      </div>
    </>
  );
}
