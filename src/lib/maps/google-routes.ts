import { ApiFailure } from "../admin/validation";

export type Coordinates = { latitude: number; longitude: number };
export type DrivingRoute = {
  encodedPolyline: string;
  distanceMeters: number;
  duration: string;
};

export async function computeDrivingRoute(
  apiKey: string,
  origin: Coordinates,
  destination: Coordinates,
  fetchRoutes: typeof fetch = fetch,
): Promise<DrivingRoute> {
  const response = await fetchRoutes(
    "https://routes.googleapis.com/directions/v2:computeRoutes",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask":
          "routes.polyline.encodedPolyline,routes.distanceMeters,routes.duration",
      },
      body: JSON.stringify({
        origin: { location: { latLng: origin } },
        destination: { location: { latLng: destination } },
        travelMode: "DRIVE",
        polylineQuality: "OVERVIEW",
      }),
      signal: AbortSignal.timeout(10000),
    },
  );
  if (!response.ok) {
    throw new ApiFailure(503, "Google could not calculate this driving route.");
  }
  const result = (await response.json()) as {
    routes?: {
      polyline?: { encodedPolyline?: unknown };
      distanceMeters?: unknown;
      duration?: unknown;
    }[];
  };
  const route = result.routes?.[0];
  if (
    typeof route?.polyline?.encodedPolyline !== "string" ||
    !route.polyline.encodedPolyline ||
    typeof route.distanceMeters !== "number" ||
    !Number.isFinite(route.distanceMeters) ||
    route.distanceMeters <= 0 ||
    typeof route.duration !== "string" ||
    !/^\d+(?:\.\d+)?s$/.test(route.duration)
  ) {
    throw new ApiFailure(503, "Google returned an incomplete driving route.");
  }
  return {
    encodedPolyline: route.polyline.encodedPolyline,
    distanceMeters: route.distanceMeters,
    duration: route.duration,
  };
}
