"use client";

import { useCallback, useEffect, useState } from "react";
import { createContext, useContext } from "react";
import Link from "next/link";
import { menuPlacement, placementLabel, shortOrderId } from "@/lib/orders/display";
import { MenuPlacementImage } from "@/components/orders/menu-placement-image";
import { useMenuGroups } from "@/components/orders/use-menu-groups";
import { MapPin } from "lucide-react";
import { type AdminOrder, type ItemResponse, type OrderStatus } from "@/lib/admin/contracts";
import { formatGhs } from "@/lib/content";
import { GoogleDirectionsMap } from "@/components/google-location-picker";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const AdminBasePathContext = createContext("/admin");

export function AdminBasePathProvider({ basePath, children }: { basePath: string; children: React.ReactNode }) {
  return <AdminBasePathContext.Provider value={basePath}>{children}</AdminBasePathContext.Provider>;
}

export function useAdminBasePath() {
  return useContext(AdminBasePathContext);
}

export async function adminRequest<T = { ok: true }>(url: string, init: RequestInit = {}): Promise<T> {
  const portal = window.location.pathname.startsWith("/man/") || window.location.pathname === "/man"
    ? "manager"
    : "admin";
  const response = await fetch(url, {
    ...init, cache: "no-store", credentials: "same-origin",
    headers: { "X-PML-Portal": portal, ...(init.body instanceof FormData ? {} : { "Content-Type": "application/json" }), ...init.headers },
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

/** The single next kitchen step. Delivery goes out before it is completed; pickup completes from ready. */
export function nextKitchenStatus(order: Pick<AdminOrder, "status" | "paymentStatus" | "fulfilment">): OrderStatus | null {
  if (order.status === "completed" || order.status === "cancelled") return null;
  const next: OrderStatus | null =
    order.status === "pending" ? "cooking" :
    order.status === "cooking" ? "ready" :
    order.status === "ready" ? (order.fulfilment === "delivery" ? "out" : "completed") :
    order.status === "out" ? "completed" :
    null;
  if (!next) return null;
  if (order.paymentStatus !== "paid" && order.paymentStatus !== "cod") return null;
  return next;
}

function OrderStatusCell({ order }: { order: AdminOrder }) {
  return <Badge value={order.status}>{orderLabels[order.status]}</Badge>;
}

function OrderActions({ order, onUpdated }: { order: AdminOrder; onUpdated?: () => void }) {
  const [status, setStatus] = useState<OrderStatus>(order.status);
  const [busy, setBusy] = useState<"proceed" | "cancel" | "">("");
  const [message, setMessage] = useState("");
  const current = { ...order, status };
  const next = nextKitchenStatus(current);
  const cancelled = status === "cancelled";
  const proceedDisabled = busy !== "" || next === null;
  const cancelDisabled = busy !== "" || cancelled || status === "completed";

  async function update(action: "proceed" | "cancel", target: OrderStatus) {
    if (action === "cancel" && !window.confirm("Cancel this order? This changes kitchen fulfilment only and does not issue a refund.")) return;
    setBusy(action);
    setMessage("");
    try {
      const data = await adminRequest<ItemResponse<AdminOrder>>(`/api/admin/orders/${encodeURIComponent(order.id)}`, {
        method: "PATCH",
        body: JSON.stringify({ status: target }),
      });
      setStatus(data.item.status);
      onUpdated?.();
    } catch (err) {
      setMessage((err as Error).message);
    } finally {
      setBusy("");
    }
  }

  return <>
    <div className="admin-order-actions">
      <button
        type="button"
        className="admin-order-action admin-order-action-proceed"
        disabled={proceedDisabled}
        aria-label={next ? `Proceed order ${order.id} to ${orderLabels[next]}` : `Proceed is unavailable for order ${order.id}`}
        onClick={() => { if (next) void update("proceed", next); }}
      >
        <span className="admin-order-action-dot" aria-hidden="true" />
        {busy === "proceed" ? "Saving…" : "Proceed"}
      </button>
      <button
        type="button"
        className="admin-order-action admin-order-action-cancel"
        disabled={cancelDisabled}
        aria-label={`Cancel order ${order.id}`}
        onClick={() => void update("cancel", "cancelled")}
      >
        <span className="admin-order-action-dot" aria-hidden="true" />
        {busy === "cancel" ? "Saving…" : "Cancel"}
      </button>
    </div>
    {message && <small role="alert">{message}</small>}
  </>;
}

export function OrderTable({ items, hrefBase, showCustomer = true, checkPayments = true, canUpdateStatus = true, onOrderUpdated }: { items: AdminOrder[]; hrefBase?: string; showCustomer?: boolean; checkPayments?: boolean; canUpdateStatus?: boolean; onOrderUpdated?: () => void }) {
  const basePath = useAdminBasePath();
  const groups = useMenuGroups();
  const orderHrefBase = hrefBase ?? `${basePath}/orders`;
  const orderHeading = showCustomer ? "Order / customer" : "Order";
  return <div className="admin-table-scroll"><table className="admin-table"><caption className="sr-only">Orders with separate payment and kitchen status</caption>
    <thead><tr><th className="admin-kind-heading">Type</th><th>{orderHeading}</th><th>Placed · Accra time</th><th>Payment</th><th>Kitchen status</th>{canUpdateStatus && <th>Actions</th>}<th className="admin-number">Total</th></tr></thead>
    <tbody>{items.map((order) => {
      const placement = menuPlacement(order.lines[0]?.itemId, groups);
      const href = `${orderHrefBase}/${encodeURIComponent(order.id)}`;
      const label = placementLabel(placement);
      return <tr key={order.id} className="admin-order-row">
      <td className="admin-kind-cell"><span className="admin-cell-label">Type</span><MenuPlacementImage placement={placement} alt={label} /></td>
      <td><span className="admin-cell-label">{orderHeading}</span><Link className="admin-order-link" href={href} aria-label={`Open order ${order.id}, ${label}`}>{shortOrderId(order.id)}</Link>{showCustomer && <small>{order.customerName}</small>}</td>
      <td><span className="admin-cell-label">Placed · Accra time</span>{dateLabel(order.createdAt)}<small>{order.fulfilment === "delivery" ? "Delivery" : "Pickup"}</small></td>
      <td><span className="admin-cell-label">Payment</span><PaymentCell key={order.paymentStatus} order={order} canCheck={checkPayments} /></td>
      <td><span className="admin-cell-label">Kitchen status</span><OrderStatusCell order={order} /></td>
      {canUpdateStatus && <td><span className="admin-cell-label">Actions</span><OrderActions key={`${order.id}-${order.status}-${order.paymentStatus}`} order={order} onUpdated={onOrderUpdated} /></td>}
      <td className="admin-number"><span className="admin-cell-label">Total</span>{formatGhs(order.total)}</td>
    </tr>;
    })}</tbody>
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
  const [mapOpen, setMapOpen] = useState(false);
  const routeAvailable = order.fulfilment === "delivery" &&
    order.deliveryLatitude !== null && order.deliveryLongitude !== null &&
    order.kitchen?.latitude != null && order.kitchen.longitude != null;
  return <>
    <section className="admin-report"><h2>Customer & fulfilment</h2><dl className="admin-details">
    <div><dt>Customer</dt><dd>{order.customerName}</dd></div><div><dt>Phone</dt><dd><a href={`tel:${order.customerPhone}`}>{order.customerPhone}</a></dd></div>
    <div><dt>Email</dt><dd>{order.customerEmail ? <a href={`mailto:${order.customerEmail}`}>{order.customerEmail}</a> : "Not provided"}</dd></div>
    <div><dt>Fulfilment</dt><dd>{order.fulfilment === "delivery" ? "Delivery" : "Pickup"}</dd></div><div><dt>Preferred time</dt><dd>{order.preferredTime || "As soon as possible"}</dd></div>
    {order.fulfilment === "delivery" && <div><dt>Delivery address</dt><dd>{order.deliveryAddress || "Not provided"}</dd></div>}
    <div><dt>Customer notes</dt><dd className="admin-preserve">{order.notes || "No notes provided."}</dd></div>
    </dl>
    {order.fulfilment === "delivery" && <button
      type="button"
      className="admin-button admin-button-secondary admin-route-action"
      disabled={!routeAvailable}
      onClick={() => setMapOpen(true)}
      title={routeAvailable ? `Show route from ${order.kitchen?.name ?? "kitchen"} to delivery address` : "Map unavailable because kitchen or delivery GPS coordinates are missing"}
    >
      <MapPin size={17} aria-hidden="true" />
      {routeAvailable ? "View delivery route" : "Map unavailable · location coordinates missing"}
    </button>}
    </section>
    {routeAvailable && <Dialog open={mapOpen} onOpenChange={setMapOpen}>
      <DialogContent className="google-map-dialog sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Delivery route</DialogTitle>
          <DialogDescription>{order.kitchen?.name} to {order.deliveryAddress}</DialogDescription>
        </DialogHeader>
        <GoogleDirectionsMap
          origin={{ lat: order.kitchen!.latitude!, lng: order.kitchen!.longitude! }}
          destination={{ lat: order.deliveryLatitude!, lng: order.deliveryLongitude! }}
        />
      </DialogContent>
    </Dialog>}
  </>;
}
