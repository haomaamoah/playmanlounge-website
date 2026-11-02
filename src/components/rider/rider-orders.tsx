"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { Bike, MapPin } from "lucide-react";
import { InfiniteScroll, LIST_PAGE_SIZE, useInfiniteList } from "@/components/infinite-list";
import { PortalSearch } from "@/components/portal-search";
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
};

const deliveryFilters = [
  { value: "", label: "All" },
  { value: "open", label: "Open" },
  { value: "claimed", label: "Claimed" },
  { value: "delivered", label: "Delivered" },
  { value: "cancelled", label: "Cancelled" },
];

export function RiderOrders() {
  const search = useSearchParams();
  const initialQueue = search.get("queue") ?? "";
  const [queue, setQueue] = useState(deliveryFilters.some((entry) => entry.value === initialQueue) ? initialQueue : "");
  const [query, setQuery] = useState("");
  const [version, setVersion] = useState(0);
  const filtering = Boolean(queue || query);
  const list = useInfiniteList<RiderOrder>(`${queue}:${query}:${version}`, (offset, signal) => {
    const params = new URLSearchParams({
      queue,
      q: query,
      limit: String(LIST_PAGE_SIZE),
      offset: String(offset),
    });
    return riderRequest<{ ok: true; items: RiderOrder[]; total: number }>(`/api/rider/orders?${params}`, { signal })
      .then((result) => ({ items: result.items, total: result.total }));
  });

  return <section>
    <header className="rider-page-heading">
      <div>
        <h1 className="font-display">Delivery orders</h1>
        <p>Claim an open delivery or continue an order assigned to you.</p>
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
        ? "No matching deliveries. Try another search or filter, or choose All."
        : "No open or assigned deliveries right now."}</p>
    )}
    <div className="rider-order-list">{list.items.map((order) => {
      const mine = order.riderDeliveryStatus !== null;
      return <article className="rider-card" key={order.id}>
        <div className="rider-card-title"><Bike aria-hidden="true" /><div><h2>{order.ref}</h2><span>{mine ? order.riderDeliveryStatus === "picked_up" ? "Picked up · on the way" : order.riderDeliveryStatus === "delivered" ? "Delivered" : "Accepted · awaiting pickup" : "Open delivery"}</span></div></div>
        <p><MapPin size={16} aria-hidden="true" />{order.deliveryAddress || "Delivery coordinates saved"}</p>
        <p>Customer: {order.customerName} · Kitchen: {order.kitchen?.name ?? "Unavailable"}</p>
        <Link className="rider-button" href={`/rider/orders/${encodeURIComponent(order.id)}`}>{mine ? "Open delivery" : "View and claim"}</Link>
      </article>;
    })}</div>
    <InfiniteScroll sentinel={list.sentinel} loadingMore={list.loadingMore} />
  </section>;
}
