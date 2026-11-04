"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { MapPin } from "lucide-react";
import { streamMatches } from "@/lib/live/apply";
import { InfiniteScroll, LIST_PAGE_SIZE, useInfiniteList } from "@/components/infinite-list";
import { PortalSearch } from "@/components/portal-search";
import { MenuPlacementImage } from "@/components/orders/menu-placement-image";
import { useMenuGroups } from "@/components/orders/use-menu-groups";
import { menuPlacement, placementLabel, shortOrderId } from "@/lib/orders/display";
import { visibleInQueue } from "@/lib/riders/order-queue";
import { riderRequest } from "./rider-api";

type RiderOrder = {
  id: string;
  ref: string;
  status: string;
  paymentStatus: string;
  riderDeliveryStatus: string | null;
  riderId: string | null;
  customerName: string;
  deliveryAddress: string;
  deliveryLatitude: number | null;
  deliveryLongitude: number | null;
  kitchen: { name: string; latitude: number; longitude: number } | null;
  firstItemId: string;
};

const deliveryFilters = [
  { value: "all", label: "All orders" },
  { value: "", label: "Active" },
  { value: "open", label: "Open" },
  { value: "claimed", label: "Claimed" },
  { value: "delivered", label: "Delivered" },
  { value: "cancelled", label: "Cancelled" },
];

function deliveryCopy(status: string | null, kitchenStatus: string) {
  if (kitchenStatus === "cancelled") return { tone: "open", label: "Cancelled", action: "View order" };
  if (kitchenStatus === "completed") return { tone: "done", label: "Delivered", action: "Open delivery" };
  if (status === "picked_up") return { tone: "riding", label: "Picked up · on the way", action: "Open delivery" };
  if (status === "delivered") return { tone: "done", label: "Delivered", action: "Open delivery" };
  if (status !== null) return { tone: "accepted", label: "Accepted · awaiting pickup", action: "Open delivery" };
  return { tone: "open", label: "Open delivery", action: "View and claim" };
}

export function RiderOrders({ dashboard = false }: { dashboard?: boolean }) {
  const search = useSearchParams();
  const initialQueue = search.get("queue") ?? (dashboard ? "all" : "");
  const [queue, setQueue] = useState(deliveryFilters.some((entry) => entry.value === initialQueue) ? initialQueue : "");
  const [query, setQuery] = useState("");
  const [version, setVersion] = useState(0);
  const groups = useMenuGroups();
  const filtering = Boolean((queue && queue !== "all") || query);
  const list = useInfiniteList<RiderOrder>(`${queue}:${query}:${version}`, (offset, signal) => {
    const params = new URLSearchParams({
      queue,
      q: query,
      limit: String(LIST_PAGE_SIZE),
      offset: String(offset),
    });
    return riderRequest<{ ok: true; items: RiderOrder[]; total: number }>(`/api/rider/orders?${params}`, { signal })
      .then((result) => ({ items: result.items, total: result.total }));
  }, {
    table: "orders",
    id: (order) => order.id,
    accept: (row) => visibleInQueue(queue, row) && streamMatches(query, [row.id, row.ref, row.customerName, row.customerPhone]),
  });

  return <section>
    <header className="rider-page-heading">
      <div>
        {dashboard ? <h2 className="font-display">All delivery orders</h2> : <h1 className="font-display">Delivery orders</h1>}
        <p>Open jobs and your deliveries, including completed and cancelled orders.</p>
      </div>
      <button className="rider-button rider-button-secondary" onClick={() => setVersion((value) => value + 1)}>Refresh</button>
    </header>
    <PortalSearch
      label="Search orders by order ID, reference, customer name, email, or phone"
      placeholder="Search order ID, customer name, email, or phone"
      onSearch={setQuery}
    />
    <div className="rider-toolbar">
      <div className="rider-filters" role="group" aria-label="Filter deliveries">
        {deliveryFilters.map((entry) => (
          <button
            key={entry.value}
            type="button"
            aria-pressed={entry.value === queue}
            onClick={() => setQueue(entry.value)}
          >{entry.label}</button>
        ))}
      </div>
    </div>
    {list.error && <p className="rider-error" role="alert">{list.error}</p>}
    {list.loading && <p role="status">Loading delivery orders…</p>}
    {!list.loading && !list.error && <p className="rider-results" aria-live="polite">{list.total} matching orders</p>}
    {!list.loading && !list.error && !list.items.length && (
      <p className="rider-empty">{filtering
        ? "No matching deliveries. Try another search or filter, or choose All orders."
        : queue === "all" ? "No delivery orders yet." : "No open or assigned deliveries right now."}</p>
    )}
    <div className="rider-order-list">{list.items.map((order) => {
      const placement = menuPlacement(order.firstItemId, groups);
      const delivery = deliveryCopy(order.riderDeliveryStatus, order.status);
      const kind = placementLabel(placement);
      return <article className="rider-card rider-ticket" key={order.id}>
        <Link className="rider-ticket-link" href={`/rider/orders/${encodeURIComponent(order.id)}`} aria-label={`Open order ${order.ref}, ${kind}`}>
          <span className="rider-ticket-mark">
            <MenuPlacementImage placement={placement} alt={kind} />
          </span>
          <h2 className="rider-ticket-id font-display">{shortOrderId(order.ref)}</h2>
          <span className={`rider-ticket-status is-${delivery.tone}`}>{delivery.label}</span>
          <span className="rider-ticket-address">
            <MapPin size={16} aria-hidden="true" />
            <span>{order.deliveryAddress || "Delivery coordinates saved"}</span>
          </span>
          <span className="rider-ticket-meta">Customer: {order.customerName} · Kitchen: {order.kitchen?.name ?? "Unavailable"}</span>
          <span className="rider-ticket-action">{delivery.action}</span>
        </Link>
      </article>;
    })}</div>
    <InfiniteScroll sentinel={list.sentinel} loadingMore={list.loadingMore} />
  </section>;
}
