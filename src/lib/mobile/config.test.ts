import assert from "node:assert/strict";
import { test } from "node:test";
import { validateOrderInput } from "../mail/order.ts";
import { MAX_LINES, MAX_QTY_PER_LINE, NOTES_MAX, ORDERING_WINDOW } from "./constants.ts";
import { mobileConfig } from "./config.ts";

function withEnv(values: Record<string, string | undefined>, fn: () => void) {
  const saved = Object.fromEntries(Object.keys(values).map((key) => [key, process.env[key]]));
  try {
    for (const [key, value] of Object.entries(values)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    fn();
  } finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test("config matches docs/API_CONTRACT.md", () => {
  withEnv({ MAX_ORDER_TOTAL: undefined, NEXT_PUBLIC_CONTACT_EMAIL: undefined }, () => {
    assert.deepEqual(mobileConfig(), {
      ok: true,
      ordering: { opensAt: "12:00", closesAt: "23:00", timezone: "Africa/Accra", maxQtyPerLine: 20, maxLines: 30, maxOrderTotal: 5000 },
      payments: { cashOnDelivery: true, mobileMoney: false },
      contact: { phone: "+233547539942", followUpPhone: "+233538409046", email: "amoahinfotech@gmail.com" },
    });
  });
});

test("maxOrderTotal follows MAX_ORDER_TOTAL and ignores junk", () => {
  withEnv({ MAX_ORDER_TOTAL: "1200" }, () => assert.equal(mobileConfig().ordering.maxOrderTotal, 1200));
  for (const junk of ["", "abc", "0", "-5"]) withEnv({ MAX_ORDER_TOTAL: junk }, () => assert.equal(mobileConfig().ordering.maxOrderTotal, 5000, junk));
});

test("the contact e-mail honours the public contact override", () => {
  withEnv({ NEXT_PUBLIC_CONTACT_EMAIL: "kitchen@example.com" }, () => assert.equal(mobileConfig().contact.email, "kitchen@example.com"));
});

test("the advertised kitchen window is exactly what the website's order validation accepts", () => {
  const request = (preferredTime: string) => ({ name: "Kofi", phone: "0200000000", email: "k@example.com", fulfilment: "pickup" as const, preferredTime, notes: "", lines: [{ id: "x", qty: 1 }] });
  const accepts = (time: string) => !validateOrderInput(request(time)).preferredTime;
  assert.ok(accepts(ORDERING_WINDOW.opensAt));
  assert.ok(accepts(ORDERING_WINDOW.closesAt));
  assert.ok(!accepts("11:59"));
  assert.ok(!accepts("23:01"));
});

test("the advertised limits are exactly what the website enforces", () => {
  const request = (lines: number, notes: string) => ({
    name: "Kofi", phone: "0200000000", email: "k@example.com", fulfilment: "pickup" as const, preferredTime: "13:00", notes,
    lines: Array.from({ length: lines }, (_, i) => ({ id: `i${i}`, qty: 1 })),
  });
  assert.equal(validateOrderInput(request(MAX_LINES, "")).cart, undefined);
  assert.ok(validateOrderInput(request(MAX_LINES + 1, "")).cart);
  assert.equal(validateOrderInput(request(1, "n".repeat(NOTES_MAX))).notes, undefined);
  assert.ok(validateOrderInput(request(1, "n".repeat(NOTES_MAX + 1))).notes);
  assert.equal(MAX_QTY_PER_LINE, 20);
});
