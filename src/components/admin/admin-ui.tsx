"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { AdminOrder, ItemResponse } from "@/lib/admin/contracts";
import { formatGhs } from "@/lib/content";

export async function adminRequest<T = { ok: true }>(url: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(url, {
    ...init, cache: "no-store", credentials: "same-origin",
    headers: { ...(init.body instanceof FormData ? {} : { "Content-Type": "application/json" }), ...init.headers },
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || data?.ok !== true) {
    if (response.status === 401 && !url.endsWith("/login") && !url.endsWith("/password"))
      window.dispatchEvent(new Event("admin-session-expired"));
    throw new Error(data?.error || "The kitchen desk could not connect. Please try again.");
  }
  return data as T;
}

export function useAdminResource<T>(url: string) {
  const [version, setVersion] = useState(0);
  const key = `${url}:${version}`;
  const [result, setResult] = useState<{ key: string; data: T | null; error: string } | null>(null);
  const reload = useCallback(() => setVersion((value) => value + 1), []);
  useEffect(() => {
    const controller = new AbortController();
    adminRequest<T>(url, { signal: controller.signal })
      .then((value) => { if (!controller.signal.aborted) setResult({ key, data: value, error: "" }); })
      .catch((err: Error) => { if (!controller.signal.aborted) setResult({ key, data: null, error: err.message }); });
    return () => controller.abort();
  }, [url, key]);
  const current = result?.key === key;
  return { data: current ? result.data : null, error: current ? result.error : "", loading: !current, reload };
}

export function PageHeading({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) {
  return <header className="admin-heading"><div><h1 className="font-display">{title}</h1><p>{description}</p></div>{action}</header>;
}

export function ResourceState({ loading, error, retry }: { loading: boolean; error: string; retry: () => void }) {
  if (loading) return <div className="admin-loading" role="status"><p>Loading the latest records…</p><div /><div /><div /></div>;
  if (error) return <div className="admin-empty"><h2>Unable to load records</h2><p role="alert">{error}</p><button className="admin-button" onClick={retry}>Try again</button></div>;
  return null;
}

export function EmptyState({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="admin-empty"><h2>{title}</h2><p>{children}</p></div>;
}

export const orderLabels = { pending: "Pending", cooking: "Cooking", ready: "Ready", out: "Out for delivery", completed: "Completed", cancelled: "Cancelled" };
export const paymentLabels = { pending: "Pending", paid: "Paid", cod: "Pay on delivery", failed: "Failed" };

export function Badge({ value, children }: { value: string; children: React.ReactNode }) {
  return <span className={`admin-badge admin-badge-${value}`}>{children}</span>;
}

export function dateLabel(value: string) {
  return new Intl.DateTimeFormat("en-GH", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Accra" }).format(new Date(value));
}

export function PaymentCell({ order, canCheck }: { order: AdminOrder; canCheck: boolean }) {
  const [status, setStatus] = useState(order.paymentStatus);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  if (!canCheck || status !== "pending" || !order.transactionId) return <>
    <Badge value={status}>{paymentLabels[status]}</Badge>
    {message && <small role="status" className={failed ? "admin-payment-error" : undefined}>{message}</small>}
  </>;
  async function check() {
    setBusy(true); setMessage(""); setFailed(false);
    try {
      const data = await adminRequest<ItemResponse<AdminOrder> & { message: string }>(`/api/admin/orders/${encodeURIComponent(order.id)}/payment`, { method: "POST", body: "{}" });
      setStatus(data.item.paymentStatus); setMessage(data.item.paymentStatus === "pending" ? data.message : "");
    } catch (err) { setFailed(true); setMessage((err as Error).message); }
    finally { setBusy(false); }
  }
  return <>
    <button type="button" className="admin-payment-check" disabled={busy} onClick={() => void check()} aria-label={`Check PaySwitch payment status for ${order.id}`}>
      <Badge value={status}>{busy ? "Checking…" : paymentLabels[status]}</Badge>
    </button>
    {message && <small role="status" className={failed ? "admin-payment-error" : undefined}>{message}</small>}
  </>;
}

export function OrderTable({ items, hrefBase = "/admin/orders", showCustomer = true, checkPayments = true }: { items: AdminOrder[]; hrefBase?: string; showCustomer?: boolean; checkPayments?: boolean }) {
  const orderHeading = showCustomer ? "Order / customer" : "Order";
  return <div className="admin-table-scroll"><table className="admin-table"><caption className="sr-only">Orders with separate payment and kitchen status</caption>
    <thead><tr><th>{orderHeading}</th><th>Placed · Accra time</th><th>Payment</th><th>Kitchen status</th><th className="admin-number">Total</th></tr></thead>
    <tbody>{items.map((order) => <tr key={order.id}>
      <td><span className="admin-cell-label">{orderHeading}</span><Link className="admin-order-link" href={`${hrefBase}/${encodeURIComponent(order.id)}`}>{order.id}</Link>{showCustomer && <small>{order.customerName}</small>}</td>
      <td><span className="admin-cell-label">Placed · Accra time</span>{dateLabel(order.createdAt)}<small>{order.fulfilment === "delivery" ? "Delivery" : "Pickup"}</small></td>
      <td><span className="admin-cell-label">Payment</span><PaymentCell key={order.paymentStatus} order={order} canCheck={checkPayments} /></td>
      <td><span className="admin-cell-label">Kitchen status</span><Badge value={order.status}>{orderLabels[order.status]}</Badge></td>
      <td className="admin-number"><span className="admin-cell-label">Total</span>{formatGhs(order.total)}</td>
    </tr>)}</tbody>
  </table></div>;
}

export function OrderTicket({ order, footnote }: { order: AdminOrder; footnote?: string }) {
  return <section className="admin-report"><h2>Order ticket</h2>
    <ul className="admin-line-items">{order.lines.map((line, index) => <li key={`${line.itemId}-${index}`}><span>{line.qty} × {line.name}</span><strong>{formatGhs(line.qty * line.unitPrice)}</strong></li>)}</ul>
    <div className="admin-ticket-total"><span>Total</span><strong>{formatGhs(order.total)}</strong></div>
    <dl className="admin-details"><div><dt>Payment</dt><dd><Badge value={order.paymentStatus}>{paymentLabels[order.paymentStatus]}</Badge></dd></div><div><dt>Transaction reference</dt><dd>{order.transactionId || "Not yet recorded"}</dd></div></dl>
    {footnote && <p className="admin-footnote">{footnote}</p>}
  </section>;
}

export function CustomerFulfilment({ order }: { order: AdminOrder }) {
  return <section className="admin-report"><h2>Customer & fulfilment</h2><dl className="admin-details">
    <div><dt>Customer</dt><dd>{order.customerName}</dd></div><div><dt>Phone</dt><dd><a href={`tel:${order.customerPhone}`}>{order.customerPhone}</a></dd></div>
    <div><dt>Email</dt><dd>{order.customerEmail ? <a href={`mailto:${order.customerEmail}`}>{order.customerEmail}</a> : "Not provided"}</dd></div>
    <div><dt>Fulfilment</dt><dd>{order.fulfilment === "delivery" ? "Delivery" : "Pickup"}</dd></div><div><dt>Preferred time</dt><dd>{order.preferredTime || "As soon as possible"}</dd></div>
    <div><dt>Customer notes</dt><dd className="admin-preserve">{order.notes || "No notes provided."}</dd></div>
  </dl></section>;
}
