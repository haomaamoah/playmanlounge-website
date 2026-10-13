"use client";

import { useEffect, useState } from "react";
import type { AdminOrder } from "@/lib/admin/contracts";
import { formatGhs } from "@/lib/content";

type OrdersResponse = { ok: true; orders: AdminOrder[] };

export function CustomerOrders() {
  const [orders, setOrders] = useState<AdminOrder[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/customer/orders", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const data = await response.json().catch(() => null);
        if (!response.ok || data?.ok !== true) throw new Error(data?.error ?? "Could not load your orders.");
        return data as OrdersResponse;
      })
      .then((data) => setOrders(data.orders))
      .catch((reason: Error) => { if (!controller.signal.aborted) setError(reason.message); });
    return () => controller.abort();
  }, []);

  return <section>
    <h1 className="font-display text-4xl">Your orders</h1>
    <p className="text-muted-foreground mt-3">Recent orders placed with this account.</p>
    {error && <p role="alert" className="text-destructive mt-6">{error}</p>}
    {orders === null && !error && <p role="status" className="mt-6">Loading your orders…</p>}
    {orders?.length === 0 && <div className="mt-8 border border-border p-6">
      <h2 className="font-display text-2xl">No orders yet</h2>
      <p className="text-muted-foreground mt-2">Choose a combo or a favourite from the menu to get started.</p>
    </div>}
    {orders && orders.length > 0 && <ul className="mt-6 divide-y divide-border border-y border-border">
      {orders.map((order) => (
        <li key={order.id} className="py-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-semibold">{order.id}</h2>
            <span className="font-display text-palm text-xl">{formatGhs(order.total)}</span>
          </div>
          <p className="text-muted-foreground mt-1 text-sm">
            {new Intl.DateTimeFormat("en-GH", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Accra" }).format(new Date(order.createdAt))}
            {" · "}{order.status}
          </p>
          <ul className="mt-3 text-sm">{order.lines.map((line, index) => (
            <li key={`${line.itemId}-${index}`}>{line.qty} × {line.name}</li>
          ))}</ul>
        </li>
      ))}
    </ul>}
  </section>;
}
