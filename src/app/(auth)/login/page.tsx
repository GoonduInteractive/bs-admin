import type { Metadata } from "next";
import { DEMO } from "@/lib/api/auth";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next, expired } = await searchParams;
  return (
    <>
      <h1 className="font-display text-5xl leading-none font-semibold uppercase">Sign in</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Use your Goondu staff account. We&apos;ll email you a code to finish signing in.
      </p>
      {expired && (
        <p role="status" className="mt-6 rounded-lg border px-3 py-2 text-sm">
          Your session ended. Sign in again to carry on.
        </p>
      )}
      <LoginForm next={typeof next === "string" ? next : undefined} demo={DEMO} />
    </>
  );
}
