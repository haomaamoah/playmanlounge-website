"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { formatGhs, site } from "@/lib/content";
import { statusTone } from "@/lib/mocks/display";
import { ORDER_STATUSES } from "@/lib/mocks/types";
import { statusLabel } from "@/lib/mocks/seed";
import { useMockStore } from "@/lib/mocks/store";

export function StatusView() {
  const params = useParams<{ id: string }>();
  const { orders, payments, ready } = useMockStore();
  const order = orders.find((entry) => entry.id === params.id);
  const payment = payments.find((entry) => entry.id === order?.paymentId);

  if (!ready) {
    return <p className="text-muted-foreground">Loading the ticket…</p>;
  }

  if (!order) {
    return (
      <div>
        <h1 className="font-display text-4xl">We cannot find that ticket</h1>
        <p className="text-muted-foreground mt-3 max-w-md text-base">
          This preview keeps orders in this browser tab. If you closed it, the
          ticket is gone.
        </p>
        <Link
          href="/app"
          className="bg-cocoa text-cream mt-6 inline-flex min-h-12 items-center px-5 font-semibold"
        >
          Order again
        </Link>
      </div>
    );
  }

  const step = ORDER_STATUSES.indexOf(order.status);

  return (
    <div>
      <p className="text-husk text-sm">{order.id}</p>
      <h1 className="font-display mt-1 text-4xl">We have your order</h1>
      <p className="text-muted-foreground mt-3 max-w-md text-base leading-relaxed">
        {order.customerName}, headed to {order.deliveryArea}. Kitchen will move
        this ticket as they cook.
      </p>
      <ol className="mt-8 grid grid-cols-4 gap-1">
        {ORDER_STATUSES.map((status, index) => (
          <li key={status} className="text-center">
            <span
              className={`block border-b-4 pb-2 text-xs font-semibold sm:text-sm ${
                index <= step
                  ? "border-palm text-cocoa"
                  : "border-border text-muted-foreground"
              }`}
            >
              {statusLabel(status)}
            </span>
          </li>
        ))}
      </ol>
      <p className={`mt-6 inline-flex border px-3 py-1 text-sm font-semibold ${statusTone(order.status)}`}>
        Now: {statusLabel(order.status)}
      </p>
      <ul className="mt-8 divide-y divide-border border-y border-border">
        {order.lines.map((line) => (
          <li key={line.itemId} className="flex justify-between gap-3 py-3 text-sm">
            <span>
              {line.qty} × {line.name}
            </span>
            <span className="font-medium">{formatGhs(line.qty * line.unitPrice)}</span>
          </li>
        ))}
      </ul>
      <div className="mt-4 flex justify-between font-medium">
        <span>Total</span>
        <span className="font-display text-palm text-2xl">{formatGhs(order.total)}</span>
      </div>
      {payment ? (
        <p className="text-muted-foreground mt-4 text-sm">
          Mock {payment.status} on {payment.network?.toUpperCase()} · {payment.reference}
        </p>
      ) : null}
      {order.notes ? (
        <p className="mt-3 text-sm">Kitchen note: {order.notes}</p>
      ) : null}
      <p className="mt-8 text-base">
        To follow up, call{" "}
        <a className="font-semibold underline" href={`tel:${site.followUpPhoneTel}`}>
          {site.followUpPhoneDisplay}
        </a>
        .
      </p>
    </div>
  );
}
