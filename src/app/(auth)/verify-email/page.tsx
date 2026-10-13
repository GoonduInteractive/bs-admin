import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getPendingEmail } from "@/lib/api/auth";
import { VerifyForm } from "./verify-form";

export const metadata: Metadata = { title: "Verify your email" };

/** j*****@goondu.games - enough to recognise, not enough to harvest. */
function mask(email: string) {
  const [local, domain] = email.split("@");
  if (!domain) return email;
  return `${local[0]}${"*".repeat(Math.max(2, local.length - 1))}@${domain}`;
}

export default async function VerifyEmailPage({ searchParams }: PageProps<"/verify-email">) {
  const email = await getPendingEmail();
  if (!email) redirect("/login");
  const { next } = await searchParams;

  return (
    <>
      <h1 className="font-display text-5xl leading-none font-semibold uppercase">Check your email</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        We sent a 6-digit code to <span className="font-medium text-foreground">{mask(email)}</span>. It
        expires in 10 minutes.
      </p>
      <VerifyForm next={typeof next === "string" ? next : undefined} />
    </>
  );
}
