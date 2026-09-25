"use client";

import Link from "next/link";
import { formatGhs } from "@/lib/content";
import { deskDate, deskTime, paymentTone } from "@/lib/mocks/display";
import { networkLabel } from "@/lib/mocks/seed";
import { useMockStore } from "@/lib/mocks/store";

export function PaymentsLedger() {
  const { payments, orders } = useMockStore();

  return (
    <div>
      <h1 className="font-display text-3xl sm:text-4xl">Receipts</h1>
      <p className="text-muted-foreground mt-2 max-w-xl text-sm">
        Mock ledger only. Kitchen test stays visible so we can see a 10 pesewa
        row without a real plate.
      </p>
      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[40rem] text-left text-sm">
          <thead className="border-cocoa border-b-2">
            <tr>
              <th className="py-2 pr-3 font-medium">When</th>
              <th className="py-2 pr-3 font-medium">Order</th>
              <th className="py-2 pr-3 font-medium">Amount</th>
              <th className="py-2 pr-3 font-medium">Network</th>
              <th className="py-2 pr-3 font-medium">Status</th>
              <th className="py-2 font-medium">Ref</th>
            </tr>
          </thead>
          <tbody>
            {payments.map((payment) => {
              const order = orders.find((entry) => entry.id === payment.orderId);
              return (
                <tr key={payment.id} className="border-border border-b">
                  <td className="py-3 pr-3 whitespace-nowrap">
                    {deskDate(payment.createdAt)} {deskTime(payment.createdAt)}
                  </td>
                  <td className="py-3 pr-3">
                    <Link href={`/admin/orders/${payment.orderId}`} className="underline">
                      {payment.orderId}
                    </Link>
                    {payment.isKitchenTest ? (
                      <span className="text-husk ml-2 text-xs">Kitchen test</span>
                    ) : null}
                    {order ? (
                      <p className="text-muted-foreground text-xs">{order.customerName}</p>
                    ) : null}
                  </td>
                  <td className="font-display text-palm py-3 pr-3">
                    {formatGhs(payment.amount)}
                  </td>
                  <td className="py-3 pr-3">{networkLabel(payment.network)}</td>
                  <td className="py-3 pr-3">
                    <span className={`inline-flex px-2 py-0.5 text-xs font-semibold ${paymentTone(payment.status)}`}>
                      {payment.status}
                    </span>
                  </td>
                  <td className="py-3 font-mono text-xs">{payment.reference}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
