import type { HederaJob, IdentityStatus, JobAction, PrizePayout } from "@/types/hedera";

/**
 * Payout and job rules, pure so the table, the sheet and the server actions
 * agree. The doc: every payout needs an admin's approval, goes only to the
 * verified linked wallet, and above a threshold the winner first completes a
 * light identity check (name, date of birth, ID).
 */

/** Whether this prize needs the identity check: it's above the threshold. */
export function identityRequired(p: Pick<PrizePayout, "hbar">, threshold: number): boolean {
  return p.hbar > threshold;
}

/** The identity check as the admin sees it: what the player sent, read against the threshold. */
export function identityStatus(p: Pick<PrizePayout, "hbar" | "identity">, threshold: number): IdentityStatus {
  // Once verified it stays verified, whatever the threshold does later.
  if (p.identity.state === "verified") return "verified";
  if (!identityRequired(p, threshold)) return "notNeeded";
  return { none: "waiting", submitted: "toReview", rejected: "rejected" }[p.identity.state] as IdentityStatus;
}

/** Why a payout can't be approved yet, or null when it can. */
export function approvalBlocker(p: PrizePayout, threshold: number): string | null {
  if (p.status === "held") return "It's on hold. Release it first.";
  if (p.status !== "awaitingApproval") return null;
  if (!p.wallet) return "The winner hasn't linked a wallet, so there's nowhere to send it.";
  const id = identityStatus(p, threshold);
  if (id === "waiting") return "Waiting for the winner's identity check.";
  if (id === "toReview") return "Review the winner's identity check first.";
  if (id === "rejected") return "The identity check was rejected. Waiting for the winner to send it again.";
  return null;
}

/** Ready for an admin: awaiting approval with nothing in the way. */
export function readyToApprove(p: PrizePayout, threshold: number): boolean {
  return p.status === "awaitingApproval" && approvalBlocker(p, threshold) === null;
}

/**
 * What an admin can do about a job. A mint is retried (the idempotency key
 * means a retry never mints twice); a paid mint can be refunded instead; a
 * payment the gateway never confirmed is checked again on the Mirror Node;
 * HBAR that came in short or late goes back; a failed payout is retried.
 */
export function jobActions(job: Pick<HederaJob, "problem" | "via" | "status">): JobAction[] {
  if (job.status !== "open") return [];
  switch (job.problem) {
    case "mintFailed":
      return job.via === "purchase" ? ["retry", "refund"] : ["retry"];
    case "paymentUnconfirmed":
      return ["recheck"];
    case "underpaid":
    case "paidAfterExpiry":
      return ["refund"];
    case "payoutFailed":
      return ["retry"];
  }
}

/** How many jobs were closed in the last `days` days. */
export function resolvedWithin(jobs: HederaJob[], days: number, now = Date.now()): number {
  const since = now - days * 86_400_000;
  return jobs.filter((j) => j.status === "resolved" && Date.parse(j.resolution?.at ?? j.updatedAt) >= since).length;
}

/** What a refund sends back: whatever arrived. */
export function refundAmount(job: Pick<HederaJob, "paidHbar" | "hbar">): number {
  return job.paidHbar ?? job.hbar ?? 0;
}
