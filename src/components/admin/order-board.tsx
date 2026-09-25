"use client";

import Link from "next/link";
import { formatGhs } from "@/lib/content";
import { deskTime, statusTone } from "@/lib/mocks/display";
import { nextStatus, statusLabel } from "@/lib/mocks/seed";
import { ORDER_STATUSES } from "@/lib/mocks/types";
import { useMockStore } from "@/lib/mocks/store";

export function OrderBoard() {
  const { orders, payments, advanceOrder } = useMockStore();

  return (
    <div>
      <h1 className="font-display text-3xl sm:text-4xl">Tickets</h1>
      <p className="text-muted-foreground mt-2 max-w-xl text-sm">
        Paid orders land here. Move a ticket as the wok finishes. Failed MoMo
        stays on Payments, not on this rail.
      </p>
      <div className="mt-6 grid gap-4 lg:grid-cols-4">
        {ORDER_STATUSES.map((status) => {
          const column = orders.filter((order) => {
            const payment = payments.find((entry) => entry.id === order.paymentId);
            if (payment?.status === "failed") return false;
            return order.status === status;
          });
          return (
            <section key={status} className="bg-cream min-h-48 border border-border p-3">
              <h2 className="font-display flex items-baseline justify-between text-xl">
                {statusLabel(status)}
                <span className="text-husk text-sm font-sans">{column.length}</span>
              </h2>
              <ul className="mt-3 space-y-3">
                {column.map((order) => (
                  <li key={order.id} className="border-cocoa bg-surface border-l-4 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <Link
                        href={`/admin/orders/${order.id}`}
                        className="font-semibold underline-offset-2 hover:underline"
                      >
                        {order.id}
                      </Link>
                      <span className="text-muted-foreground text-xs">
                        {deskTime(order.createdAt)}
                      </span>
                    </div>
                    <p className="mt-1 text-sm">{order.customerName}</p>
                    <p className="text-muted-foreground text-sm">
                      {order.lines.map((line) => `${line.qty}× ${line.name}`).join(", ")}
                    </p>
                    <p className="font-display text-palm mt-2">{formatGhs(order.total)}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <span
                        className={`inline-flex border px-2 py-0.5 text-xs font-semibold ${statusTone(order.status)}`}
                      >
                        {statusLabel(order.status)}
                      </span>
                      {nextStatus(order.status) ? (
                        <button
                          type="button"
                          onClick={() => advanceOrder(order.id)}
                          className="bg-cocoa text-cream inline-flex min-h-11 items-center px-3 text-xs font-semibold"
                        >
                          Mark {statusLabel(nextStatus(order.status)!)}
                        </button>
                      ) : null}
                    </div>
                  </li>
                ))}
                {column.length === 0 ? (
                  <li className="text-muted-foreground text-sm">No tickets.</li>
                ) : null}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
