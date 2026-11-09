import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { getCurrentAdmin } from "@/lib/api/auth";
import { failureMessage } from "@/lib/api/client";
import { getNotificationSettings, getStoreSettings, getTeam } from "@/lib/api/settings";
import { cn } from "@/lib/utils";
import type { AdminUser, TeamMember } from "@/types";
import { NotificationsForm, ProfilePanel, StoreForm, TeamPanel } from "./settings-forms";

export const metadata: Metadata = { title: "Settings" };

const TABS = [
  { id: "profile", label: "Profile" },
  { id: "team", label: "Team" },
  { id: "store", label: "Store" },
  { id: "notifications", label: "Notifications" },
] as const;
type Tab = (typeof TABS)[number]["id"];

export default async function SettingsPage({ searchParams }: PageProps<"/settings">) {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/login");
  const { tab: raw } = await searchParams;
  const tab: Tab = TABS.some((t) => t.id === raw) ? (raw as Tab) : "profile";

  // Only what the open tab shows. The profile has no role, so the team says what the signed-in
  // admin's is; if the team can't be read, the Team tab says why and the profile keeps the session's.
  let team: TeamMember[] | null = null;
  let teamError: string | null = null;
  if (tab === "profile" || tab === "team") {
    try {
      team = await getTeam();
    } catch (e) {
      teamError = failureMessage(e, "Couldn't load the team.");
    }
  }
  const me: AdminUser = { ...admin, role: team?.find((m) => m.email.toLowerCase() === admin.email.toLowerCase())?.role ?? admin.role };
  const store = tab === "store" ? await getStoreSettings() : null;
  const notifications = tab === "notifications" ? await getNotificationSettings() : null;

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
          {tab === "profile" && <ProfilePanel admin={me} />}
          {tab === "team" && <TeamPanel admin={me} members={team} error={teamError} />}
          {store && <StoreForm settings={store} />}
          {notifications && <NotificationsForm settings={notifications} />}
        </div>
      </div>
    </>
  );
}
