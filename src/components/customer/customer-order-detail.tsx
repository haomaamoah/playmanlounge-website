"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCustomerResource } from "./customer-orders";
import type { AdminOrder } from "@/lib/admin/contracts";
import { CustomerFulfilment, OrderTicket, dateLabel } from "@/components/admin/admin-ui";
import { RiderDetails } from "@/components/admin/rider-details";

export function CustomerOrderDetailView({ order }: { order: AdminOrder }) {
  return <>
    <h1 className="font-display text-4xl break-words">{order.id}</h1>
    <p className="text-muted-foreground mt-3">Placed {dateLabel(order.createdAt)} · Accra time</p>
    <div className="admin-detail-grid mt-8">
      <OrderTicket order={order} />
      <CustomerFulfilment order={order} />
    </div>
    <RiderDetails
      order={order}
      locationUrl={`/api/customer/orders/${encodeURIComponent(order.id)}`}
      isCustomerView
    />
  </>;
}

export function CustomerOrderDetail() {
  const { id } = useParams<{ id: string }>();
  const { data, error } = useCustomerResource<{ ok: true; item: AdminOrder }>(`/api/customer/orders/${encodeURIComponent(id)}`);
  return <section>
    <Link className="admin-back" href="/app/orders">Back to orders</Link>
    {error && <p role="alert" className="text-destructive mt-6">{error}</p>}
    {!data && !error && <p role="status" className="mt-6">Loading your order…</p>}
    {data && <CustomerOrderDetailView order={data.item} />}
  </section>;
}
