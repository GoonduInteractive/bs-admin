import type { HederaNetwork } from "@/types/hedera";

/** A transaction, account or token on HashScan, Hedera's public explorer. */
export function hashscanUrl(network: HederaNetwork, kind: "transaction" | "account" | "token", value: string): string {
  return `https://hashscan.io/${network}/${kind}/${encodeURIComponent(value)}`;
}
