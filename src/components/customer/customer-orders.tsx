"use client";

import { useEffect, useState } from "react";
import type { AdminOrder } from "@/lib/admin/contracts";
import { OrderTable } from "@/components/admin/admin-ui";
import { PortalSearch } from "@/components/portal-search";

export function useCustomerResource<T>(url: string, errorMessage = "Could not load your orders.") {
  const [result, setResult] = useState<{ url: string; data: T | null; error: string } | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    fetch(url, { cache: "no-store", credentials: "same-origin", signal: controller.signal })
      .then(async (response) => {
        const data = await response.json().catch(() => null);
        if (!response.ok || data?.ok !== true) throw new Error(data?.error ?? errorMessage);
        return data as T;
      })
      .then((data) => { if (!controller.signal.aborted) setResult({ url, data, error: "" }); })
      .catch((reason: Error) => { if (!controller.signal.aborted) setResult({ url, data: null, error: reason.message }); });
    return () => controller.abort();
  }, [url, errorMessage]);
  const current = result?.url === url;
  return { data: current ? result.data : null, error: current ? result.error : "" };
}

export function CustomerOrdersView({ orders }: { orders: AdminOrder[] }) {
  if (orders.length === 0) return <div className="mt-8 border border-border p-6">
    <h2 className="font-display text-2xl">No orders yet</h2>
    <p className="text-muted-foreground mt-2">Choose a combo or a favourite from the menu to get started.</p>
  </div>;
  return <div className="mt-8"><OrderTable items={orders} hrefBase="/app/orders" showCustomer={false} checkPayments={false} /></div>;
}

export function CustomerOrders() {
  const [query, setQuery] = useState("");
  const { data, error } = useCustomerResource<{ ok: true; orders: AdminOrder[] }>(`/api/customer/orders?q=${encodeURIComponent(query)}`);
  return <section>
    <h1 className="font-display text-4xl">Your orders</h1>
    <p className="text-muted-foreground mt-3">Recent orders placed with this account.</p>
    <PortalSearch label="Search your orders by order ID or payment reference" placeholder="Search order ID or payment reference" onSearch={setQuery} />
    {error && <p role="alert" className="text-destructive mt-6">{error}</p>}
    {!data && !error && <p role="status" className="mt-6">Loading your orders…</p>}
    {data && (query && !data.orders.length ? <p role="status" className="mt-6">No matching orders. Try another reference or clear your search.</p> : <CustomerOrdersView orders={data.orders} />)}
  </section>;
}
