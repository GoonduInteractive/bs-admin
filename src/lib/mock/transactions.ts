import type { Transaction, TransactionStatus } from "@/types";
import { prizeAmounts } from "@/lib/tournaments";
import { ORDERS } from "./orders";
import { PLAYERS } from "./players";
import { createRandom } from "./random";
import { TOURNAMENTS } from "./tournaments";

/**
 * The money ledger, derived from the other fixtures so the numbers agree:
 * every order has its payment, cancelled paid orders have a refund, and every
 * finished tournament paid out its prizes. (Tournaments are free to enter.)
 */

const rand = createRandom(1234);

/** Paystack card payments carry a processor fee; in this mock, transfers do not. */
function feeFor(amount: number, method: Transaction["method"]) {
  return method === "card" ? Math.min(2_000, Math.round(amount * 0.015) + 100) : 0;
}

const fromOrders: Transaction[] = ORDERS.flatMap((order) => {
  const onlyComics = order.lines.every((l) => l.kind === "comic");
  // Paid through Paystack: an order exists only once its payment went through,
  // except some cancelled ones whose payment failed.
  const status: TransactionStatus = order.status === "cancelled" && rand.next() < 0.4 ? "failed" : "successful";

  const payment: Transaction = {
    id: `txn_${order.id.slice(4)}`,
    reference: `PAY-${order.reference.slice(3)}`,
    type: onlyComics ? "comic" : "merch",
    direction: "in",
    amount: order.total,
    fee: feeFor(order.total, order.paymentMethod),
    status,
    method: order.paymentMethod,
    party: { name: order.customer.name, email: order.customer.email },
    relatedId: order.id,
    createdAt: order.placedAt,
  };

  if (order.status === "cancelled" && status === "successful") {
    const refundAt = new Date(new Date(order.placedAt).getTime() + 86_400_000).toISOString();
    return [
      payment,
      {
        ...payment,
        id: `${payment.id}_rf`,
        reference: `RFD-${order.reference.slice(3)}`,
        type: "refund",
        direction: "out",
        fee: 0,
        createdAt: refundAt,
      } satisfies Transaction,
    ];
  }
  return [payment];
});

// Tournaments are free to enter, so the only money they move is the prize payout.
const fromTournaments: Transaction[] = TOURNAMENTS.flatMap((t) => {
  if (t.status !== "completed") return [];

  // One payout per paid position, at the tournament's own split. A position nobody finished in pays nothing.
  const amounts = prizeAmounts(t.prizePool, t.prizeSplit);
  const payouts = amounts.flatMap((amount, i): Transaction[] => {
    const p = t.participants[i];
    const player = p && PLAYERS.find((pl) => pl.id === p.playerId);
    if (!player || !amount) return [];
    return [{
      id: `txn_${t.id.slice(4)}_prize_${i}`,
      reference: `PRZ-${t.slug.slice(0, 4).toUpperCase()}-${i + 1}`,
      type: "prizePayout",
      direction: "out",
      amount,
      fee: 0,
      status: "successful",
      method: "bankTransfer",
      party: { name: player.name, email: player.email },
      relatedId: t.id,
      createdAt: t.endsAt!,
    }];
  });
  return payouts;
});

export const TRANSACTIONS: Transaction[] = [...fromOrders, ...fromTournaments].sort(
  (a, b) => b.createdAt.localeCompare(a.createdAt),
);
