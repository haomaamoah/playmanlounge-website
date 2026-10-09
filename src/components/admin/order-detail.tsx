"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import type { AdminOrder, ItemResponse, OrderStatus } from "@/lib/admin/contracts";
import { formatGhs } from "@/lib/content";
import { Badge, PageHeading, ResourceState, adminRequest, dateLabel, orderLabels, paymentLabels, useAdminResource } from "./admin-ui";

export function OrderDetail() {
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
  return <><Link className="admin-back" href="/admin/orders">Back to orders</Link>
    <ResourceState loading={loading} error={error} retry={reload} />
    {order && <>
      <PageHeading title={order.id} description={`Placed ${dateLabel(order.createdAt)} · Accra time`} />
      {order.isDemo && <p className="admin-demo-note" role="note"><Badge value="demo">Demo</Badge> Sample order for training. Not a real customer order and excluded from Home totals.</p>}
      <div className="admin-detail-grid">
        <section className="admin-report"><h2>Order ticket</h2>
          <ul className="admin-line-items">{order.lines.map((line, index) => <li key={`${line.itemId}-${index}`}><span>{line.qty} × {line.name}</span><strong>{formatGhs(line.qty * line.unitPrice)}</strong></li>)}</ul>
          <div className="admin-ticket-total"><span>Total</span><strong>{formatGhs(order.total)}</strong></div>
          <dl className="admin-details"><div><dt>Payment</dt><dd><Badge value={order.paymentStatus}>{paymentLabels[order.paymentStatus]}</Badge></dd></div><div><dt>Transaction reference</dt><dd>{order.transactionId || "Not yet recorded"}</dd></div></dl>
          <p className="admin-footnote">Kitchen status changes do not mark an order as paid.</p>
        </section>
        <section className="admin-report"><h2>Customer & fulfilment</h2><dl className="admin-details">
          <div><dt>Customer</dt><dd>{order.customerName}</dd></div><div><dt>Phone</dt><dd><a href={`tel:${order.customerPhone}`}>{order.customerPhone}</a></dd></div>
          <div><dt>Email</dt><dd>{order.customerEmail ? <a href={`mailto:${order.customerEmail}`}>{order.customerEmail}</a> : "Not provided"}</dd></div>
          <div><dt>Fulfilment</dt><dd>{order.fulfilment === "delivery" ? "Delivery" : "Pickup"}</dd></div><div><dt>Preferred time</dt><dd>{order.preferredTime || "As soon as possible"}</dd></div>
          <div><dt>Customer notes</dt><dd className="admin-preserve">{order.notes || "No notes provided."}</dd></div>
        </dl></section>
      </div>
      <section className="admin-report admin-status-editor"><h2>Kitchen status</h2><Badge value={order.status}>{orderLabels[order.status]}</Badge>
        <form onSubmit={(event) => { event.preventDefault(); const status = new FormData(event.currentTarget).get("status") as OrderStatus; if (status === "cancelled") setConfirmCancel(true); else void update(status); }}>
          <label>Update fulfilment<select name="status" key={order.status} defaultValue={order.status} disabled={busy}>{Object.entries(orderLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
          <button className="admin-button" disabled={busy}>{busy ? "Saving…" : "Save kitchen status"}</button>
        </form>
        {confirmCancel && <div className="admin-confirm"><p>Cancel this order? This changes fulfilment only and does not refund any payment.</p><button className="admin-button admin-button-danger" disabled={busy} onClick={() => update("cancelled")}>Confirm cancellation</button><button className="admin-button admin-button-secondary" disabled={busy} onClick={() => setConfirmCancel(false)}>Keep order</button></div>}
        {mutationError && <p className="admin-error" role="alert">{mutationError}</p>}{notice && <p className="admin-success" role="status">{notice}</p>}
      </section>
    </>}
  </>;
}
