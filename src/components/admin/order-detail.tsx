"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { formatGhs, site } from "@/lib/content";
import { deskDate, deskTime, paymentTone, statusTone } from "@/lib/mocks/display";
import { networkLabel, nextStatus, statusLabel } from "@/lib/mocks/seed";
import { useMockStore } from "@/lib/mocks/store";

export function OrderDetail() {
  const params = useParams<{ id: string }>();
  const { orders, payments, advanceOrder, ready } = useMockStore();
  const order = orders.find((entry) => entry.id === params.id);
  const payment = payments.find((entry) => entry.id === order?.paymentId);

  if (!ready) return <p>Loading ticket…</p>;
  if (!order) {
    return (
      <div>
        <p>That ticket is not on this desk.</p>
        <Link href="/admin/orders" className="mt-4 inline-flex underline">
          Back to the board
        </Link>
      </div>
    );
  }

  const upcoming = nextStatus(order.status);

  return (
    <div className="mx-auto max-w-xl">
      <Link href="/admin/orders" className="text-sm underline">
        All tickets
      </Link>
      <p className="text-husk mt-4 text-sm">
        {deskDate(order.createdAt)} · {deskTime(order.createdAt)}
      </p>
      <h1 className="font-display mt-1 text-4xl">{order.id}</h1>
      <p className={`mt-4 inline-flex border px-3 py-1 text-sm font-semibold ${statusTone(order.status)}`}>
        {statusLabel(order.status)}
      </p>
      <dl className="mt-6 space-y-2 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">Customer</dt>
          <dd className="font-medium">{order.customerName}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">Phone</dt>
          <dd>
            <a className="underline" href={`tel:${order.customerPhone.replace(/\s/g, "")}`}>
              {order.customerPhone}
            </a>
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">Area</dt>
          <dd>{order.deliveryArea}</dd>
        </div>
        {payment ? (
          <>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">MoMo</dt>
              <dd>{networkLabel(payment.network)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Payment</dt>
              <dd className={`px-2 py-0.5 text-xs font-semibold ${paymentTone(payment.status)}`}>
                {payment.status} · {payment.reference}
              </dd>
            </div>
          </>
        ) : null}
      </dl>
      <ul className="mt-6 divide-y divide-border border-y border-border">
        {order.lines.map((line) => (
          <li key={line.itemId} className="flex justify-between py-3 text-sm">
            <span>
              {line.qty} × {line.name}
            </span>
            <span>{formatGhs(line.qty * line.unitPrice)}</span>
          </li>
        ))}
      </ul>
      {order.notes ? <p className="mt-4 text-sm">Note: {order.notes}</p> : null}
      <p className="font-display text-palm mt-4 text-3xl">{formatGhs(order.total)}</p>
      {upcoming ? (
        <button
          type="button"
          onClick={() => advanceOrder(order.id)}
          className="bg-cocoa text-cream mt-6 inline-flex min-h-12 items-center px-5 font-semibold"
        >
          Mark {statusLabel(upcoming)}
        </button>
      ) : (
        <p className="mt-6 text-sm">This ticket has left the hatch.</p>
      )}
      <p className="text-muted-foreground mt-6 text-sm">
        Customer follow-up line is{" "}
        <a className="underline" href={`tel:${site.followUpPhoneTel}`}>
          {site.followUpPhoneDisplay}
        </a>
        .
      </p>
    </div>
  );
}
