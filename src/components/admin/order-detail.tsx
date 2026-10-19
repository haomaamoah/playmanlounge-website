"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { availableOrderStatuses, type AdminOrder, type ItemResponse, type OrderStatus } from "@/lib/admin/contracts";
import { Badge, CustomerFulfilment, OrderTicket, PageHeading, ResourceState, adminRequest, dateLabel, orderLabels, useAdminBasePath, useAdminResource } from "./admin-ui";
import { RiderDetails } from "./rider-details";

export function OrderDetail() {
  const basePath = useAdminBasePath();
  const { id } = useParams<{ id: string }>();
  const { data, loading, error, reload } = useAdminResource<ItemResponse<AdminOrder>>(`/api/admin/orders/${encodeURIComponent(id)}`);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [mutationError, setMutationError] = useState("");
  const [confirmCancel, setConfirmCancel] = useState(false);
  async function update(status: OrderStatus) {
    setBusy(true); setMutationError(""); setNotice("");
    try {
      await adminRequest(`/api/admin/orders/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify({ status }) });
      setNotice(`Kitchen status changed to ${orderLabels[status].toLowerCase()}.`); setConfirmCancel(false); reload();
    } catch (err) { setMutationError((err as Error).message); }
    finally { setBusy(false); }
  }
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
        <form onSubmit={(event) => { event.preventDefault(); const status = new FormData(event.currentTarget).get("status") as OrderStatus; if (status === "cancelled") setConfirmCancel(true); else void update(status); }}>
          <label>Update fulfilment<select name="status" key={`${order.status}-${order.paymentStatus}`} defaultValue={order.status} disabled={busy}>{availableOrderStatuses(order.status, order.paymentStatus).map((value) => <option value={value} key={value}>{orderLabels[value]}</option>)}</select></label>
          <button className="admin-button" disabled={busy}>{busy ? "Saving…" : "Save kitchen status"}</button>
        </form>
        {confirmCancel && <div className="admin-confirm"><p>Cancel this order? This changes fulfilment only and does not refund any payment.</p><button className="admin-button admin-button-danger" disabled={busy} onClick={() => update("cancelled")}>Confirm cancellation</button><button className="admin-button admin-button-secondary" disabled={busy} onClick={() => setConfirmCancel(false)}>Keep order</button></div>}
        {mutationError && <p className="admin-error" role="alert">{mutationError}</p>}{notice && <p className="admin-success" role="status">{notice}</p>}
      </section>
    </>}
  </>;
}
