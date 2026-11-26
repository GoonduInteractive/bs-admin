import { FlaskConical } from "lucide-react";
import { notFound } from "next/navigation";
import { HEDERA_MODE } from "@/lib/hedera/mode";

/**
 * The Hedera screens. Off (no `HEDERA_MOCK=1`), every address under /hedera
 * is the dashboard's 404, as if the section didn't exist. On, every page
 * says plainly that it's mock data, so nobody approves a payout here thinking
 * HBAR moved.
 */
export default function HederaLayout({ children }: { children: React.ReactNode }) {
  if (HEDERA_MODE === "off") notFound();

  return (
    <>
      <p
        role="note"
        className="-mb-2 flex items-start gap-2.5 rounded-lg border border-dashed border-amber/60 bg-amber-soft px-4 py-2.5 text-sm text-amber-ink"
      >
        <FlaskConical className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span>
          <span className="font-medium">Mock data.</span> The Hedera service isn&apos;t connected yet, so nothing on these pages reaches the network,
          and every change resets when the admin restarts.
        </span>
      </p>
      {children}
    </>
  );
}
