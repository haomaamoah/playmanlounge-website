"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { AdminOrder } from "@/lib/admin/contracts";
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

export function OrderTable({ items }: { items: AdminOrder[] }) {
  return <div className="admin-table-scroll"><table className="admin-table"><caption className="sr-only">Orders with separate payment and kitchen status</caption>
    <thead><tr><th>Order / customer</th><th>Placed · Accra time</th><th>Payment</th><th>Kitchen status</th><th className="admin-number">Total</th></tr></thead>
    <tbody>{items.map((order) => <tr key={order.id}>
      <td><span className="admin-cell-label">Order / customer</span><Link className="admin-order-link" href={`/admin/orders/${encodeURIComponent(order.id)}`}>{order.id}</Link><small>{order.customerName}{order.isDemo && <> · <Badge value="demo">Demo</Badge></>}</small></td>
      <td><span className="admin-cell-label">Placed · Accra time</span>{dateLabel(order.createdAt)}<small>{order.fulfilment === "delivery" ? "Delivery" : "Pickup"}</small></td>
      <td><span className="admin-cell-label">Payment</span><Badge value={order.paymentStatus}>{paymentLabels[order.paymentStatus]}</Badge></td>
      <td><span className="admin-cell-label">Kitchen status</span><Badge value={order.status}>{orderLabels[order.status]}</Badge></td>
      <td className="admin-number"><span className="admin-cell-label">Total</span>{formatGhs(order.total)}</td>
    </tr>)}</tbody>
  </table></div>;
}
