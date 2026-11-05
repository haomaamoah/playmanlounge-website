import assert from "node:assert/strict";

const base = new URL(process.env.PML_TEST_API_URL ?? "http://127.0.0.1:43123");
if (!["localhost", "127.0.0.1", "::1", "[::1]"].includes(base.hostname)) {
  throw new Error("Stream integration tests may only use a local backend.");
}

function object(value: unknown): Record<string, unknown> {
  assert.ok(value !== null && typeof value === "object" && !Array.isArray(value));
  return value as Record<string, unknown>;
}

async function post(path: string, body: Record<string, unknown>, token?: string) {
  const response = await fetch(new URL(path, base), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Forwarded-For": "local-stream-test",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20000),
  });
  assert.ok(response.ok, `${path}: HTTP ${response.status}`);
  return object(await response.json());
}

async function verify(portal: "customer" | "rider", session: Record<string, unknown>) {
  assert.equal(typeof session.accessToken, "string");
  const token = String(session.accessToken);
  const abort = new AbortController();
  const deadline = setTimeout(() => abort.abort(), 60000);
  let reader: ReadableStreamDefaultReader<string> | undefined;
  try {
    const response = await fetch(new URL(`/api/stream?portal=${portal}`, base), {
      headers: { Authorization: `Bearer ${token}` },
      signal: abort.signal,
    });
    assert.equal(response.status, 200);
    assert.ok(response.body);
    reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
    let text = "";
    while (!text.includes(": connected\n\n")) {
      const chunk = await reader.read();
      assert.equal(chunk.done, false, `${portal} stream closed before subscription readiness`);
      text += chunk.value;
    }
    console.log(`${portal}: Realtime subscription ready.`);
    const path = portal === "rider" ? "/api/rider/support" : "/api/mobile/support";
    const created = await post(path, {
      subject: "Local stream verification",
      message: "Local-only integration test of native mobile event delivery.",
    }, token);
    const item = object(created.item ?? created.ticket);
    assert.equal(typeof item.id, "string");
    console.log(`${portal}: local support insert saved; awaiting its stream event.`);
    const table = portal === "rider" ? "rider_support_requests" : "support_requests";
    for (;;) {
      const events = text.split("\n\n");
      text = events.pop() ?? "";
      for (const event of events) {
        const line = event.split("\n").find((value) => value.startsWith("data: "));
        if (!line) continue;
        const change = object(JSON.parse(line.slice(6)));
        if (change.table === table && change.id === item.id && change.event === "INSERT") {
          console.log(`PASS ${portal}: authenticated native stream received its support insert.`);
          return;
        }
      }
      const chunk = await reader.read();
      assert.equal(chunk.done, false, `${portal} stream closed before the expected event`);
      text += chunk.value;
    }
  } finally {
    clearTimeout(deadline);
    abort.abort();
    await reader?.cancel().catch(() => undefined);
  }
}

const nonce = Date.now().toString();
const customer = await post("/api/mobile/auth/signup", {
  name: "Local Stream QA",
  email: `stream-${nonce}@example.test`,
  phone: `05${nonce.slice(-8)}`,
  password: crypto.randomUUID(),
});
const customerSession = object(customer.session);
try {
  await verify("customer", customerSession);
} finally {
  await post("/api/mobile/auth/logout", {}, String(customerSession.accessToken));
}
const rider = await post("/api/rider/mobile/auth/login", {
  email: process.env.PML_TEST_RIDER_EMAIL ?? "rider.spintex@example.test",
  password: process.env.PML_TEST_RIDER_PASSWORD ?? "rider123",
});
const riderSession = object(rider.session);
try {
  await verify("rider", riderSession);
} finally {
  await post("/api/rider/mobile/auth/logout", { accessToken: riderSession.accessToken }, String(riderSession.accessToken));
}
