"use client";

import { useEffect, useRef, useState } from "react";
import { deliveryRouteLeg } from "@/lib/maps/route-leg";
import { loadGoogleMaps } from "./google-location-picker";
import { mapPinIcon } from "./map-pins";
import type { StreamChange } from "@/lib/live/apply";

type Point = { latitude: number; longitude: number };

function hasPoint(point: Point | null | undefined): point is Point {
  return typeof point?.latitude === "number" && typeof point.longitude === "number";
}

export function RiderTrackingMap({
  initialLocation,
  destination = null,
  kitchen = null,
  locationUrl,
  riderId,
  orderId = "",
  orderStatus,
  forCustomer = false,
}: {
  initialLocation: Point | null;
  destination?: Point | null;
  kitchen?: Point | null;
  locationUrl: string;
  riderId: string;
  orderId?: string;
  orderStatus: string;
  forCustomer?: boolean;
}) {
  const node = useRef<HTMLDivElement>(null);
  const map = useRef<google.maps.Map | null>(null);
  const riderMarker = useRef<google.maps.Marker | null>(null);
  const destinationMarker = useRef<google.maps.Marker | null>(null);
  const kitchenMarker = useRef<google.maps.Marker | null>(null);
  const yellowRoute = useRef<google.maps.Polyline | null>(null);
  const blueRoute = useRef<google.maps.Polyline | null>(null);
  const [heard, setHeard] = useState<{ id: string; base: string; status: string } | null>(null);
  if (heard && (heard.id !== orderId || heard.base !== orderStatus)) setHeard(null);
  const status = heard && heard.id === orderId && heard.base === orderStatus ? heard.status : orderStatus;
  const [location, setLocation] = useState(initialLocation);
  const locationRef = useRef(location);
  useEffect(() => { locationRef.current = location; }, [location]);
  const [error, setError] = useState("");
  const [mapError, setMapError] = useState("");
  const [loading, setLoading] = useState(true);
  const destinationLat = hasPoint(destination) ? destination.latitude : null;
  const destinationLng = hasPoint(destination) ? destination.longitude : null;
  const kitchenLat = hasPoint(kitchen) ? kitchen.latitude : null;
  const kitchenLng = hasPoint(kitchen) ? kitchen.longitude : null;

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const response = await fetch(locationUrl, { cache: "no-store", credentials: "same-origin" });
        const result = await response.json();
        if (!response.ok || result?.ok !== true) throw new Error(result?.error || "Could not refresh rider location.");
        const point = result.item?.riderLocation ?? result.location ?? result.item;
        const latitude = Number(point?.latitude);
        const longitude = Number(point?.longitude);
        if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
          if (active) {
            setLocation({ latitude, longitude });
            setError("");
          }
        } else if (active) {
          setError("Rider location is not available yet.");
        }
      } catch (reason) {
        if (active) setError(reason instanceof Error ? reason.message : "Could not refresh rider location.");
      }
    };
    void refresh();
    return () => { active = false; };
  }, [locationUrl]);

  useEffect(() => {
    const onStream = (event: Event) => {
      const change = (event as CustomEvent<StreamChange>).detail;
      if (change.table !== "rider_locations" || change.id !== riderId || !change.row) return;
      const latitude = Number(change.row.latitude);
      const longitude = Number(change.row.longitude);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;
      setLocation({ latitude, longitude });
      setError("");
    };
    window.addEventListener("pml-stream", onStream);
    return () => window.removeEventListener("pml-stream", onStream);
  }, [riderId]);

  useEffect(() => {
    if (!orderId) return;
    const onStream = (event: Event) => {
      const change = (event as CustomEvent<StreamChange>).detail;
      if (change.table !== "orders" || change.id !== orderId || typeof change.row?.status !== "string") return;
      setHeard({ id: orderId, base: orderStatus, status: change.row.status });
    };
    window.addEventListener("pml-stream", onStream);
    return () => window.removeEventListener("pml-stream", onStream);
  }, [orderId, orderStatus]);

  useEffect(() => {
    let active = true;
    void loadGoogleMaps().then((maps) => {
      if (!active || !node.current) return;
      const currentLocation = locationRef.current;
      const center = currentLocation
        ? { lat: currentLocation.latitude, lng: currentLocation.longitude }
        : destinationLat !== null && destinationLng !== null
          ? { lat: destinationLat, lng: destinationLng }
          : kitchenLat !== null && kitchenLng !== null
            ? { lat: kitchenLat, lng: kitchenLng }
            : { lat: 5.6037, lng: -0.187 };
      const instance = new maps.Map(node.current, {
        center,
        zoom: 13,
        mapTypeControl: true,
        streetViewControl: false,
      });
      map.current = instance;
      riderMarker.current = new maps.Marker({
        map: instance,
        position: center,
        icon: mapPinIcon(maps, "rider"),
        title: "Rider's current location",
        zIndex: 3,
      });
      if (destinationLat !== null && destinationLng !== null) {
        destinationMarker.current = new maps.Marker({
          map: instance,
          position: { lat: destinationLat, lng: destinationLng },
          icon: mapPinIcon(maps, "customer"),
          title: "Customer",
          zIndex: 1,
        });
      }
      if (kitchenLat !== null && kitchenLng !== null) {
        kitchenMarker.current = new maps.Marker({
          map: instance,
          position: { lat: kitchenLat, lng: kitchenLng },
          icon: mapPinIcon(maps, "kitchen"),
          title: "Kitchen",
          zIndex: 2,
        });
      }
      yellowRoute.current = new maps.Polyline({ map: instance, strokeColor: "#f4b400", strokeOpacity: 0.95, strokeWeight: 5 });
      blueRoute.current = new maps.Polyline({ map: instance, strokeColor: "#1a73e8", strokeOpacity: 0.95, strokeWeight: 5 });
      setLoading(false);
    }).catch((reason: unknown) => {
      if (active) {
        setMapError(reason instanceof Error ? reason.message : "The map could not be loaded.");
        setLoading(false);
      }
    });
    return () => {
      active = false;
      riderMarker.current?.setMap(null);
      destinationMarker.current?.setMap(null);
      kitchenMarker.current?.setMap(null);
      yellowRoute.current?.setMap(null);
      blueRoute.current?.setMap(null);
      map.current = null;
    };
  }, [destinationLat, destinationLng, kitchenLat, kitchenLng]);

  useEffect(() => {
    let active = true;
    const instance = map.current;
    if (!instance) return;
    if (location) riderMarker.current?.setPosition({ lat: location.latitude, lng: location.longitude });
    const toCustomer = forCustomer || deliveryRouteLeg(status) === "customer";
    const origin = location
      ? { lat: location.latitude, lng: location.longitude }
      : forCustomer && kitchenLat !== null && kitchenLng !== null
        ? { lat: kitchenLat, lng: kitchenLng }
        : null;
    const target = toCustomer
      ? destinationLat !== null && destinationLng !== null ? { lat: destinationLat, lng: destinationLng } : null
      : kitchenLat !== null && kitchenLng !== null ? { lat: kitchenLat, lng: kitchenLng } : null;
    if (toCustomer) yellowRoute.current?.setPath([]);
    else blueRoute.current?.setPath([]);
    if (!origin || !target) {
      yellowRoute.current?.setPath([]);
      blueRoute.current?.setPath([]);
      return;
    }
    void loadGoogleMaps().then((maps) => maps.routes.Route.computeRoutes({
      origin,
      destination: target,
      travelMode: maps.TravelMode.DRIVING,
      fields: ["path", "viewport"],
    })).then(({ routes }) => {
      if (!active) return;
      const route = routes?.[0];
      if (!route?.path?.length) throw new Error("Google did not return a driving route.");
      const path = route.path.map((point) => ({ lat: point.lat, lng: point.lng }));
      yellowRoute.current?.setPath(toCustomer ? [] : path);
      blueRoute.current?.setPath(toCustomer ? path : []);
      if (route.viewport) instance.fitBounds(route.viewport);
      setError("");
    }).catch((reason: unknown) => {
      if (active) setError(reason instanceof Error ? reason.message : "The rider route could not be refreshed.");
    });
    return () => { active = false; };
  }, [location, destinationLat, destinationLng, kitchenLat, kitchenLng, loading, status, forCustomer]);

  return <div>
    <div ref={node} className="google-map-canvas google-route-canvas" aria-label="Live rider location and delivery destination" />
    {loading && <p className="google-location-message" role="status">Loading live rider map…</p>}
    {mapError && <p className="google-location-error" role="alert">Map unavailable: {mapError}</p>}
    {error && <p className="google-location-error" role="status">{error}</p>}
    <p className="google-location-message">
      Scooter: rider{kitchenLat !== null ? " · Pot: kitchen" : ""}{destinationLat !== null ? " · House: customer" : ""}
      {" · "}{forCustomer
        ? "Blue: route to you"
        : deliveryRouteLeg(status) === "customer" ? "Blue: route to the customer" : "Yellow: route to the kitchen"}
    </p>
  </div>;
}

export function RiderMissionMap({
  location,
  kitchen,
  destination,
  orderStatus,
}: {
  location: Point | null;
  kitchen: Point;
  destination: Point;
  orderStatus: string;
}) {
  const node = useRef<HTMLDivElement>(null);
  const map = useRef<google.maps.Map | null>(null);
  const riderMarker = useRef<google.maps.Marker | null>(null);
  const kitchenMarker = useRef<google.maps.Marker | null>(null);
  const destinationMarker = useRef<google.maps.Marker | null>(null);
  const yellowRoute = useRef<google.maps.Polyline | null>(null);
  const blueRoute = useRef<google.maps.Polyline | null>(null);
  const [error, setError] = useState("");
  const [mapError, setMapError] = useState("");
  const [loading, setLoading] = useState(true);
  const locationRef = useRef(location);
  useEffect(() => { locationRef.current = location; }, [location]);
  const kitchenLat = kitchen.latitude;
  const kitchenLng = kitchen.longitude;
  const destinationLat = destination.latitude;
  const destinationLng = destination.longitude;

  useEffect(() => {
    let active = true;
    void loadGoogleMaps().then((maps) => {
      if (!active || !node.current) return;
      const current = locationRef.current;
      const center = current ? { lat: current.latitude, lng: current.longitude } : { lat: kitchenLat, lng: kitchenLng };
      const instance = new maps.Map(node.current, { center, zoom: 12, mapTypeControl: true, streetViewControl: false });
      map.current = instance;
      riderMarker.current = new maps.Marker({
        map: instance, position: center, icon: mapPinIcon(maps, "rider"),
        title: "Rider's current location", zIndex: 3,
      });
      kitchenMarker.current = new maps.Marker({
        map: instance, position: { lat: kitchenLat, lng: kitchenLng },
        icon: mapPinIcon(maps, "kitchen"), title: "Kitchen", zIndex: 2,
      });
      destinationMarker.current = new maps.Marker({
        map: instance, position: { lat: destinationLat, lng: destinationLng },
        icon: mapPinIcon(maps, "customer"), title: "Customer destination", zIndex: 1,
      });
      yellowRoute.current = new maps.Polyline({ map: instance, strokeColor: "#f4b400", strokeOpacity: .95, strokeWeight: 5 });
      blueRoute.current = new maps.Polyline({ map: instance, strokeColor: "#1a73e8", strokeOpacity: .95, strokeWeight: 5 });
      setLoading(false);
    }).catch((reason: unknown) => {
      if (active) {
        setMapError(reason instanceof Error ? reason.message : "The map could not be loaded.");
        setLoading(false);
      }
    });
    return () => {
      active = false;
      riderMarker.current?.setMap(null);
      kitchenMarker.current?.setMap(null);
      destinationMarker.current?.setMap(null);
      yellowRoute.current?.setMap(null);
      blueRoute.current?.setMap(null);
      map.current = null;
    };
  }, [kitchenLat, kitchenLng, destinationLat, destinationLng]);

  useEffect(() => {
    let active = true;
    const instance = map.current;
    if (!instance || !location) return;
    const current = { lat: location.latitude, lng: location.longitude };
    const target = { lat: destinationLat, lng: destinationLng };
    const toCustomer = deliveryRouteLeg(orderStatus) === "customer";
    const kitchenPoint = { lat: kitchenLat, lng: kitchenLng };
    riderMarker.current?.setPosition(current);
    if (toCustomer) yellowRoute.current?.setPath([]);
    else blueRoute.current?.setPath([]);
    const refreshRoutes = async () => {
      const maps = await loadGoogleMaps();
      const result = await maps.routes.Route.computeRoutes({
        origin: current,
        destination: toCustomer ? target : kitchenPoint,
        travelMode: maps.TravelMode.DRIVING,
        fields: ["path", "viewport"],
      });
      return result.routes?.[0]?.path ?? null;
    };
    void refreshRoutes().then((path) => {
      if (!active) return;
      if (!path?.length) throw new Error("Google did not return a driving route.");
      const line = path.map((point) => ({ lat: point.lat, lng: point.lng }));
      yellowRoute.current?.setPath([]);
      blueRoute.current?.setPath([]);
      yellowRoute.current?.setPath(toCustomer ? [] : line);
      blueRoute.current?.setPath(toCustomer ? line : []);
      const bounds = new google.maps.LatLngBounds();
      bounds.extend(current);
      bounds.extend(toCustomer ? target : kitchenPoint);
      instance.fitBounds(bounds);
      setError("");
    }).catch((reason: unknown) => {
      if (active) setError(reason instanceof Error ? reason.message : "Could not load the route.");
    });
    return () => { active = false; };
  }, [location, kitchenLat, kitchenLng, destinationLat, destinationLng, orderStatus, loading]);

  return <div>
    <div ref={node} className="google-map-canvas google-route-canvas" aria-label="Rider position and delivery route" />
    {loading && <p className="google-location-message" role="status">Loading delivery map…</p>}
    {mapError && <p className="google-location-error" role="alert">Map unavailable: {mapError}</p>}
    {!location && <p className="google-location-error" role="status">Enable location sharing to show your current position and routes.</p>}
    {error && <p className="google-location-error" role="status">{error}</p>}
    <p className="google-location-message">Scooter: rider · Pot: kitchen · House: customer · {deliveryRouteLeg(orderStatus) === "customer" ? "Blue: route to the customer" : "Yellow: route to the kitchen"}</p>
  </div>;
}
