"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { MapPin, Phone } from "lucide-react";
import { RiderMissionMap } from "@/components/rider-tracking-map";
import { riderRequest } from "./rider-api";

type RiderOrder = {
  id: string;
  ref: string;
  status: string;
  paymentStatus: string;
  riderDeliveryStatus: "assigned" | "picked_up" | "delivered" | null;
  riderId: string | null;
  customerName: string;
  customerPhone: string;
  deliveryAddress: string;
  deliveryLatitude: number | null;
  deliveryLongitude: number | null;
  kitchen: { name: string; latitude: number; longitude: number } | null;
  riderLocation: { latitude: number; longitude: number; updatedAt: string } | null;
};

export function RiderOrderDetail() {
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<RiderOrder | null>(null);
  const [location, setLocation] = useState<RiderOrder["riderLocation"]>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [tracking, setTracking] = useState(false);

  async function reload() {
    try {
      const result = await riderRequest<{ ok: true; item: RiderOrder }>(`/api/rider/orders/${encodeURIComponent(id)}`);
      setOrder(result.item); setLocation(result.item.riderLocation); setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load this delivery.");
    } finally { setLoading(false); }
  }

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    riderRequest<{ ok: true; item: RiderOrder }>(`/api/rider/orders/${encodeURIComponent(id)}`, { signal: controller.signal })
      .then((result) => { if (active) { setOrder(result.item); setLocation(result.item.riderLocation); setError(""); } })
      .catch((reason: Error) => { if (active) setError(reason.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; controller.abort(); };
  }, [id]);

  useEffect(() => {
    if (!tracking || !navigator.geolocation) return;
    let latest: GeolocationCoordinates | null = null;
    let lastSent = 0;
    let requestBusy = false;
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        latest = position.coords;
        setLocation({ latitude: position.coords.latitude, longitude: position.coords.longitude, updatedAt: new Date().toISOString() });
        setError("");
      },
      (reason) => setError(reason.code === reason.PERMISSION_DENIED ? "Allow location access to share your live position." : "Could not read your current GPS position."),
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 15000 },
    );
    const timer = window.setInterval(() => {
      if (!latest || requestBusy || Date.now() - lastSent < 4500) return;
      requestBusy = true;
      lastSent = Date.now();
      void riderRequest("/api/rider/location", {
        method: "POST", body: JSON.stringify({ latitude: latest.latitude, longitude: latest.longitude }),
      }).then(() => setError("")).catch((reason: Error) => setError(reason.message)).finally(() => { requestBusy = false; });
    }, 1000);
    return () => {
      navigator.geolocation.clearWatch(watchId);
      window.clearInterval(timer);
    };
  }, [tracking, id]);

  function toggleTracking() {
    if (!tracking && !navigator.geolocation) {
      setError("This device does not support GPS location sharing.");
      return;
    }
    setTracking((value) => !value);
  }

  async function action(name: "claim" | "pickup" | "complete") {
    const labels = { claim: "claim this delivery", pickup: "confirm pickup", complete: "complete the delivery" };
    if (name !== "claim" && !window.confirm(`Do you want to ${labels[name]}?`)) return;
    setBusy(name); setError(""); setNotice("");
    try {
      const result = await riderRequest<{ ok: true; item: RiderOrder }>(`/api/rider/orders/${encodeURIComponent(id)}/${name}`, { method: "POST", body: "{}" });
      setOrder(result.item); setLocation(result.item.riderLocation);
      setTracking(name !== "complete");
      setNotice(name === "claim" ? "Delivery accepted. Share your location while heading to the kitchen." : name === "pickup" ? "Pickup confirmed. Follow the route to the customer." : "Delivery marked complete.");
      if (name === "complete") setTracking(false);
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "Could not update this delivery.";
      setError(message.includes("Someone else has taken") ? "Someone else has taken the order. It is no longer available to claim." : message);
      if (message.includes("Someone else has taken")) await reload();
    } finally { setBusy(""); }
  }

  const coordsReady = order?.deliveryLatitude != null && order.deliveryLongitude != null &&
    order.kitchen?.latitude != null && order.kitchen.longitude != null;
  if (loading) return <p role="status">Loading delivery…</p>;
  if (!order) return <section><Link className="rider-back" href="/rider/orders">Back to orders</Link><p className="rider-error" role="alert">{error || "Delivery not found."}</p></section>;

  return <section>
    <Link className="rider-back" href="/rider/orders">Back to orders</Link>
    <header className="rider-page-heading"><div><h1 className="font-display">{order.ref}</h1><p>{order.deliveryAddress}</p></div>
      <span className="rider-status">{order.riderDeliveryStatus ?? "Open delivery"}</span>
    </header>
    {error && <p className="rider-error" role="alert">{error}</p>}
    {notice && <p className="rider-success" role="status">{notice}</p>}
    <div className="rider-order-meta">
      <p><strong>Customer:</strong> {order.customerName}</p>
      <p><Phone size={15} aria-hidden="true" /><a href={`tel:${order.customerPhone}`}>{order.customerPhone}</a></p>
      <p><strong>Kitchen:</strong> {order.kitchen?.name ?? "Kitchen coordinates unavailable"}</p>
      <p><MapPin size={15} aria-hidden="true" />{order.deliveryLatitude != null && order.deliveryLongitude != null ? `${order.deliveryLatitude.toFixed(5)}, ${order.deliveryLongitude.toFixed(5)}` : "Delivery GPS coordinates unavailable"}</p>
    </div>
    <div className="rider-actions">
      {!order.riderId && <button className="rider-button" disabled={busy !== ""} onClick={() => void action("claim")}>{busy === "claim" ? "Accepting…" : "Accept delivery"}</button>}
      {order.riderDeliveryStatus === "assigned" && <button className="rider-button" disabled={busy !== "" || order.status !== "ready"} onClick={() => void action("pickup")}>{busy === "pickup" ? "Saving…" : order.status === "ready" ? "Confirm pickup" : "Waiting for kitchen to mark ready"}</button>}
      {order.riderDeliveryStatus === "picked_up" && <button className="rider-button" disabled={busy !== ""} onClick={() => void action("complete")}>{busy === "complete" ? "Saving…" : "Mark delivered"}</button>}
      {(order.riderDeliveryStatus === "assigned" || order.riderDeliveryStatus === "picked_up" || !order.riderId) &&
        <button className="rider-button rider-button-secondary" onClick={toggleTracking}>{tracking ? "Stop sharing location" : "Share live location"}</button>}
    </div>
    {coordsReady && <section className="rider-map-panel">
      <h2>Delivery map</h2>
      {!tracking && <p>Share your location to show your live position and route. Location sharing stops when you leave this delivery screen.</p>}
      {tracking && <RiderMissionMap
        location={location}
        kitchen={{ latitude: order.kitchen!.latitude, longitude: order.kitchen!.longitude }}
        destination={{ latitude: order.deliveryLatitude!, longitude: order.deliveryLongitude! }}
        pickedUp={order.riderDeliveryStatus === "picked_up"}
      />}
    </section>}
    {!coordsReady && <p className="rider-error">Map unavailable: kitchen or delivery GPS coordinates are missing.</p>}
  </section>;
}
