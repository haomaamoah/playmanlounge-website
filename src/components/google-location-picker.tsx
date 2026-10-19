"use client";

import { MapPin, Navigation, Search } from "lucide-react";
import { importLibrary, setOptions } from "@googlemaps/js-api-loader";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const accra = { lat: 5.6037, lng: -0.187 };
let mapsPromise: Promise<typeof google.maps> | null = null;

type Location = { address: string; latitude: number | null; longitude: number | null };

async function loadMaps() {
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim();
  if (!key) throw new Error("Maps are not configured. Set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY.");
  if (!mapsPromise) {
    setOptions({ key, v: "weekly", language: "en", region: "GH" });
    mapsPromise = importLibrary("maps")
      .then(() => importLibrary("places"))
      .then(() => importLibrary("routes"))
      .then(() => google.maps);
  }
  return mapsPromise;
}

function getBrowserLocation(): Promise<google.maps.LatLngLiteral> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("This browser does not support location access."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => resolve({ lat: coords.latitude, lng: coords.longitude }),
      () => reject(new Error("Location access was denied. You can still choose a point on the map.")),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
    );
  });
}

export function GoogleLocationPicker({
  label,
  value,
  onChange,
  required = false,
  error,
  name,
}: {
  label: string;
  value: Location;
  onChange: (location: Location) => void;
  required?: boolean;
  error?: string;
  name?: string;
}) {
  const [query, setQuery] = useState(value.address);
  const [suggestions, setSuggestions] = useState<google.maps.places.AutocompleteSuggestion[]>([]);
  const [searchError, setSearchError] = useState("");
  const [busy, setBusy] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [mapBusy, setMapBusy] = useState(false);
  const [mapError, setMapError] = useState("");
  const [mapNotice, setMapNotice] = useState("");
  const [pin, setPin] = useState<google.maps.LatLngLiteral | null>(null);
  const searchVersion = useRef(0);
  const mapNode = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);
  const mapPromiseRef = useRef<Promise<typeof google.maps> | null>(null);
  const sessionTokenRef = useRef<google.maps.places.AutocompleteSessionToken | null>(null);

  useEffect(() => {
    const requestId = ++searchVersion.current;
    if (
      query.trim().length < 3 ||
      (query === value.address && value.latitude !== null && value.longitude !== null)
    ) {
      return;
    }
    const timer = window.setTimeout(() => {
      setBusy(true);
      setSearchError("");
      void loadMaps()
        .then((maps) => {
          sessionTokenRef.current ??= new maps.places.AutocompleteSessionToken();
          return maps.places.AutocompleteSuggestion.fetchAutocompleteSuggestions({
            input: query.trim(),
            includedRegionCodes: ["gh"],
            sessionToken: sessionTokenRef.current,
          });
        })
        .then(({ suggestions: results }) => {
          if (requestId === searchVersion.current) setSuggestions(results);
        })
        .catch((reason: unknown) => {
          if (requestId === searchVersion.current) {
            setSuggestions([]);
            setSearchError(reason instanceof Error ? reason.message : "Address search could not be loaded.");
          }
        })
        .finally(() => {
          if (requestId === searchVersion.current) setBusy(false);
        });
    }, 250);
    return () => window.clearTimeout(timer);
  }, [query, value.address, value.latitude, value.longitude]);

  async function chooseSuggestion(suggestion: google.maps.places.AutocompleteSuggestion) {
    const prediction = suggestion.placePrediction;
    if (!prediction) return;
    setBusy(true);
    setSearchError("");
    try {
      const place = prediction.toPlace();
      await place.fetchFields({ fields: ["formattedAddress", "location"] });
      if (!place.location) throw new Error("Google did not return coordinates for this address.");
      const address = place.formattedAddress ?? prediction.text.toString();
      setQuery(address);
      setSuggestions([]);
      onChange({ address, latitude: place.location.lat(), longitude: place.location.lng() });
      sessionTokenRef.current = null;
    } catch (reason) {
      setSearchError(reason instanceof Error ? reason.message : "That address could not be selected.");
    } finally {
      setBusy(false);
    }
  }

  async function setCurrentLocation() {
    setBusy(true);
    setSearchError("");
    try {
      const [maps, position] = await Promise.all([loadMaps(), getBrowserLocation()]);
      const results = await new maps.Geocoder().geocode({ location: position });
      const address = results.results[0]?.formatted_address;
      if (!address) throw new Error("Your current location could not be turned into an address.");
      setQuery(address);
      setSuggestions([]);
      onChange({ address, latitude: position.lat, longitude: position.lng });
      sessionTokenRef.current = null;
    } catch (reason) {
      setSearchError(reason instanceof Error ? reason.message : "Current location could not be found.");
    } finally {
      setBusy(false);
    }
  }

  async function openMap() {
    setMapOpen(true);
    setMapBusy(true);
    setMapError("");
    setMapNotice("");
    try {
      const maps = await loadMaps();
      mapPromiseRef.current = Promise.resolve(maps);
      let center = value.latitude !== null && value.longitude !== null
        ? { lat: value.latitude, lng: value.longitude }
        : accra;
      if (value.latitude === null || value.longitude === null) {
        try {
          center = await getBrowserLocation();
        } catch (reason) {
          setMapNotice(reason instanceof Error ? reason.message : "Using Accra as the map starting point.");
        }
      }
      setPin(center);
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      if (!mapNode.current) return;
      const map = new maps.Map(mapNode.current, {
        center,
        zoom: 16,
        mapTypeControl: true,
        mapTypeControlOptions: {
          style: maps.MapTypeControlStyle.HORIZONTAL_BAR,
          position: maps.ControlPosition.TOP_RIGHT,
          mapTypeIds: [maps.MapTypeId.ROADMAP, maps.MapTypeId.SATELLITE, maps.MapTypeId.TERRAIN],
        },
        streetViewControl: false,
        fullscreenControl: true,
      });
      mapRef.current = map;
      const marker = markerRef.current ?? new maps.Marker({ map, position: center, draggable: true, title: "Delivery or kitchen location" });
      marker.setMap(map);
      markerRef.current = marker;
      marker.setPosition(center);
      maps.event.clearListeners(map, "click");
      maps.event.clearListeners(marker, "dragend");
      map.addListener("click", (event: google.maps.MapMouseEvent) => {
        if (!event.latLng) return;
        const next = event.latLng.toJSON();
        marker.setPosition(next);
        setPin(next);
      });
      marker.addListener("dragend", () => {
        const next = marker.getPosition()?.toJSON();
        if (next) setPin(next);
      });
    } catch (reason) {
      setMapError(reason instanceof Error ? reason.message : "The map could not be loaded.");
    } finally {
      setMapBusy(false);
    }
  }

  async function centerMapOnCurrentLocation() {
    setMapBusy(true);
    setMapError("");
    try {
      const next = await getBrowserLocation();
      setPin(next);
      mapRef.current?.setCenter(next);
      markerRef.current?.setPosition(next);
      setMapNotice("");
    } catch (reason) {
      setMapError(reason instanceof Error ? reason.message : "Current location could not be found.");
    } finally {
      setMapBusy(false);
    }
  }

  async function confirmMapLocation() {
    if (!pin) return;
    setMapBusy(true);
    setMapError("");
    try {
      const maps = await (mapPromiseRef.current ?? loadMaps());
      const results = await new maps.Geocoder().geocode({ location: pin });
      const address = results.results[0]?.formatted_address ?? query.trim();
      if (!address) throw new Error("Choose an address or map point with a recognizable address.");
      setQuery(address);
      onChange({ address, latitude: pin.lat, longitude: pin.lng });
      sessionTokenRef.current = null;
      setSuggestions([]);
      setMapOpen(false);
    } catch (reason) {
      setMapError(reason instanceof Error ? reason.message : "The selected map point could not be resolved.");
    } finally {
      setMapBusy(false);
    }
  }

  function editQuery(next: string) {
    setQuery(next);
    setSuggestions([]);
    setSearchError("");
    searchVersion.current++;
    if (next !== value.address) onChange({ address: next, latitude: null, longitude: null });
  }

  return (
    <div className="google-location-field">
      {name && <>
        <input type="hidden" name={`${name}_address`} value={value.address} />
        <input type="hidden" name={`${name}_latitude`} value={value.latitude ?? ""} />
        <input type="hidden" name={`${name}_longitude`} value={value.longitude ?? ""} />
      </>}
      <label>
        <span>{label}</span>
        <span className="google-location-input-wrap">
          <Search size={18} aria-hidden="true" />
          <input
            value={query}
            onChange={(event) => editQuery(event.target.value)}
            required={required}
            minLength={3}
            maxLength={300}
            placeholder="Search for an address or place"
            autoComplete="off"
            aria-invalid={Boolean(error || searchError)}
            aria-describedby={error || searchError ? "google-location-error" : undefined}
          />
          <button type="button" className="google-map-open" onClick={() => void openMap()} aria-label={`Choose ${label.toLowerCase()} on map`}>
            <MapPin size={20} aria-hidden="true" />
          </button>
        </span>
      </label>
      {busy && <p className="google-location-message" role="status">Searching Google Maps…</p>}
      {suggestions.length > 0 && (
        <ul className="google-location-suggestions" aria-label="Address suggestions">
          {suggestions.map((suggestion, index) => {
            const prediction = suggestion.placePrediction;
            return prediction ? (
              <li key={`${prediction.placeId ?? prediction.text}-${index}`}>
                <button type="button" onClick={() => void chooseSuggestion(suggestion)}>
                  <MapPin size={16} aria-hidden="true" />
                  <span>{prediction.text.toString()}</span>
                </button>
              </li>
            ) : null;
          })}
          <li className="google-attribution"><span>Powered by Google</span></li>
        </ul>
      )}
      {(error || searchError) && <p id="google-location-error" className="google-location-error" role="alert">{error || searchError}</p>}
      <button type="button" className="google-current-location" onClick={() => void setCurrentLocation()} disabled={busy}>
        <Navigation size={16} aria-hidden="true" /> Use current location
      </button>
      {value.latitude !== null && value.longitude !== null && (
        <p className="google-location-message">Map pin set · {value.latitude.toFixed(5)}, {value.longitude.toFixed(5)}</p>
      )}
      <Dialog open={mapOpen} onOpenChange={setMapOpen}>
        <DialogContent className="google-map-dialog sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Choose {label.toLowerCase()} on the map</DialogTitle>
            <DialogDescription>Move the pin or tap the map. Use the map type control to switch to satellite or terrain.</DialogDescription>
          </DialogHeader>
          <div className="google-map-toolbar">
            <span><MapPin size={16} aria-hidden="true" /> Move the pin to the exact location</span>
            <Button type="button" variant="outline" size="sm" onClick={() => void centerMapOnCurrentLocation()} disabled={mapBusy}>
              <Navigation size={16} aria-hidden="true" /> Use current location
            </Button>
          </div>
          <div ref={mapNode} className="google-map-canvas" aria-label="Interactive location map" />
          {mapNotice && <p className="google-location-message" role="status">{mapNotice}</p>}
          {mapError && <p className="google-location-error" role="alert">{mapError}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setMapOpen(false)}>Cancel</Button>
            <Button type="button" onClick={() => void confirmMapLocation()} disabled={!pin || mapBusy}>
              {mapBusy ? "Loading…" : "Use this location"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function GoogleDirectionsMap({
  origin,
  destination,
}: {
  origin: google.maps.LatLngLiteral;
  destination: google.maps.LatLngLiteral;
}) {
  const node = useRef<HTMLDivElement>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState("");
  const originLat = origin.lat;
  const originLng = origin.lng;
  const destinationLat = destination.lat;
  const destinationLng = destination.lng;

  useEffect(() => {
      let active = true;
      let line: google.maps.Polyline | null = null;
      void loadMaps().then((maps) => {
        if (!active || !node.current) return;
        const map = new maps.Map(node.current, {
          center: { lat: originLat, lng: originLng },
        zoom: 12,
        mapTypeControl: true,
        mapTypeControlOptions: {
          mapTypeIds: [maps.MapTypeId.ROADMAP, maps.MapTypeId.SATELLITE, maps.MapTypeId.TERRAIN],
        },
        streetViewControl: false,
      });
      return maps.routes.Route.computeRoutes({
        origin: { lat: originLat, lng: originLng },
        destination: { lat: destinationLat, lng: destinationLng },
        travelMode: maps.TravelMode.DRIVING,
        fields: ["path", "viewport", "distanceMeters", "durationMillis"],
      }).then(({ routes }) => {
        if (!active) return;
        const route = routes?.[0];
        if (!route?.path?.length) throw new Error("Google did not return a driving route for this location.");
        line = new maps.Polyline({
          map,
          path: route.path.map((point) => ({ lat: point.lat, lng: point.lng })),
          strokeColor: "#1a73e8",
          strokeOpacity: 0.95,
          strokeWeight: 6,
        });
        new maps.Marker({
          map,
          position: { lat: originLat, lng: originLng },
          icon: "https://maps.google.com/mapfiles/ms/icons/red-dot.png",
          title: "Kitchen",
        });
        new maps.Marker({
          map,
          position: { lat: destinationLat, lng: destinationLng },
          icon: "https://maps.google.com/mapfiles/ms/icons/green-dot.png",
          title: "Delivery address",
        });
        if (route.viewport) map.fitBounds(route.viewport);
        const distance = route.distanceMeters == null
          ? ""
          : `${(route.distanceMeters / 1000).toFixed(1)} km`;
        const duration = route.durationMillis == null
          ? ""
          : `${Math.max(1, Math.round(route.durationMillis / 60000))} min`;
        setSummary([distance, duration].filter(Boolean).join(" · "));
        setLoading(false);
      }).catch((reason: unknown) => {
        if (active) {
          setError(reason instanceof Error ? reason.message : "A driving route is not available.");
          setLoading(false);
        }
      });
    }).catch((reason: unknown) => {
      if (active) {
        setError(reason instanceof Error ? reason.message : "The map could not be loaded.");
        setLoading(false);
      }
    });
    return () => {
      active = false;
      line?.setMap(null);
    };
  }, [originLat, originLng, destinationLat, destinationLng]);

  return (
    <div>
      <div ref={node} className="google-map-canvas google-route-canvas" aria-label="Driving route from kitchen to delivery address" />
      {loading && <p className="google-location-message" role="status">Loading driving route…</p>}
      {summary && <p className="google-location-message" role="status">Driving route · {summary}</p>}
      {error && <p className="google-location-error" role="alert">Driving route unavailable: {error}</p>}
    </div>
  );
}
