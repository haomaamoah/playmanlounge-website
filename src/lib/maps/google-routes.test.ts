import assert from "node:assert/strict";
import test from "node:test";
import { computeDrivingRoute } from "./google-routes";

test("computes a driving route with only the requested route fields", async () => {
  let requestUrl = "";
  let requestInit: RequestInit | undefined;
  const fetchRoutes: typeof fetch = async (input, init) => {
    requestUrl = String(input);
    requestInit = init;
    return Response.json({
      routes: [
        {
          polyline: { encodedPolyline: "encoded" },
          distanceMeters: 1240,
          duration: "240s",
          legs: [{ steps: ["must not be requested"] }],
        },
      ],
    });
  };

  const route = await computeDrivingRoute(
    "server-key",
    { latitude: 5.7, longitude: -0.1 },
    { latitude: 5.6, longitude: -0.2 },
    fetchRoutes,
  );

  assert.equal(
    requestUrl,
    "https://routes.googleapis.com/directions/v2:computeRoutes",
  );
  assert.equal(requestInit?.method, "POST");
  const headers = new Headers(requestInit?.headers);
  assert.equal(headers.get("X-Goog-Api-Key"), "server-key");
  assert.equal(
    headers.get("X-Goog-FieldMask"),
    "routes.polyline.encodedPolyline,routes.distanceMeters,routes.duration",
  );
  assert.deepEqual(JSON.parse(String(requestInit?.body)), {
    origin: { location: { latLng: { latitude: 5.7, longitude: -0.1 } } },
    destination: { location: { latLng: { latitude: 5.6, longitude: -0.2 } } },
    travelMode: "DRIVE",
    polylineQuality: "OVERVIEW",
  });
  assert.deepEqual(route, {
    encodedPolyline: "encoded",
    distanceMeters: 1240,
    duration: "240s",
  });
});

test("rejects unavailable or incomplete Google route responses", async () => {
  await assert.rejects(
    computeDrivingRoute(
      "server-key",
      { latitude: 5.7, longitude: -0.1 },
      { latitude: 5.6, longitude: -0.2 },
      async () => new Response(null, { status: 403 }),
    ),
    /Google could not calculate this driving route/,
  );
  await assert.rejects(
    computeDrivingRoute(
      "server-key",
      { latitude: 5.7, longitude: -0.1 },
      { latitude: 5.6, longitude: -0.2 },
      async () => Response.json({ routes: [{ distanceMeters: 1200 }] }),
    ),
    /Google returned an incomplete driving route/,
  );
});
