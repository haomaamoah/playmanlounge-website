"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Bike, MapPin } from "lucide-react";
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

export function RiderOrders() {
  const [items, setItems] = useState<RiderOrder[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    riderRequest<{ ok: true; items: RiderOrder[] }>("/api/rider/orders", { signal: controller.signal })
      .then((result) => { if (!controller.signal.aborted) { setItems(result.items); setError(""); } })
      .catch((reason: Error) => { if (!controller.signal.aborted) setError(reason.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [version]);
  return <section>
    <header className="rider-page-heading"><div><h1 className="font-display">Delivery orders</h1><p>Claim an open delivery or continue an order assigned to you.</p></div>
      <button className="rider-button rider-button-secondary" onClick={() => { setLoading(true); setVersion((value) => value + 1); }}>Refresh</button>
    </header>
    {error && <p className="rider-error" role="alert">{error}</p>}
    {loading && <p role="status">Loading delivery orders…</p>}
    {!loading && !error && !items.length && <p className="rider-empty">No open or assigned deliveries right now.</p>}
    <div className="rider-order-list">{items.map((order) => {
      const mine = order.riderDeliveryStatus !== null;
      return <article className="rider-card" key={order.id}>
        <div className="rider-card-title"><Bike aria-hidden="true" /><div><h2>{order.ref}</h2><span>{mine ? order.riderDeliveryStatus === "picked_up" ? "Picked up · on the way" : order.riderDeliveryStatus === "delivered" ? "Delivered" : "Accepted · awaiting pickup" : "Open delivery"}</span></div></div>
        <p><MapPin size={16} aria-hidden="true" />{order.deliveryAddress || "Delivery coordinates saved"}</p>
        <p>Customer: {order.customerName} · Kitchen: {order.kitchen?.name ?? "Unavailable"}</p>
        <Link className="rider-button" href={`/rider/orders/${encodeURIComponent(order.id)}`}>{mine ? "Open delivery" : "View and claim"}</Link>
      </article>;
    })}</div>
  </section>;
}
