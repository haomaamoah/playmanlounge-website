/**
 * End-to-end smoke test for the mobile API (src/app/api/mobile/**), run over real HTTP against the local stack:
 *
 *   infra/scripts/up.sh && infra/scripts/website.sh && infra/scripts/smoke.sh      (from the mobile repo)
 *   npx tsx scripts/smoke-mobile-api.mts [baseUrl]                                  (from this repo)
 *
 * Environment (nothing secret): PML_BASE_URL (default http://127.0.0.1:43123).
 * Optional, enables the Row Level Security probes against PostgREST/GoTrue: SUPABASE_URL and SUPABASE_ANON_KEY
 * of the LOCAL stack (the anon key is not a secret, but never point this at production).
 *
 * Every run creates its own throw-away customers (unique e-mails) and its own pseudo client address per actor
 * (X-Forwarded-For is honoured by the local server, which runs with TRUST_PROXY_IP=1), so runs never collide
 * on rate limits and never touch anybody else's data. It deletes the accounts it created.
 */
import assert from "node:assert/strict";

/* eslint-disable @typescript-eslint/no-explicit-any -- the script digs into JSON responses */
type Obj = Record<string, any>;
type Reply = { status: number; body: Obj; headers: Headers };

const BASE = (process.env.PML_BASE_URL ?? process.argv[2] ?? "http://127.0.0.1:43123").replace(/\/$/, "");
const SUPABASE_URL = process.env.SUPABASE_URL?.replace(/\/$/, "");
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
// Optional: a LOCAL admin (infra/scripts/create-admin.sh) lets the smoke test prove the kitchen's admin desk sees and
// can manage what the app creates.
const ADMIN_EMAIL = process.env.PML_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.PML_ADMIN_PASSWORD;
const RUN = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;

let passed = 0;
const failures: string[] = [];
const cacheViolations = new Set<string>();

async function step(name: string, fn: () => Promise<void> | void) {
  try {
    await fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (error) {
    failures.push(name);
    const detail = error instanceof Error ? error.message : String(error);
    console.log(`  ✗ ${name}\n      ${detail.split("\n").join("\n      ")}`);
  }
}
const section = (title: string) => console.log(`\n${title}`);

async function call(
  method: string,
  path: string,
  opts: { token?: string; body?: unknown; raw?: string; headers?: Record<string, string>; actor?: string } = {},
): Promise<Reply> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "X-Forwarded-For": `smoke-${RUN}-${opts.actor ?? "anon"}`,
    ...opts.headers,
  };
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  let body = opts.raw;
  if (opts.body !== undefined) {
    body = JSON.stringify(opts.body);
    headers["Content-Type"] = "application/json";
  }
  const res = await fetch(BASE + path, { method, headers, body });
  const text = await res.text();
  let json: Obj = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { _unparsed: text.slice(0, 200) };
  }
  if (path.startsWith("/api/mobile") && !(res.headers.get("cache-control") ?? "").includes("no-store")) cacheViolations.add(`${method} ${path}`);
  return { status: res.status, body: json, headers: res.headers };
}

function expectFailure(res: Reply, status: number, code?: string) {
  assert.equal(res.status, status, `expected HTTP ${status}, got ${res.status}: ${JSON.stringify(res.body)}`);
  assert.equal(res.body.ok, false);
  assert.equal(typeof res.body.error, "string");
  assert.ok(res.body.error.length > 0);
  if (code) assert.equal(res.body.code, code, `expected code ${code}, got ${JSON.stringify(res.body)}`);
}
const expectField = (res: Reply, field: string) =>
  assert.equal(typeof res.body.fieldErrors?.[field], "string", `expected fieldErrors.${field} in ${JSON.stringify(res.body)}`);
function expectOk(res: Reply, status = 200) {
  assert.equal(res.status, status, `expected HTTP ${status}, got ${res.status}: ${JSON.stringify(res.body)}`);
  assert.equal(res.body.ok, true);
}
const pesewas = (cedis: number) => Math.round(cedis * 100);

type Actor = { name: string; email: string; password: string; id: string; access: string; refresh: string };
const created: Actor[] = [];
const emailFor = (name: string) => `Smoke.${name}.${RUN}@Example.com`;

async function signUp(name: string, password: string): Promise<Actor> {
  const email = emailFor(name);
  const res = await call("POST", "/api/mobile/auth/signup", { body: { email, password }, actor: name });
  expectOk(res, 201);
  const actor: Actor = { name, email: email.toLowerCase(), password, id: res.body.customer.id, access: res.body.session.accessToken, refresh: res.body.session.refreshToken };
  created.push(actor);
  return actor;
}
async function signIn(actor: Actor, password = actor.password): Promise<Reply> {
  return call("POST", "/api/mobile/auth/login", { body: { email: actor.email, password }, actor: actor.name });
}

const deliveryOrder = (lines: { id: string; qty: number }[], total?: number, extra: Obj = {}): Obj => ({
  name: "Kofi Mensah",
  phone: "+233200000000",
  fulfilment: "delivery",
  preferredTime: "13:30",
  deliveryAddress: "Nikoi Olai St, blue gate",
  notes: "Extra pepper please",
  lines,
  ...(total === undefined ? {} : { expectedTotal: total }),
  ...extra,
});
const keyFor = (label: string) => `smoke-${RUN}-${label}`.slice(0, 100).padEnd(16, "0");

async function main() {
  console.log(`Mobile API smoke test -> ${BASE}  (run ${RUN})`);

  let menu: { id: string; price: number }[] = [];
  const a = { value: undefined as unknown as Actor };
  const b = { value: undefined as unknown as Actor };
  const v = { value: undefined as unknown as Actor };

  section("Public endpoints");
  await step("GET /api/mobile/config returns hours, limits, payments and contact", async () => {
    const res = await call("GET", "/api/mobile/config");
    expectOk(res);
    assert.deepEqual(Object.keys(res.body.ordering).sort(), ["closesAt", "maxLines", "maxOrderTotal", "maxQtyPerLine", "opensAt", "timezone"]);
    assert.equal(res.body.ordering.opensAt, "12:00");
    assert.equal(res.body.ordering.closesAt, "23:00");
    assert.equal(res.body.ordering.timezone, "Africa/Accra");
    assert.equal(res.body.ordering.maxQtyPerLine, 20);
    assert.equal(res.body.ordering.maxLines, 30);
    assert.equal(typeof res.body.ordering.maxOrderTotal, "number");
    assert.deepEqual(res.body.payments, { cashOnDelivery: true, mobileMoney: false });
    assert.match(res.body.contact.phone, /^\+233/);
    assert.match(res.body.contact.email, /@/);
  });
  await step("GET /api/menu serves the seeded menu with absolute image URLs", async () => {
    const res = await call("GET", "/api/menu");
    expectOk(res);
    assert.ok(res.body.items.length >= 2, "seed the menu with infra/scripts/seed.sh");
    assert.ok(res.body.groups.length >= 1);
    for (const item of res.body.items) assert.match(item.image, /^https?:\/\//);
    menu = res.body.items.map((item: Obj) => ({ id: item.id, price: item.price }));
  });

  section("Sign-up");
  await step("a 3-character password is rejected with fieldErrors.password", async () => {
    const res = await call("POST", "/api/mobile/auth/signup", { body: { email: emailFor("short"), password: "abc" }, actor: "short" });
    expectFailure(res, 400, "validation");
    expectField(res, "password");
  });
  await step("a 129-character password is rejected", async () => {
    const res = await call("POST", "/api/mobile/auth/signup", { body: { email: emailFor("long"), password: "x".repeat(129) }, actor: "short" });
    expectFailure(res, 400, "validation");
    expectField(res, "password");
  });
  await step("a bad e-mail and a missing password are both reported", async () => {
    const res = await call("POST", "/api/mobile/auth/signup", { body: { email: "not-an-email" }, actor: "short" });
    expectFailure(res, 400, "validation");
    expectField(res, "email");
    expectField(res, "password");
  });
  await step("unknown fields, arrays and malformed JSON are 400 validation", async () => {
    expectFailure(await call("POST", "/api/mobile/auth/signup", { body: { email: emailFor("x"), password: "abcd", name: "Kofi" }, actor: "short" }), 400, "validation");
    expectFailure(await call("POST", "/api/mobile/auth/signup", { body: [], actor: "short" }), 400, "validation");
    expectFailure(await call("POST", "/api/mobile/auth/signup", { raw: "{nope", headers: { "Content-Type": "application/json" }, actor: "short" }), 400, "validation");
  });
  await step("a 4-character password creates the account and signs in (201)", async () => {
    const mixedCase = emailFor("a");
    const res = await call("POST", "/api/mobile/auth/signup", { body: { email: `  ${mixedCase}  `, password: "abcd" }, actor: "a" });
    expectOk(res, 201);
    assert.equal(res.body.customer.email, mixedCase.toLowerCase(), "e-mail is trimmed and lower-cased");
    assert.match(res.body.customer.id, UUID);
    assert.equal(res.body.customer.name, "");
    assert.equal(res.body.customer.phone, "");
    assert.match(res.body.customer.createdAt, ISO);
    assert.ok(res.body.session.accessToken.length > 100);
    assert.ok(res.body.session.refreshToken.length > 5);
    assert.match(res.body.session.expiresAt, ISO);
    assert.ok(new Date(res.body.session.expiresAt).getTime() > Date.now(), "expiresAt is in the future");
    assert.equal(Object.keys(res.body).sort().join(), "customer,ok,session");
    a.value = { name: "a", email: mixedCase.toLowerCase(), password: "abcd", id: res.body.customer.id, access: res.body.session.accessToken, refresh: res.body.session.refreshToken };
    created.push(a.value);
  });
  await step("the same e-mail again (any case) is 409 email_taken", async () => {
    const res = await call("POST", "/api/mobile/auth/signup", { body: { email: emailFor("a").toUpperCase(), password: "different1" }, actor: "a" });
    expectFailure(res, 409, "email_taken");
  });
  await step("a second customer signs up", async () => {
    b.value = await signUp("b", "bravo-pass");
  });

  section("Login, refresh and session checks");
  await step("login works (e-mail is case-insensitive) and returns a fresh session", async () => {
    const res = await call("POST", "/api/mobile/auth/login", { body: { email: emailFor("a").toUpperCase(), password: "abcd" }, actor: "a" });
    expectOk(res);
    assert.equal(res.body.customer.id, a.value.id);
    assert.notEqual(res.body.session.accessToken, a.value.access);
  });
  await step("wrong password and unknown e-mail give the same 401 invalid_credentials", async () => {
    const wrong = await call("POST", "/api/mobile/auth/login", { body: { email: a.value.email, password: "nope" }, actor: "a" });
    const unknown = await call("POST", "/api/mobile/auth/login", { body: { email: `nobody.${RUN}@example.com`, password: "nope" }, actor: "a" });
    expectFailure(wrong, 401, "invalid_credentials");
    expectFailure(unknown, 401, "invalid_credentials");
    assert.equal(wrong.body.error, unknown.body.error, "no account enumeration through the message");
  });
  await step("login validates its body (400) and never reveals the 4-character rule", async () => {
    expectFailure(await call("POST", "/api/mobile/auth/login", { body: { email: a.value.email }, actor: "a" }), 400, "validation");
    expectFailure(await call("POST", "/api/mobile/auth/login", { body: { email: a.value.email, password: "x" }, actor: "a" }), 401, "invalid_credentials");
  });
  await step("protected routes need a valid bearer token (401 unauthorized)", async () => {
    expectFailure(await call("GET", "/api/mobile/me"), 401, "unauthorized");
    expectFailure(await call("GET", "/api/mobile/me", { token: "garbage" }), 401, "unauthorized");
    expectFailure(await call("GET", "/api/mobile/me", { token: `${a.value.access.slice(0, -4)}AAAA` }), 401, "unauthorized");
    expectFailure(await call("GET", "/api/mobile/orders"), 401, "unauthorized");
    expectFailure(await call("POST", "/api/mobile/orders", { body: {} }), 401, "unauthorized");
    expectFailure(await call("GET", "/api/mobile/support"), 401, "unauthorized");
    expectFailure(await call("POST", "/api/mobile/auth/logout"), 401, "unauthorized");
  });
  await step("refresh rotates the session; garbage is 401 unauthorized", async () => {
    const res = await call("POST", "/api/mobile/auth/refresh", { body: { refreshToken: a.value.refresh }, actor: "a" });
    expectOk(res);
    assert.equal(res.body.customer.id, a.value.id);
    assert.notEqual(res.body.session.refreshToken, a.value.refresh);
    a.value.access = res.body.session.accessToken;
    a.value.refresh = res.body.session.refreshToken;
    expectOk(await call("GET", "/api/mobile/me", { token: a.value.access }));
    expectFailure(await call("POST", "/api/mobile/auth/refresh", { body: { refreshToken: "garbage-token" }, actor: "a" }), 401, "unauthorized");
    expectFailure(await call("POST", "/api/mobile/auth/refresh", { body: {}, actor: "a" }), 400, "validation");
  });

  section("Profile");
  await step("GET /me returns the customer", async () => {
    const res = await call("GET", "/api/mobile/me", { token: a.value.access });
    expectOk(res);
    assert.equal(res.body.customer.email, a.value.email);
  });
  await step("PATCH /me updates name and phone; empty, oversized or unknown input is 400", async () => {
    const res = await call("PATCH", "/api/mobile/me", { token: a.value.access, body: { name: "  Kofi Mensah ", phone: "+233 20 000 0000" } });
    expectOk(res);
    assert.equal(res.body.customer.name, "Kofi Mensah");
    assert.equal(res.body.customer.phone, "+233 20 000 0000");
    expectOk(await call("PATCH", "/api/mobile/me", { token: a.value.access, body: { phone: "" } }));
    expectFailure(await call("PATCH", "/api/mobile/me", { token: a.value.access, body: {} }), 400, "validation");
    const long = await call("PATCH", "/api/mobile/me", { token: a.value.access, body: { name: "x".repeat(101) } });
    expectFailure(long, 400, "validation");
    expectField(long, "name");
    expectFailure(await call("PATCH", "/api/mobile/me", { token: a.value.access, body: { email: "other@example.com" } }), 400, "validation");
    expectFailure(await call("PATCH", "/api/mobile/me", { token: a.value.access, body: { phone: "9".repeat(31) } }), 400, "validation");
    const again = await call("GET", "/api/mobile/me", { token: a.value.access });
    assert.equal(again.body.customer.name, "Kofi Mensah");
    assert.equal(again.body.customer.phone, "");
  });

  section("Orders");
  const first = () => menu[0];
  const second = () => menu[1];
  const lines = () => [{ id: first().id, qty: 2 }, { id: second().id, qty: 1 }];
  const total = () => (pesewas(first().price) * 2 + pesewas(second().price)) / 100;
  let orderA: Obj = {};
  let orderPickup: Obj = {};

  await step("the Idempotency-Key header is required and checked", async () => {
    const missing = await call("POST", "/api/mobile/orders", { token: a.value.access, body: deliveryOrder(lines(), total()), actor: "a" });
    expectFailure(missing, 400, "validation");
    expectField(missing, "idempotencyKey");
    const short = await call("POST", "/api/mobile/orders", { token: a.value.access, body: deliveryOrder(lines(), total()), headers: { "Idempotency-Key": "too-short" }, actor: "a" });
    expectFailure(short, 400, "validation");
    const bad = await call("POST", "/api/mobile/orders", { token: a.value.access, body: deliveryOrder(lines(), total()), headers: { "Idempotency-Key": "has spaces and bad chars!!" }, actor: "a" });
    expectFailure(bad, 400, "validation");
  });

  await step("order validation: every problem is reported per field", async () => {
    v.value = await signUp("v", "valid-pass"); // its own customer: invalid attempts still count toward the 20/hour order limit
    const post = (body: Obj, label: string) => call("POST", "/api/mobile/orders", { token: v.value.access, body, headers: { "Idempotency-Key": keyFor(label) }, actor: "v" });
    const base = () => deliveryOrder(lines(), total());
    let res = await post({ ...base(), name: "" }, "v1");
    expectFailure(res, 400, "validation");
    expectField(res, "name");
    res = await post({ ...base(), phone: "12ab" }, "v2");
    expectField(res, "phone");
    res = await post({ ...base(), deliveryAddress: "" }, "v3");
    expectField(res, "deliveryAddress");
    res = await post({ ...base(), deliveryAddress: "ab" }, "v4");
    expectField(res, "deliveryAddress");
    res = await post({ ...base(), deliveryAddress: "x".repeat(301) }, "v5");
    expectField(res, "deliveryAddress");
    res = await post({ ...base(), fulfilment: "pickup" }, "v6");
    expectField(res, "deliveryAddress");
    res = await post({ ...base(), fulfilment: "teleport" }, "v7");
    expectField(res, "fulfilment");
    res = await post({ ...base(), preferredTime: "11:59" }, "v8");
    expectField(res, "preferredTime");
    res = await post({ ...base(), preferredTime: "23:01" }, "v9");
    expectField(res, "preferredTime");
    res = await post({ ...base(), preferredTime: "noon" }, "v10");
    expectField(res, "preferredTime");
    res = await post({ ...base(), lines: [] }, "v11");
    expectField(res, "lines");
    res = await post({ ...base(), lines: [{ id: first().id, qty: 21 }] }, "v12");
    expectField(res, "lines");
    res = await post({ ...base(), lines: [{ id: first().id, qty: 0 }] }, "v13");
    expectField(res, "lines");
    res = await post({ ...base(), lines: [{ id: first().id, qty: 1.5 }] }, "v14");
    expectField(res, "lines");
    res = await post({ ...base(), lines: [{ id: first().id, qty: 1 }, { id: first().id, qty: 1 }] }, "v15");
    expectField(res, "lines");
    res = await post({ ...base(), lines: [{ id: "no-such-dish", qty: 1 }], expectedTotal: undefined }, "v16");
    expectFailure(res, 400, "validation");
    expectField(res, "lines");
    res = await post({ ...base(), notes: "n".repeat(801) }, "v17");
    expectField(res, "notes");
    res = await post({ ...base(), email: "someone.else@example.com" }, "v18");
    expectFailure(res, 400, "validation");
    res = await post({ ...base(), payment: "momo" }, "v19");
    expectFailure(res, 400, "validation");
  });

  await step("the delivery address and the notes together must fit the 800-character notes limit", async () => {
    const address = "a".repeat(300);
    const tooLong = await call("POST", "/api/mobile/orders", {
      token: b.value.access,
      body: deliveryOrder(lines(), total(), { deliveryAddress: address, notes: "n".repeat(800 - 20 - 300 + 1) }),
      headers: { "Idempotency-Key": keyFor("fold1") },
      actor: "b-validation",
    });
    expectFailure(tooLong, 400, "validation");
    expectField(tooLong, "notes");
  });

  await step("a wrong expectedTotal is 409 price_changed and carries the real total", async () => {
    const res = await call("POST", "/api/mobile/orders", { token: a.value.access, body: deliveryOrder(lines(), total() + 1), headers: { "Idempotency-Key": keyFor("price") }, actor: "a" });
    expectFailure(res, 409, "price_changed");
    assert.equal(res.body.total, total());
  });

  await step("an order above MAX_ORDER_TOTAL is refused (phone orders only)", async () => {
    const everything = menu.map((item) => ({ id: item.id, qty: 20 }));
    const sum = menu.reduce((acc, item) => acc + pesewas(item.price) * 20, 0) / 100;
    const max = (await call("GET", "/api/mobile/config")).body.ordering.maxOrderTotal;
    if (sum <= max) return console.log(`      (skipped: the whole menu x20 is GH₵ ${sum}, not above ${max})`);
    const res = await call("POST", "/api/mobile/orders", { token: b.value.access, body: deliveryOrder(everything), headers: { "Idempotency-Key": keyFor("max") }, actor: "b-validation" });
    expectFailure(res, 400, "validation");
    expectField(res, "lines");
  });

  await step("a valid delivery order is saved: 201, priced by the server, address folded into the notes", async () => {
    const res = await call("POST", "/api/mobile/orders", { token: a.value.access, body: deliveryOrder(lines(), total()), headers: { "Idempotency-Key": keyFor("o1") }, actor: "a" });
    expectOk(res, 201);
    assert.equal(typeof res.body.receiptSent, "boolean");
    const order = res.body.order;
    assert.match(order.id, UUID);
    assert.match(order.ref, /^PML-[A-Z0-9]+$/);
    assert.equal(order.status, "pending");
    assert.equal(order.paymentStatus, "cod");
    assert.equal(order.fulfilment, "delivery");
    assert.equal(order.preferredTime, "13:30");
    assert.equal(order.notes, "Delivery address: Nikoi Olai St, blue gate\n\nExtra pepper please");
    assert.equal(order.total, total());
    assert.equal(order.customerName, "Kofi Mensah");
    assert.equal(order.customerPhone, "+233200000000");
    assert.equal(order.lines.length, 2);
    assert.deepEqual(Object.keys(order.lines[0]).sort(), ["image", "itemId", "name", "qty", "unitPrice"]);
    assert.equal(order.lines[0].itemId, first().id);
    assert.equal(order.lines[0].qty, 2);
    assert.equal(order.lines[0].unitPrice, first().price);
    assert.match(order.createdAt, ISO);
    assert.match(order.updatedAt, ISO);
    assert.ok(!("customerEmail" in order) && !("requestKey" in order) && !("transactionId" in order), "no internal columns leak");
    orderA = order;
  });
  await step("replaying the same Idempotency-Key and body returns 200 with the original order", async () => {
    const res = await call("POST", "/api/mobile/orders", { token: a.value.access, body: deliveryOrder(lines(), total()), headers: { "Idempotency-Key": keyFor("o1") }, actor: "a" });
    expectOk(res, 200);
    assert.equal(res.body.order.id, orderA.id);
    assert.equal(res.body.order.ref, orderA.ref);
  });
  await step("a replay still succeeds after the menu moved on (it is answered from the saved order)", async () => {
    // Same key, same body but a stale expectedTotal-free body: nothing is re-priced.
    const res = await call("POST", "/api/mobile/orders", { token: a.value.access, body: deliveryOrder(lines()), headers: { "Idempotency-Key": keyFor("o1") }, actor: "a" });
    expectOk(res, 200);
    assert.equal(res.body.order.id, orderA.id);
  });
  await step("the same key with a different body is 409 idempotency_conflict", async () => {
    const res = await call("POST", "/api/mobile/orders", { token: a.value.access, body: deliveryOrder([{ id: first().id, qty: 3 }]), headers: { "Idempotency-Key": keyFor("o1") }, actor: "a" });
    expectFailure(res, 409, "idempotency_conflict");
    const notes = await call("POST", "/api/mobile/orders", { token: a.value.access, body: deliveryOrder(lines(), total(), { notes: "something else" }), headers: { "Idempotency-Key": keyFor("o1") }, actor: "a" });
    expectFailure(notes, 409, "idempotency_conflict");
  });
  await step("five identical concurrent submissions create exactly one order", async () => {
    const send = () => call("POST", "/api/mobile/orders", { token: a.value.access, body: deliveryOrder([{ id: second().id, qty: 1 }], pesewas(second().price) / 100), headers: { "Idempotency-Key": keyFor("race") }, actor: "a" });
    const results = await Promise.all([send(), send(), send(), send(), send()]);
    for (const res of results) assert.ok(res.status === 200 || res.status === 201, `unexpected ${res.status}: ${JSON.stringify(res.body)}`);
    assert.equal(results.filter((res) => res.status === 201).length, 1, "exactly one 201");
    assert.equal(new Set(results.map((res) => res.body.order.id)).size, 1, "all answers name the same order");
  });
  await step("a pickup order keeps the notes as typed (no address line)", async () => {
    const res = await call("POST", "/api/mobile/orders", {
      token: a.value.access,
      body: { name: "Kofi Mensah", phone: "0200000000", fulfilment: "pickup", preferredTime: "12:00", notes: "Call when ready", lines: [{ id: first().id, qty: 1 }], expectedTotal: first().price },
      headers: { "Idempotency-Key": keyFor("pickup") },
      actor: "a",
    });
    expectOk(res, 201);
    assert.equal(res.body.order.notes, "Call when ready");
    assert.equal(res.body.order.fulfilment, "pickup");
    assert.equal(res.body.order.customerPhone, "0200000000");
    orderPickup = res.body.order;
  });
  await step("pickup works without notes or expectedTotal, and 23:00 is accepted", async () => {
    const res = await call("POST", "/api/mobile/orders", {
      token: a.value.access,
      body: { name: "Kofi", phone: "0200000000", fulfilment: "pickup", preferredTime: "23:00", lines: [{ id: first().id, qty: 1 }] },
      headers: { "Idempotency-Key": keyFor("pickup2") },
      actor: "a",
    });
    expectOk(res, 201);
    assert.equal(res.body.order.notes, "");
  });
  await step("a delivery order with no notes stores just the address line", async () => {
    const res = await call("POST", "/api/mobile/orders", {
      token: a.value.access,
      body: deliveryOrder([{ id: first().id, qty: 1 }], undefined, { notes: "" }),
      headers: { "Idempotency-Key": keyFor("nonotes") },
      actor: "a",
    });
    expectOk(res, 201);
    assert.equal(res.body.order.notes, "Delivery address: Nikoi Olai St, blue gate");
  });

  await step("GET /orders lists the caller's orders newest first and pages with limit + before", async () => {
    const all = await call("GET", "/api/mobile/orders", { token: a.value.access });
    expectOk(all);
    assert.equal(all.body.orders.length, 5);
    assert.equal(all.body.nextBefore, null);
    const times = all.body.orders.map((order: Obj) => order.createdAt);
    assert.deepEqual([...times].sort().reverse(), times, "newest first");
    assert.ok(all.body.orders.some((order: Obj) => order.id === orderA.id));
    const page1 = await call("GET", "/api/mobile/orders?limit=2", { token: a.value.access });
    expectOk(page1);
    assert.equal(page1.body.orders.length, 2);
    assert.match(page1.body.nextBefore, ISO);
    assert.equal(page1.body.nextBefore, page1.body.orders[1].createdAt);
    const seen: string[] = page1.body.orders.map((order: Obj) => order.id);
    let before: string | null = page1.body.nextBefore;
    while (before) {
      const page = await call("GET", `/api/mobile/orders?limit=2&before=${encodeURIComponent(before)}`, { token: a.value.access });
      expectOk(page);
      seen.push(...page.body.orders.map((order: Obj) => order.id));
      before = page.body.nextBefore;
    }
    assert.deepEqual(seen, all.body.orders.map((order: Obj) => order.id), "paging visits every order exactly once, in order");
  });
  await step("GET /orders rejects a bad limit or before", async () => {
    expectFailure(await call("GET", "/api/mobile/orders?limit=0", { token: a.value.access }), 400, "validation");
    expectFailure(await call("GET", "/api/mobile/orders?limit=51", { token: a.value.access }), 400, "validation");
    expectFailure(await call("GET", "/api/mobile/orders?limit=abc", { token: a.value.access }), 400, "validation");
    expectFailure(await call("GET", "/api/mobile/orders?before=yesterday", { token: a.value.access }), 400, "validation");
    expectOk(await call("GET", "/api/mobile/orders?limit=50&before=2000-01-01T00:00:00Z", { token: a.value.access }));
  });
  await step("GET /orders/{id} returns the order; unknown and malformed ids are 404", async () => {
    const res = await call("GET", `/api/mobile/orders/${orderA.id}`, { token: a.value.access });
    expectOk(res);
    assert.deepEqual(res.body.order, orderA);
    expectFailure(await call("GET", "/api/mobile/orders/00000000-0000-4000-8000-000000000000", { token: a.value.access }), 404, "not_found");
    expectFailure(await call("GET", "/api/mobile/orders/not-a-uuid", { token: a.value.access }), 404, "not_found");
  });

  section("Cross-customer isolation");
  await step("customer B sees none of A's orders and gets 404 (never 403) for A's order id", async () => {
    const list = await call("GET", "/api/mobile/orders", { token: b.value.access });
    expectOk(list);
    assert.deepEqual(list.body.orders, []);
    expectFailure(await call("GET", `/api/mobile/orders/${orderA.id}`, { token: b.value.access }), 404, "not_found");
  });
  await step("B can reuse A's Idempotency-Key: keys are per customer, so B gets their own order", async () => {
    const res = await call("POST", "/api/mobile/orders", { token: b.value.access, body: deliveryOrder(lines(), total()), headers: { "Idempotency-Key": keyFor("o1") }, actor: "b" });
    expectOk(res, 201);
    assert.notEqual(res.body.order.id, orderA.id);
    const mine = await call("GET", "/api/mobile/orders", { token: b.value.access });
    assert.equal(mine.body.orders.length, 1);
    expectFailure(await call("GET", `/api/mobile/orders/${orderA.id}`, { token: b.value.access }), 404, "not_found");
    expectOk(await call("GET", `/api/mobile/orders/${res.body.order.id}`, { token: b.value.access }));
    expectFailure(await call("GET", `/api/mobile/orders/${res.body.order.id}`, { token: a.value.access }), 404, "not_found");
  });

  section("Support");
  let ticketA: Obj = {};
  await step("ticket validation: subject, message and phone limits (all problems at once)", async () => {
    // The 5/hour ticket limit counts invalid attempts too, so several problems are checked per request.
    const post = (body: Obj) => call("POST", "/api/mobile/support", { token: v.value.access, body, actor: "v" });
    let res = await post({ subject: "Hi", message: "too short", phone: "9".repeat(31) });
    expectFailure(res, 400, "validation");
    expectField(res, "subject");
    expectField(res, "message");
    expectField(res, "phone");
    res = await post({ subject: "x".repeat(161), message: "m".repeat(4001) });
    expectFailure(res, 400, "validation");
    expectField(res, "subject");
    expectField(res, "message");
    expectFailure(await post({ subject: "Late order", message: "This message is long enough.", customerEmail: "x@y.zz" }), 400, "validation");
    expectFailure(await post({ subject: "Late order", message: "This message is long enough.", status: "closed" }), 400, "validation");
    expectOk(await call("GET", "/api/mobile/support", { token: v.value.access }));
  });
  await step("POST /support creates an open ticket (201) with the account's identity", async () => {
    const res = await call("POST", "/api/mobile/support", { token: a.value.access, body: { subject: "Late order", message: "My order PML-TEST is late, please check.", phone: "0200000000" }, actor: "a" });
    expectOk(res, 201);
    ticketA = res.body.ticket;
    assert.match(ticketA.id, UUID);
    assert.equal(ticketA.subject, "Late order");
    assert.equal(ticketA.status, "open");
    assert.equal(ticketA.phone, "0200000000");
    assert.match(ticketA.createdAt, ISO);
    assert.deepEqual(Object.keys(ticketA).sort(), ["createdAt", "id", "message", "phone", "status", "subject", "updatedAt"]);
  });
  await step("GET /support lists only the caller's tickets", async () => {
    const mine = await call("GET", "/api/mobile/support", { token: a.value.access });
    expectOk(mine);
    assert.deepEqual(mine.body.tickets.map((ticket: Obj) => ticket.id), [ticketA.id]);
    const theirs = await call("GET", "/api/mobile/support", { token: b.value.access });
    expectOk(theirs);
    assert.deepEqual(theirs.body.tickets, [], "B sees none of A's tickets");
  });

  section("Admin surface is untouched");
  await step("admin endpoints still reject unauthenticated calls, and a customer token is not an admin", async () => {
    for (const path of ["/api/admin/session", "/api/admin/orders", "/api/admin/support", "/api/admin/dashboard", "/api/admin/menu"]) {
      for (const token of [undefined, a.value.access]) {
        const res = await call("GET", path, { token });
        assert.ok(res.status === 401 || res.status === 403, `${path} answered ${res.status}`);
        assert.equal(res.body.ok, false);
      }
    }
    const login = await call("POST", "/api/admin/login", { body: { email: a.value.email, password: "abcd" }, headers: { Origin: BASE }, actor: "a" });
    assert.ok(login.status === 401 || login.status === 403, `admin login with customer credentials answered ${login.status}`);
    const patch = await call("PATCH", `/api/admin/orders/${orderA.id}`, { body: { status: "cooking" }, headers: { Origin: BASE }, token: a.value.access });
    assert.ok(patch.status === 401 || patch.status === 403, `admin order update answered ${patch.status}`);
  });

  if (ADMIN_EMAIL && ADMIN_PASSWORD) {
    section("The kitchen's admin desk sees what the app creates");
    let cookie = "";
    const admin = (method: string, path: string, body?: unknown) => call(method, path, { body, headers: { Origin: BASE, Cookie: cookie }, actor: "admin" });
    await step("a local admin signs in", async () => {
      const res = await call("POST", "/api/admin/login", { body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD }, headers: { Origin: BASE }, actor: "admin" });
      assert.equal(res.status, 200, JSON.stringify(res.body));
      cookie = res.headers.getSetCookie().map((entry) => entry.split(";")[0]).join("; ");
      assert.ok(cookie, "the admin session cookie");
    });
    await step("the admin order list shows the app's orders: COD, customer e-mail, address folded into the notes", async () => {
      const res = await admin("GET", "/api/admin/orders?limit=100");
      assert.equal(res.status, 200, JSON.stringify(res.body));
      const row = res.body.items.find((item: Obj) => item.id === orderA.id);
      assert.ok(row, "the mobile order is listed");
      assert.equal(row.customerEmail, a.value.email);
      assert.equal(row.paymentStatus, "cod");
      assert.equal(row.notes, orderA.notes);
      assert.equal(row.total, orderA.total);
      assert.equal(row.lines.length, orderA.lines.length);
    });
    await step("the Support desk shows the app's tickets under the account's name and e-mail", async () => {
      const res = await admin("GET", "/api/admin/support?limit=100");
      assert.equal(res.status, 200, JSON.stringify(res.body));
      const row = res.body.items.find((item: Obj) => item.id === ticketA.id);
      assert.ok(row, "the mobile ticket is listed");
      assert.equal(row.customerEmail, a.value.email);
      assert.equal(row.customerName, "Kofi Mensah", "the profile name (the e-mail's local part when none is set)");
      assert.equal(row.status, "open");
    });
    await step("moving an order along the kitchen board shows up in the app", async () => {
      const res = await admin("PATCH", `/api/admin/orders/${orderPickup.id}`, { status: "cooking" });
      assert.equal(res.status, 200, JSON.stringify(res.body));
      assert.equal(res.body.item.status, "cooking");
      const seen = await call("GET", `/api/mobile/orders/${orderPickup.id}`, { token: a.value.access });
      assert.equal(seen.body.order.status, "cooking");
      assert.notEqual(seen.body.order.updatedAt, orderPickup.updatedAt, "updatedAt moves with the status");
    });
    await step("closing a ticket in the Support desk shows up in the app", async () => {
      const res = await admin("PATCH", `/api/admin/support/${ticketA.id}`, { status: "closed" });
      assert.equal(res.status, 200, JSON.stringify(res.body));
      const seen = await call("GET", "/api/mobile/support", { token: a.value.access });
      assert.equal(seen.body.tickets.find((ticket: Obj) => ticket.id === ticketA.id).status, "closed");
    });
    await step("the dashboard counts mobile orders like any other", async () => {
      const res = await admin("GET", "/api/admin/dashboard");
      assert.equal(res.status, 200, JSON.stringify(res.body));
      assert.ok(res.body.dashboard.codOrders >= 5);
      assert.ok(res.body.dashboard.totalOrders >= 5);
    });
  } else {
    section("Admin desk");
    console.log("  - skipped (set PML_ADMIN_EMAIL / PML_ADMIN_PASSWORD of a LOCAL admin, or run infra/scripts/smoke.sh)");
  }

  section("Password change");
  const s1 = { value: "" };
  await step("a wrong current password is 403 invalid_credentials (never 401) and keeps the session", async () => {
    const res = await call("POST", "/api/mobile/me/password", { token: a.value.access, body: { currentPassword: "wrong", newPassword: "newpass1" }, actor: "a" });
    expectFailure(res, 403, "invalid_credentials");
    expectOk(await call("GET", "/api/mobile/me", { token: a.value.access }));
  });
  await step("the new password follows the same 4-128 rule", async () => {
    const short = await call("POST", "/api/mobile/me/password", { token: a.value.access, body: { currentPassword: "abcd", newPassword: "abc" }, actor: "a" });
    expectFailure(short, 400, "validation");
    expectField(short, "newPassword");
    expectFailure(await call("POST", "/api/mobile/me/password", { token: a.value.access, body: { currentPassword: "abcd" }, actor: "a" }), 400, "validation");
    expectFailure(await call("POST", "/api/mobile/me/password", { token: a.value.access, body: { currentPassword: "abcd", newPassword: "wxyz", extra: 1 }, actor: "a" }), 400, "validation");
  });
  await step("changing the password: every old session ends, this device gets a new one, old password fails, new works", async () => {
    const second = await signIn(a.value);
    expectOk(second);
    s1.value = second.body.session.accessToken; // another device
    const before = { access: a.value.access, refresh: a.value.refresh };
    const res = await call("POST", "/api/mobile/me/password", { token: a.value.access, body: { currentPassword: "abcd", newPassword: "w1dget" }, actor: "a" });
    expectOk(res);
    // The device that changed the password is handed a fresh session, so it is never bounced to the login screen.
    assert.ok(res.body.session?.accessToken, "the response carries a new session");
    assert.match(res.body.session.expiresAt, ISO);
    assert.notEqual(res.body.session.accessToken, before.access);
    expectOk(await call("GET", "/api/mobile/me", { token: res.body.session.accessToken }));
    // Everything that existed before the change is revoked: the token that made the request, the other device, its refresh token.
    expectFailure(await call("GET", "/api/mobile/me", { token: before.access }), 401, "unauthorized");
    expectFailure(await call("GET", "/api/mobile/me", { token: s1.value }), 401, "unauthorized");
    expectFailure(await call("POST", "/api/mobile/auth/refresh", { body: { refreshToken: before.refresh } }), 401, "unauthorized");
    expectFailure(await signIn(a.value, "abcd"), 401, "invalid_credentials");
    const fresh = await signIn(a.value, "w1dget");
    expectOk(fresh);
    a.value.password = "w1dget";
    a.value.access = fresh.body.session.accessToken;
    a.value.refresh = fresh.body.session.refreshToken;
    expectOk(await call("GET", "/api/mobile/me", { token: a.value.access }));
  });

  section("Rate limiting (each limit uses its own throw-away customer or e-mail)");
  await step("login: the 11th attempt for one e-mail inside 15 minutes is 429 with Retry-After", async () => {
    const email = `smoke.limit.${RUN}@example.com`;
    let last: Reply | undefined;
    for (let attempt = 1; attempt <= 10; attempt++) {
      last = await call("POST", "/api/mobile/auth/login", { body: { email, password: "wrong-pass" }, actor: "limit-login" });
      expectFailure(last, 401, "invalid_credentials");
    }
    last = await call("POST", "/api/mobile/auth/login", { body: { email, password: "wrong-pass" }, actor: "limit-login" });
    expectFailure(last, 429, "rate_limited");
    const wait = Number(last.headers.get("retry-after"));
    assert.ok(wait > 0 && wait <= 900, `Retry-After ${wait} is the time left in the 15-minute window`);
    assert.match(last.body.error, /Try again in/);
    const other = await call("POST", "/api/mobile/auth/login", { body: { email: `smoke.limit2.${RUN}@example.com`, password: "wrong-pass" }, actor: "limit-login" });
    expectFailure(other, 401, "invalid_credentials");
  });
  await step("support: the 6th ticket within an hour is 429 rate_limited", async () => {
    const limited = await signUp("limit-support", "support-pass");
    for (let n = 1; n <= 5; n++) {
      expectOk(await call("POST", "/api/mobile/support", { token: limited.access, body: { subject: `Question ${n}`, message: "Is the kitchen open on Sundays?" }, actor: "limit-support" }), 201);
    }
    const res = await call("POST", "/api/mobile/support", { token: limited.access, body: { subject: "Question 6", message: "Is the kitchen open on Sundays?" }, actor: "limit-support" });
    expectFailure(res, 429, "rate_limited");
    const wait = Number(res.headers.get("retry-after"));
    assert.ok(wait > 0 && wait <= 3600, `Retry-After ${wait}`);
    assert.equal((await call("GET", "/api/mobile/support", { token: limited.access })).body.tickets.length, 5);
  });
  await step("orders: the 21st attempt within an hour is 429 rate_limited", async () => {
    const limited = await signUp("limit-orders", "orders-pass");
    let res: Reply | undefined;
    for (let n = 1; n <= 20; n++) {
      res = await call("POST", "/api/mobile/orders", { token: limited.access, body: {}, headers: { "Idempotency-Key": keyFor(`lim${n}`) }, actor: "limit-orders" });
      expectFailure(res, 400, "validation");
    }
    res = await call("POST", "/api/mobile/orders", { token: limited.access, body: {}, headers: { "Idempotency-Key": keyFor("lim21") }, actor: "limit-orders" });
    expectFailure(res, 429, "rate_limited");
  });
  await step("sign-up: the 11th account from one address within an hour is 429 rate_limited", async () => {
    const accounts: Actor[] = [];
    for (let n = 1; n <= 10; n++) {
      const email = emailFor(`burst${n}`);
      const res = await call("POST", "/api/mobile/auth/signup", { body: { email, password: "burst-pass" }, actor: "limit-signup" });
      expectOk(res, 201);
      accounts.push({ name: `burst${n}`, email: email.toLowerCase(), password: "burst-pass", id: res.body.customer.id, access: res.body.session.accessToken, refresh: res.body.session.refreshToken });
    }
    created.push(...accounts);
    const res = await call("POST", "/api/mobile/auth/signup", { body: { email: emailFor("burst11"), password: "burst-pass" }, actor: "limit-signup" });
    expectFailure(res, 429, "rate_limited");
    // Validation errors never burn the budget.
    expectFailure(await call("POST", "/api/mobile/auth/signup", { body: { email: "bad", password: "abc" }, actor: "limit-signup-2" }), 400, "validation");
  });

  if (SUPABASE_URL && SUPABASE_ANON_KEY) {
    section("Row Level Security (direct PostgREST / GoTrue with customer JWTs)");
    const rest = (path: string, token?: string, init: RequestInit = {}) =>
      fetch(`${SUPABASE_URL}${path}`, { ...init, headers: { apikey: SUPABASE_ANON_KEY, ...(token ? { Authorization: `Bearer ${token}` } : {}), "Content-Type": "application/json", Prefer: "return=representation", ...init.headers } });
    await step("a customer JWT reads only their own orders and profile through PostgREST", async () => {
      const mine = await rest("/rest/v1/orders?select=id,customer_id", a.value.access);
      assert.equal(mine.status, 200);
      const rows: Obj[] = await mine.json();
      assert.equal(rows.length, 5);
      assert.ok(rows.every((row) => row.customer_id === a.value.id));
      const theirs = await rest("/rest/v1/orders?select=id", b.value.access);
      assert.deepEqual((await theirs.json()).length, 1);
      const profile = await rest("/rest/v1/customer_profiles?select=id,email", a.value.access);
      assert.deepEqual(await profile.json(), [{ id: a.value.id, email: a.value.email }]);
      const tickets = await rest("/rest/v1/support_requests?select=id,customer_id", b.value.access);
      assert.deepEqual(await tickets.json(), []);
    });
    await step("sensitive columns, other tables and every write are denied", async () => {
      for (const path of ["/rest/v1/orders?select=request_key", "/rest/v1/orders?select=transaction_id", "/rest/v1/orders?select=*", "/rest/v1/audit_events?select=*", "/rest/v1/rate_limits?select=*", "/rest/v1/payment_attempts?select=*", "/rest/v1/menu_items?select=id"]) {
        const res = await rest(path, a.value.access);
        assert.ok(res.status === 401 || res.status === 403, `${path} answered ${res.status}`);
      }
      const adminRows = await rest("/rest/v1/admin_profiles?select=*", a.value.access);
      assert.deepEqual(await adminRows.json(), [], "no admin identities are visible");
      const forged = await rest("/rest/v1/orders", a.value.access, { method: "POST", body: JSON.stringify({ order_ref: "PML-FORGED", customer_name: "x", customer_email: "x@x.xx", customer_phone: "0200000000", fulfilment: "pickup", preferred_time: "12:00", payment_status: "paid", total: 1, lines: [], customer_id: a.value.id }) });
      assert.ok(forged.status === 401 || forged.status === 403, `insert answered ${forged.status}`);
      const tamper = await rest(`/rest/v1/orders?id=eq.${orderA.id}`, a.value.access, { method: "PATCH", body: JSON.stringify({ status: "completed", payment_status: "paid" }) });
      assert.ok(tamper.status === 401 || tamper.status === 403, `update answered ${tamper.status}`);
      const wipe = await rest(`/rest/v1/orders?id=eq.${orderA.id}`, a.value.access, { method: "DELETE" });
      assert.ok(wipe.status === 401 || wipe.status === 403, `delete answered ${wipe.status}`);
      const profileEdit = await rest(`/rest/v1/customer_profiles?id=eq.${a.value.id}`, a.value.access, { method: "PATCH", body: JSON.stringify({ name: "Hacker" }) });
      assert.ok(profileEdit.status === 401 || profileEdit.status === 403, `profile update answered ${profileEdit.status}`);
      const anon = await rest("/rest/v1/orders?select=id");
      assert.ok(anon.status === 401 || anon.status === 403, `anonymous read answered ${anon.status}`);
      const check = await call("GET", `/api/mobile/orders/${orderA.id}`, { token: a.value.access });
      assert.equal(check.body.order.status, "pending", "the order is unchanged");
    });
    await step("a user created directly in Supabase Auth (no profile) is not a customer", async () => {
      const email = `smoke.direct.${RUN}@example.com`;
      const res = await rest("/auth/v1/signup", undefined, { method: "POST", body: JSON.stringify({ email, password: "direct-signup-1" }) });
      if (!res.ok) return console.log(`      (skipped: public sign-ups are closed here, HTTP ${res.status}: the production setting)`);
      const session = await res.json();
      const token = session.access_token as string;
      assert.ok(token, "direct sign-up returned a session");
      for (const [method, path] of [["GET", "/api/mobile/me"], ["GET", "/api/mobile/orders"], ["GET", "/api/mobile/support"], ["POST", "/api/mobile/auth/logout"]] as const) {
        expectFailure(await call(method, path, { token }), 401, "unauthorized");
      }
      expectFailure(await call("POST", "/api/mobile/auth/refresh", { body: { refreshToken: session.refresh_token as string } }), 401, "unauthorized");
    });
  } else {
    section("Row Level Security");
    console.log("  - skipped (set SUPABASE_URL and SUPABASE_ANON_KEY of the LOCAL stack, or run infra/scripts/smoke.sh)");
  }

  section("Logout and account deletion");
  await step("logout revokes the session server-side: the access and refresh tokens stop working", async () => {
    const session = await signIn(a.value);
    expectOk(session);
    const { accessToken, refreshToken } = session.body.session;
    expectOk(await call("POST", "/api/mobile/auth/logout", { token: accessToken, actor: "a" }));
    expectFailure(await call("GET", "/api/mobile/me", { token: accessToken }), 401, "unauthorized");
    expectFailure(await call("POST", "/api/mobile/auth/refresh", { body: { refreshToken } }), 401, "unauthorized");
    expectOk(await call("GET", "/api/mobile/me", { token: a.value.access }), 200); // the other session is unaffected
  });
  await step("deleting the account needs the right password (403), then removes the account", async () => {
    const wrong = await call("DELETE", "/api/mobile/me", { token: b.value.access, body: { password: "not-it" }, actor: "b" });
    expectFailure(wrong, 403, "invalid_credentials");
    expectOk(await call("GET", "/api/mobile/me", { token: b.value.access }));
    expectFailure(await call("DELETE", "/api/mobile/me", { token: b.value.access, body: {}, actor: "b" }), 400, "validation");
    const done = await call("DELETE", "/api/mobile/me", { token: b.value.access, body: { password: b.value.password }, actor: "b" });
    expectOk(done);
    expectFailure(await call("GET", "/api/mobile/me", { token: b.value.access }), 401, "unauthorized");
    expectFailure(await signIn(b.value), 401, "invalid_credentials");
    expectFailure(await call("POST", "/api/mobile/auth/refresh", { body: { refreshToken: b.value.refresh } }), 401, "unauthorized");
  });
  await step("the e-mail can be registered again after deletion, with no trace of the old account", async () => {
    const again = await call("POST", "/api/mobile/auth/signup", { body: { email: emailFor("b"), password: "second-life" }, actor: "b" });
    expectOk(again, 201);
    assert.notEqual(again.body.customer.id, b.value.id);
    assert.deepEqual((await call("GET", "/api/mobile/orders", { token: again.body.session.accessToken })).body.orders, []);
    assert.deepEqual((await call("GET", "/api/mobile/support", { token: again.body.session.accessToken })).body.tickets, []);
    b.value = { name: "b", email: emailFor("b").toLowerCase(), password: "second-life", id: again.body.customer.id, access: again.body.session.accessToken, refresh: again.body.session.refreshToken };
    created.push(b.value);
  });

  section("Cleanup");
  await step("all accounts created by this run are deleted", async () => {
    let removed = 0;
    for (const actor of created) {
      const session = await signIn(actor);
      if (session.status !== 200) continue; // already deleted (customer B's first account)
      const res = await call("DELETE", "/api/mobile/me", { token: session.body.session.accessToken, body: { password: actor.password }, actor: `cleanup-${actor.name}` });
      if (res.status === 200) removed++;
    }
    assert.ok(removed >= 10, `removed ${removed} account(s)`);
    console.log(`      removed ${removed} throw-away account(s)`);
  });

  section("Contract hygiene");
  await step("every mobile response was sent with Cache-Control: no-store", async () => {
    assert.deepEqual([...cacheViolations], []);
  });

  console.log(`\n${failures.length ? "SMOKE FAILED" : "SMOKE PASSED"}: ${passed} check(s) passed, ${failures.length} failed`);
  if (failures.length) {
    for (const name of failures) console.log(`  - ${name}`);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("smoke test aborted:", error instanceof Error ? error.message : error);
  console.error(`is the backend running? ${BASE}/api/mobile/config`);
  process.exit(2);
});
