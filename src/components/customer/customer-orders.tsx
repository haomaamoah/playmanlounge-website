"use client";

import { useEffect, useState } from "react";
import type { AdminOrder } from "@/lib/admin/contracts";
import { OrderTable } from "@/components/admin/admin-ui";

export function useCustomerResource<T>(url: string) {
  const [result, setResult] = useState<{ url: string; data: T | null; error: string } | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    fetch(url, { cache: "no-store", credentials: "same-origin", signal: controller.signal })
      .then(async (response) => {
        const data = await response.json().catch(() => null);
        if (!response.ok || data?.ok !== true) throw new Error(data?.error ?? "Could not load your orders.");
        return data as T;
      })
      .then((data) => setResult({ url, data, error: "" }))
      .catch((reason: Error) => { if (!controller.signal.aborted) setResult({ url, data: null, error: reason.message }); });
    return () => controller.abort();
  }, [url]);
  const current = result?.url === url;
  return { data: current ? result.data : null, error: current ? result.error : "" };
}

export function CustomerOrdersView({ orders }: { orders: AdminOrder[] }) {
  if (orders.length === 0) return <div className="mt-8 border border-border p-6">
    <h2 className="font-display text-2xl">No orders yet</h2>
    <p className="text-muted-foreground mt-2">Choose a combo or a favourite from the menu to get started.</p>
  </div>;
  return <div className="mt-8"><OrderTable items={orders} hrefBase="/app/orders" showCustomer={false} /></div>;
}

export function CustomerOrders() {
  const { data, error } = useCustomerResource<{ ok: true; orders: AdminOrder[] }>("/api/customer/orders");
  return <section>
    <h1 className="font-display text-4xl">Your orders</h1>
    <p className="text-muted-foreground mt-3">Recent orders placed with this account.</p>
    {error && <p role="alert" className="text-destructive mt-6">{error}</p>}
    {!data && !error && <p role="status" className="mt-6">Loading your orders…</p>}
    {data && <CustomerOrdersView orders={data.orders} />}
  </section>;
}
