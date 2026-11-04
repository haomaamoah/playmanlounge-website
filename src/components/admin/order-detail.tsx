"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import type { AdminOrder, ItemResponse } from "@/lib/admin/contracts";
import { Badge, CustomerFulfilment, OrderActions, OrderTicket, PageHeading, ResourceState, dateLabel, orderLabels, useAdminBasePath, useAdminResource } from "./admin-ui";
import { RiderDetails } from "./rider-details";

export function OrderDetail() {
  const basePath = useAdminBasePath();
  const { id } = useParams<{ id: string }>();
  const { data, loading, error, reload, setData } = useAdminResource<ItemResponse<AdminOrder>>(`/api/admin/orders/${encodeURIComponent(id)}`);
  const [notice, setNotice] = useState("");
  const order = data?.item;
  return <><Link className="admin-back" href={`${basePath}/orders`}>Back to orders</Link>
    <ResourceState loading={loading} error={error} retry={reload} />
    {order && <>
      <PageHeading title={order.id} description={`Placed ${dateLabel(order.createdAt)} · Accra time`} />
      <div className="admin-detail-grid">
        <OrderTicket order={order} footnote="Kitchen status changes do not mark an order as paid." />
        <CustomerFulfilment order={order} />
      </div>
      <RiderDetails order={order} locationUrl={`/api/admin/orders/${encodeURIComponent(order.id)}`} />
      <section className="admin-report admin-status-editor"><h2>Kitchen status</h2><Badge value={order.status}>{orderLabels[order.status]}</Badge>
        <OrderActions key={`${order.id}-${order.status}-${order.paymentStatus}`} order={order} onUpdated={(updated) => {
          setData((current) => current ? { ...current, item: { ...current.item, ...updated } } : current);
          setNotice(`Kitchen status changed to ${orderLabels[updated.status].toLowerCase()}.`);
        }} />
        {notice && <p className="admin-success" role="status">{notice}</p>}
      </section>
    </>}
  </>;
}
