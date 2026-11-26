"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * While something is on its way (a payout sending, a retry running), read the
 * page again every few seconds, so its row moves on by itself the way the
 * Hedera service's webhook would move it. Stops as soon as nothing is.
 */
export function RefreshWhile({ active, every = 3000 }: { active: boolean; every?: number }) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => router.refresh(), every);
    return () => clearInterval(timer);
  }, [active, every, router]);
  return null;
}
