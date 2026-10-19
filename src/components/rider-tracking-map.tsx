"use client";

import { useEffect, useRef, useState } from "react";
import { loadGoogleMaps } from "./google-location-picker";

type Point = { latitude: number; longitude: number };

export function RiderTrackingMap({
  initialLocation,
  destination,
  locationUrl,
}: {
  initialLocation: Point | null;
  destination: Point;
  locationUrl: string;
}) {
  const node = useRef<HTMLDivElement>(null);
  const map = useRef<google.maps.Map | null>(null);
  const riderMarker = useRef<google.maps.Marker | null>(null);
  const destinationMarker = useRef<google.maps.Marker | null>(null);
  const routeLine = useRef<google.maps.Polyline | null>(null);
  const [location, setLocation] = useState(initialLocation);
  const locationRef = useRef(location);
  useEffect(() => { locationRef.current = location; }, [location]);
  const [error, setError] = useState("");
  const [mapError, setMapError] = useState("");
  const [loading, setLoading] = useState(true);
  const destinationLat = destination.latitude;
  const destinationLng = destination.longitude;

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const response = await fetch(locationUrl, { cache: "no-store", credentials: "same-origin" });
        const result = await response.json();
        if (!response.ok || result?.ok !== true) throw new Error(result?.error || "Could not refresh rider location.");
        const point = result.item?.riderLocation ?? result.location ?? result.item;
        if (typeof point?.latitude === "number" && typeof point?.longitude === "number") {
          if (active) {
            setLocation({ latitude: point.latitude, longitude: point.longitude });
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
    const timer = window.setInterval(() => void refresh(), 5000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [locationUrl]);

  useEffect(() => {
    let active = true;
    void loadGoogleMaps().then((maps) => {
      if (!active || !node.current) return;
      const currentLocation = locationRef.current;
      const center = currentLocation
        ? { lat: currentLocation.latitude, lng: currentLocation.longitude }
        : { lat: destinationLat, lng: destinationLng };
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
        icon: "https://maps.google.com/mapfiles/ms/icons/orange-dot.png",
        title: "Rider's current location",
      });
      destinationMarker.current = new maps.Marker({
        map: instance,
        position: { lat: destinationLat, lng: destinationLng },
        icon: "https://maps.google.com/mapfiles/ms/icons/green-dot.png",
        title: "Delivery destination",
      });
      routeLine.current = new maps.Polyline({ map: instance, strokeColor: "#1a73e8", strokeOpacity: 0.95, strokeWeight: 5 });
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
      routeLine.current?.setMap(null);
      map.current = null;
    };
  }, [destinationLat, destinationLng]);

  useEffect(() => {
    let active = true;
    const instance = map.current;
    if (!instance || !location) return;
    const origin = { lat: location.latitude, lng: location.longitude };
    riderMarker.current?.setPosition(origin);
    void loadGoogleMaps().then((maps) => maps.routes.Route.computeRoutes({
      origin,
      destination: { lat: destinationLat, lng: destinationLng },
      travelMode: maps.TravelMode.DRIVING,
      fields: ["path", "viewport"],
    })).then(({ routes }) => {
      if (!active) return;
      const route = routes?.[0];
      if (!route?.path?.length) throw new Error("Google did not return a driving route.");
      routeLine.current?.setPath(route.path.map((point) => ({ lat: point.lat, lng: point.lng })));
      if (route.viewport) instance.fitBounds(route.viewport);
    }).catch((reason: unknown) => {
      if (active) setError(reason instanceof Error ? reason.message : "The rider route could not be refreshed.");
    });
    return () => { active = false; };
  }, [location, destinationLat, destinationLng, loading]);

  return <div>
    <div ref={node} className="google-map-canvas google-route-canvas" aria-label="Live rider location and delivery destination" />
    {loading && <p className="google-location-message" role="status">Loading live rider map…</p>}
    {mapError && <p className="google-location-error" role="alert">Map unavailable: {mapError}</p>}
    {error && <p className="google-location-error" role="status">{error}</p>}
  </div>;
}

export function RiderMissionMap({
  location,
  kitchen,
  destination,
  pickedUp,
}: {
  location: Point | null;
  kitchen: Point;
  destination: Point;
  pickedUp: boolean;
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
        map: instance, position: center, icon: "https://maps.google.com/mapfiles/ms/icons/orange-dot.png",
        title: "Rider's current location",
      });
      kitchenMarker.current = new maps.Marker({
        map: instance, position: { lat: kitchenLat, lng: kitchenLng },
        title: "Kitchen",
      });
      destinationMarker.current = new maps.Marker({
        map: instance, position: { lat: destinationLat, lng: destinationLng },
        icon: "https://maps.google.com/mapfiles/ms/icons/green-dot.png", title: "Customer destination",
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
    riderMarker.current?.setPosition(current);
    const refreshRoutes = async () => {
      const maps = await loadGoogleMaps();
      if (pickedUp) {
        const result = await maps.routes.Route.computeRoutes({
          origin: current, destination: target, travelMode: maps.TravelMode.DRIVING, fields: ["path", "viewport"],
        });
        return { paths: [result.routes?.[0]?.path ?? null] };
      }
      const [toKitchen, toCustomer] = await Promise.all([
        maps.routes.Route.computeRoutes({
          origin: current, destination: { lat: kitchenLat, lng: kitchenLng },
          travelMode: maps.TravelMode.DRIVING, fields: ["path", "viewport"],
        }),
        maps.routes.Route.computeRoutes({
          origin: { lat: kitchenLat, lng: kitchenLng }, destination: target,
          travelMode: maps.TravelMode.DRIVING, fields: ["path", "viewport"],
        }),
      ]);
      return { paths: [toKitchen.routes?.[0]?.path ?? null, toCustomer.routes?.[0]?.path ?? null] };
    };
    void refreshRoutes().then(({ paths }) => {
      if (!active) return;
      if (paths.some((path) => !path?.length)) throw new Error("Google did not return a driving route.");
      if (pickedUp) {
        yellowRoute.current?.setPath([]);
        blueRoute.current?.setPath(paths[0]!.map((point) => ({ lat: point.lat, lng: point.lng })));
      } else {
        yellowRoute.current?.setPath(paths[0]!.map((point) => ({ lat: point.lat, lng: point.lng })));
        blueRoute.current?.setPath(paths[1]!.map((point) => ({ lat: point.lat, lng: point.lng })));
      }
      const bounds = new google.maps.LatLngBounds();
      bounds.extend(current);
      bounds.extend(target);
      if (!pickedUp) bounds.extend({ lat: kitchenLat, lng: kitchenLng });
      instance.fitBounds(bounds);
      setError("");
    }).catch((reason: unknown) => {
      if (active) setError(reason instanceof Error ? reason.message : "Could not load the delivery routes.");
    });
    return () => { active = false; };
  }, [location, kitchenLat, kitchenLng, destinationLat, destinationLng, pickedUp, loading]);

  return <div>
    <div ref={node} className="google-map-canvas google-route-canvas" aria-label="Rider position and delivery route" />
    {loading && <p className="google-location-message" role="status">Loading delivery map…</p>}
    {mapError && <p className="google-location-error" role="alert">Map unavailable: {mapError}</p>}
    {!location && <p className="google-location-error" role="status">Enable location sharing to show your current position and routes.</p>}
    {error && <p className="google-location-error" role="status">{error}</p>}
    <p className="google-location-message">Orange: rider · Green: customer · {pickedUp ? "Blue: route to customer" : "Yellow: route to kitchen · Blue: route to customer"}</p>
  </div>;
}
