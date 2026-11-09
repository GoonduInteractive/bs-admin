import { Check, Mail, MapPin, Package, Phone } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { Panel } from "@/components/shared/panel";
import { StatusBadge } from "@/components/shared/status-badge";
import { Thumb } from "@/components/shared/thumb";
import { NotFoundError } from "@/lib/api/client";
import { getOrder, getTransactionsFor } from "@/lib/api/orders";
import { formatDateTime, formatNaira } from "@/lib/format";
import { ORDER_STATUS, orderBadge, PAYMENT_METHOD, TRANSACTION_STATUS, TRANSACTION_TYPE } from "@/lib/labels";
import { cn } from "@/lib/utils";
import type { OrderStatus } from "@/types";
import { OrderActions } from "./order-actions";

export async function generateMetadata({ params }: PageProps<"/orders/[id]">): Promise<Metadata> {
  const { id } = await params;
  return { title: `Order ${id}` };
}

async function load(id: string) {
  try {
    return await getOrder(id);
  } catch (e) {
    if (e instanceof NotFoundError) notFound();
    throw e;
  }
}

const FLOW: OrderStatus[] = ["pending", "processing", "inTransit", "delivered"];

export default async function OrderPage({ params }: PageProps<"/orders/[id]">) {
  const { id } = await params;
  const order = await load(id);
  const transactions = await getTransactionsFor(order.id);
  const status = orderBadge(order);
  const reached = new Map(order.timeline.map((t) => [t.status, t.at]));
  // Online comics alone: nothing to ship, so the order is paid and then delivered. Read off the
  // lines, not the address: a physical order can arrive with no address (seen 2026-11-02).
  const digital = order.lines.length > 0 && order.lines.every((l) => l.kind === "comic" && l.format === "online");
  const closed = order.status === "cancelled" || order.status === "refunded";
  // The API's own stages (awaiting payment, processing, in transit, delivered); a cancelled or
  // refunded order ends at what it reached, then that. A reply without stages gets the standard flow.
  const stages = order.stages;
  const steps: OrderStatus[] = stages?.length
    ? closed
      ? [...stages.filter((s) => reached.has(s)), order.status]
      : stages
    : closed
      ? ["pending", order.status]
      : digital
        ? ["pending", "delivered"]
        : FLOW;

  return (
    <>
      <PageHeader
        back={{ href: "/orders", label: "Orders" }}
        title={
          <span className="flex flex-wrap items-center gap-3">
            #{order.reference}
            <StatusBadge {...status} className="font-sans text-xs tracking-normal normal-case" />
          </span>
        }
        description={[`Placed ${formatDateTime(order.placedAt)}`, order.paymentMethod && PAYMENT_METHOD[order.paymentMethod]].filter(Boolean).join(" · ")}
        actions={<OrderActions id={order.id} reference={order.reference} status={order.status} current={order.apiStatus} />}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          <Panel title="Items" bodyClassName="p-0">
            <ul className="divide-y">
              {order.lines.map((line, i) => (
                <li key={`${line.refId}-${i}`} className="flex items-center gap-4 px-5 py-4">
                  <span className="relative grid size-16 shrink-0 place-items-center overflow-hidden rounded-lg bg-linen">
                    {line.image ? (
                      <Thumb src={line.image} alt="" fill sizes="64px" className="object-contain p-1.5" />
                    ) : (
                      <Package className="size-6 text-muted-foreground" aria-hidden />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{line.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {[line.colour, line.size && `Size ${line.size}`, line.format && (line.format === "online" ? "Online edition" : "Print edition")]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  <p className="text-sm text-muted-foreground tabular">
                    {line.quantity} × {formatNaira(line.unitPrice)}
                  </p>
                  <p className="w-24 text-right font-medium tabular">{formatNaira(line.quantity * line.unitPrice)}</p>
                </li>
              ))}
            </ul>
            <dl className="space-y-2 border-t bg-paper/60 px-5 py-4 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Subtotal</dt>
                <dd className="tabular">{formatNaira(order.subtotal)}</dd>
              </div>
              {order.pointsDiscount > 0 && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Community points</dt>
                  <dd className="text-moss tabular">−{formatNaira(order.pointsDiscount)}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Shipping</dt>
                <dd className="tabular">
                  {digital ? (
                    <span className="text-muted-foreground">Not needed</span>
                  ) : order.shipping === undefined ? (
                    <span className="text-muted-foreground">—</span>
                  ) : order.shipping === 0 ? (
                    <span className="text-moss">Free</span>
                  ) : (
                    formatNaira(order.shipping)
                  )}
                </dd>
              </div>
              <div className="flex justify-between border-t pt-2 text-base font-semibold">
                <dt>Total</dt>
                <dd className="tabular">{formatNaira(order.total)}</dd>
              </div>
            </dl>
          </Panel>

          <Panel title="Progress">
            <ol className="relative flex flex-col gap-5 sm:flex-row sm:gap-0">
              {steps.map((s, i) => {
                const at = reached.get(s);
                // Where the order is now counts as reached, dated or not.
                const done = !!at || s === order.status;
                const failed = s === "cancelled";
                return (
                  <li key={s} className="relative flex gap-3 sm:flex-1 sm:flex-col sm:gap-2">
                    {i < steps.length - 1 && (
                      <span
                        aria-hidden
                        className={cn(
                          "absolute top-4 left-4 hidden h-0.5 w-full sm:block",
                          reached.has(steps[i + 1]) || steps[i + 1] === order.status ? "bg-primary" : "bg-mist",
                        )}
                      />
                    )}
                    <span
                      className={cn(
                        "relative z-10 grid size-8 shrink-0 place-items-center rounded-full border-2 bg-card",
                        done && !failed && "border-primary bg-primary text-primary-foreground",
                        done && failed && "border-flare bg-flare text-white",
                        !done && "border-mist text-muted-foreground",
                      )}
                    >
                      {done ? <Check className="size-4" /> : <span className="text-xs">{i + 1}</span>}
                    </span>
                    <span>
                      <span className={cn("block text-sm font-medium", !done && "text-muted-foreground")}>
                        {ORDER_STATUS[s].label}
                      </span>
                      <span className="block text-xs text-muted-foreground">{at ? formatDateTime(at) : "—"}</span>
                    </span>
                  </li>
                );
              })}
            </ol>
          </Panel>
        </div>

        <div className="flex flex-col gap-4">
          <Panel title="Customer">
            <p className="font-medium">{order.customer.name}</p>
            {order.customer.handle && (
              <Link href={`/players?q=${order.customer.handle}`} className="text-sm text-signal hover:underline">
                @{order.customer.handle}
              </Link>
            )}
            <ul className="mt-4 space-y-2.5 text-sm">
              {order.customer.email && (
                <li className="flex items-center gap-2.5 text-muted-foreground">
                  <Mail className="size-4 shrink-0" />
                  <a href={`mailto:${order.customer.email}`} className="truncate text-foreground hover:underline">
                    {order.customer.email}
                  </a>
                </li>
              )}
              {digital && (
                <li className="flex gap-2.5 text-muted-foreground">
                  <MapPin className="mt-0.5 size-4 shrink-0" />
                  <span className="text-foreground">
                    Digital delivery
                    <span className="block text-xs text-muted-foreground">Online comics unlock in the reader on payment.</span>
                  </span>
                </li>
              )}
              {!digital && !order.shippingAddress && (
                // Something ships, but the API sent no address: say so rather than draw nothing.
                <li className="flex gap-2.5 text-muted-foreground">
                  <MapPin className="mt-0.5 size-4 shrink-0" />
                  <span className="text-foreground">
                    <span className="font-medium">{order.deliveryMethod === "pickup" ? "Pickup" : order.deliveryMethod ? "Home Delivery" : "Delivery"}</span>
                    <span className="block text-xs text-flare">No delivery address on this order. Contact the customer before sending it.</span>
                  </span>
                </li>
              )}
              {order.shippingAddress && (
                <>
                  {order.shippingAddress.phone && (
                    <li className="flex items-center gap-2.5 text-muted-foreground">
                      <Phone className="size-4 shrink-0" />
                      <span className="text-foreground">{order.shippingAddress.phone}</span>
                    </li>
                  )}
                  <li className="flex gap-2.5 text-muted-foreground">
                    <MapPin className="mt-0.5 size-4 shrink-0" />
                    {order.shippingAddress.full ? (
                      // From the API: the address as the customer gave it, in one piece.
                      <span className="text-foreground">
                        <span className="font-medium">{order.deliveryMethod === "pickup" ? "Pickup" : "Home Delivery"}</span>
                        {order.deliveryMethod === "pickup" && (
                          <span className="block text-xs text-muted-foreground">Send to a collection centre in this local government</span>
                        )}
                        <span className="block whitespace-pre-line">{order.shippingAddress.full}</span>
                      </span>
                    ) : order.deliveryMethod === "pickup" ? (
                      // Pickup: the customer gave only their state and local government. Send it to a
                      // transport company's collection centre there; they collect it with their phone number.
                      <span className="text-foreground">
                        <span className="font-medium">Pickup</span>
                        <span className="block text-xs text-muted-foreground">Send to a collection centre in this local government</span>
                        {[order.shippingAddress.lga, order.shippingAddress.state].filter(Boolean).join(", ")}
                        <br />
                        {order.shippingAddress.country}
                      </span>
                    ) : (
                      <span className="text-foreground">
                        <span className="font-medium">Home Delivery</span>
                        <br />
                        {order.shippingAddress.line1}
                        <br />
                        {[order.shippingAddress.city, order.shippingAddress.lga, order.shippingAddress.state, order.shippingAddress.zipcode].filter(Boolean).join(", ")}
                        <br />
                        {order.shippingAddress.country}
                      </span>
                    )}
                  </li>
                </>
              )}
            </ul>
          </Panel>

          <Panel title="Payments" bodyClassName="p-0 pb-2">
            {transactions.length === 0 ? (
              <p className="px-5 pb-3 text-sm text-muted-foreground">No payment recorded yet.</p>
            ) : (
              <ul className="divide-y">
                {transactions.map((t) => (
                  <li key={t.id} className="px-5 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium">{TRANSACTION_TYPE[t.type]}</p>
                      <p className={cn("text-sm font-medium tabular", t.direction === "out" && "text-flare")}>
                        {t.direction === "out" ? "−" : ""}
                        {formatNaira(t.amount)}
                      </p>
                    </div>
                    <div className="mt-1 flex items-center justify-between gap-2">
                      <p className="text-xs text-muted-foreground">
                        {t.reference} · {formatDateTime(t.createdAt)}
                      </p>
                      <StatusBadge {...TRANSACTION_STATUS[t.status]} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}
