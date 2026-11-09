import type { Metadata } from "next";
import { AcceptInviteForm } from "./accept-invite-form";

export const metadata: Metadata = { title: "Join the team" };

/**
 * Where the invite email's link lands, signed out: `?token=` from the email.
 * The new teammate sets a password, then signs in like everyone else.
 */
export default async function AcceptInvitePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { token } = await searchParams;
  return (
    <>
      <h1 className="font-display text-5xl leading-none font-semibold uppercase">Join the team</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Set a password for your Goondu staff account. You&apos;ll sign in with it and a code we email you.
      </p>
      {typeof token === "string" && token ? (
        <AcceptInviteForm token={token} />
      ) : (
        <p role="alert" className="mt-6 rounded-lg bg-flare-soft px-3 py-2 text-sm text-destructive">
          This invite link is incomplete. Open it again from your invite email.
        </p>
      )}
    </>
  );
}
