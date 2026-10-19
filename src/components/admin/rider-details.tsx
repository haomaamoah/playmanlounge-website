"use client";

import { MapPin } from "lucide-react";
import { useState } from "react";
import type { AdminOrder } from "@/lib/admin/contracts";
import { hasActiveRiderTracking } from "@/lib/riders/privacy";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RiderTrackingMap } from "@/components/rider-tracking-map";

export function RiderDetails({
  order,
  locationUrl,
  isCustomerView = false,
}: {
  order: AdminOrder;
  locationUrl: string;
  isCustomerView?: boolean;
}) {
  const [mapOpen, setMapOpen] = useState(false);
  const rider = order.rider;
  if (!rider) return null;
  const customerTrackingActive = !isCustomerView ||
    hasActiveRiderTracking(order.riderDeliveryStatus);
  const hasMap = order.fulfilment === "delivery" &&
    order.deliveryLatitude !== null && order.deliveryLongitude !== null &&
    customerTrackingActive;
  const unavailableLabel = customerTrackingActive
    ? "Map unavailable · coordinates missing"
    : "Live tracking ended";
  return <>
    <section className="admin-report">
      <h2>Delivery rider</h2>
      <dl className="admin-details">
        <div><dt>Name</dt><dd>{rider.name}</dd></div>
        <div><dt>Contact</dt><dd><a href={`tel:${rider.phone}`}>{rider.phone}</a></dd></div>
        <div><dt>Motorcycle</dt><dd>{[rider.bikeColor, rider.bikeModel, rider.licensePlate].filter(Boolean).join(" · ") || "Not provided"}</dd></div>
        <div><dt>Delivery</dt><dd>{order.riderDeliveryStatus === "picked_up" ? "Picked up · on the way" : order.riderDeliveryStatus === "delivered" ? "Delivered" : "Accepted · not picked up"}</dd></div>
      </dl>
      <button type="button" className="admin-button admin-button-secondary admin-route-action"
        disabled={!hasMap} onClick={() => setMapOpen(true)}
        title={hasMap ? "Show the rider's latest location and delivery destination" : unavailableLabel}>
        <MapPin size={17} aria-hidden="true" /> {hasMap ? "Track rider" : unavailableLabel}
      </button>
    </section>
    {hasMap && <Dialog open={mapOpen} onOpenChange={setMapOpen}>
      <DialogContent className="google-map-dialog sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Live rider tracking</DialogTitle>
          <DialogDescription>{rider.name} · {order.deliveryAddress}</DialogDescription>
        </DialogHeader>
        <RiderTrackingMap
          initialLocation={order.riderLocation ?? null}
          destination={{ latitude: order.deliveryLatitude!, longitude: order.deliveryLongitude! }}
          locationUrl={locationUrl}
        />
      </DialogContent>
    </Dialog>}
  </>;
}
