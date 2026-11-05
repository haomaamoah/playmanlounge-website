import assert from "node:assert/strict";
import { test } from "node:test";
import { authenticateLiveViewer } from "./auth";
import type { LivePortal } from "./changes";

const request = (authorization?: string) => new Request("https://example.test/api/stream", {
  headers: authorization ? { authorization } : {},
});
const bearer = `Bearer ${"a".repeat(32)}`;
const auth = {
  cookie: async (portal: LivePortal) => ({ portal, id: "cookie-user" }),
  customer: async () => ({ id: "customer-user", email: "customer@example.test" }),
  rider: async () => ({ id: "rider-user" }),
};

test("stream preserves cookie authentication for all web portals", async () => {
  for (const portal of ["customer", "admin", "manager", "rider"] as const) {
    assert.deepEqual(await authenticateLiveViewer(request(), portal, auth), { portal, id: "cookie-user" });
  }
});

test("mobile stream uses verified customer and rider identities", async () => {
  assert.deepEqual(await authenticateLiveViewer(request(bearer), "customer", auth), {
    portal: "customer", id: "customer-user", email: "customer@example.test",
  });
  assert.deepEqual(await authenticateLiveViewer(request(bearer), "rider", auth), {
    portal: "rider", id: "rider-user",
  });
});

test("bearer credentials never fall back to staff or cookie sessions", async () => {
  for (const portal of ["admin", "manager"] as const) {
    assert.equal(await authenticateLiveViewer(request(bearer), portal, auth), null);
  }
  assert.equal(await authenticateLiveViewer(request("Basic invalid"), "customer", auth), null);
});

test("failed bearer verification is propagated without cookie fallback", async () => {
  await assert.rejects(authenticateLiveViewer(request(bearer), "customer", {
    ...auth,
    customer: async () => { throw new Error("rejected token"); },
  }), /rejected token/);
});
