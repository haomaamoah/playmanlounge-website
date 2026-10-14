import assert from "node:assert/strict";
import { test } from "node:test";
import type { MenuItem } from "./content.ts";
import { MAX_PAYMENT_RETRIES, PAYMENT_TIMEOUT_MS, readPendingOrder, rememberPendingOrder, restoreOrder, startPaymentAttempt, type PendingOrder } from "./pending-order.ts";

test("mobile money gives two minutes per attempt and allows only two retries", () => {
  assert.equal(PAYMENT_TIMEOUT_MS, 120_000);
  assert.equal(MAX_PAYMENT_RETRIES, 2);
});

test("each retry starts a fresh timer without resetting its retry count", () => {
  const retry = startPaymentAttempt({ ...pending, retriesUsed: 1 }, 5000);
  assert.equal(retry.attemptStartedAt, 5000);
  assert.equal(retry.retriesUsed, 1);
  assert.equal(retry.lastPaymentState, "pending");
});

const item: MenuItem = {
  id: "admin-created-dish",
  name: "New dish",
  description: "Added by the kitchen",
  price: 12.35,
  category: "food",
  image: "https://example.supabase.co/storage/v1/object/public/menu-images/new.webp",
  width: 1100,
  height: 733,
};

const pending: PendingOrder = {
  transactionId: "123456789012",
  savedAt: Date.now(),
  total: 20,
  customer: {
    name: "Test customer",
    phone: "+233547539942",
    email: "customer@example.com",
    fulfilment: "delivery",
    preferredTime: "13:00",
    notes: "",
  },
  lines: [{ id: item.id, qty: 3 }],
};

test("checkout restores admin-created dishes from the live catalog", () => {
  const restored = restoreOrder(pending, { method: "delivery" }, [item]);
  assert.equal(restored.lines.length, 1);
  assert.equal(restored.lines[0].item.image, item.image);
  assert.equal(restored.lines[0].item.price, item.price);
  assert.equal(restored.total, 37.05);
});

test("checkout does not silently drop dishes missing from the live catalog", () => {
  assert.throws(
    () => restoreOrder(pending, { method: "delivery" }, []),
    /no longer available/
  );
});

test("portal payment details survive reload even when the start outcome has no reference", (t) => {
  const original = Object.getOwnPropertyDescriptor(globalThis, "sessionStorage");
  const storage = new Map<string, string>();
  Object.defineProperty(globalThis, "sessionStorage", {
    configurable: true,
    value: {
      setItem: (key: string, value: string) => storage.set(key, value),
      getItem: (key: string) => storage.get(key) ?? null,
    },
  });
  t.after(() => {
    if (original) Object.defineProperty(globalThis, "sessionStorage", original);
    else Reflect.deleteProperty(globalThis, "sessionStorage");
  });
  assert.equal(rememberPendingOrder({
    ...pending, customerPortal: true, startUnconfirmed: true, transactionId: "", savedAt: 0,
    attemptStartedAt: 1_760_000_000_000, retriesUsed: 1,
  }), true);
  const restored = readPendingOrder();
  assert.equal(restored?.customerPortal, true);
  assert.equal(restored?.startUnconfirmed, true);
  assert.equal(restored?.attemptStartedAt, 1_760_000_000_000);
  assert.equal(restored?.retriesUsed, 1);
  assert.equal(restored?.customer.email, pending.customer.email);
  assert.ok(restored && restored.savedAt > 0);
});

test("payment detail persistence reports unavailable browser storage", (t) => {
  const original = Object.getOwnPropertyDescriptor(globalThis, "sessionStorage");
  Object.defineProperty(globalThis, "sessionStorage", {
    configurable: true,
    get: () => { throw new Error("Storage unavailable"); },
  });
  t.after(() => {
    if (original) Object.defineProperty(globalThis, "sessionStorage", original);
    else Reflect.deleteProperty(globalThis, "sessionStorage");
  });
  assert.equal(rememberPendingOrder(pending), false);
});
