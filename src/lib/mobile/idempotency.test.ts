import assert from "node:assert/strict";
import { test } from "node:test";
import { requestKeyFor, sameSubmission, type Submission } from "./idempotency.ts";

const saved = {
  customer_name: "Kofi Mensah",
  customer_phone: "+233200000000",
  fulfilment: "delivery",
  preferred_time: "13:30",
  notes: "Delivery address: Nikoi Olai St\n\nhot",
  total: "55.00",
  lines: [
    { itemId: "chairman", name: "Chairman", qty: 2, unitPrice: 25, image: "" },
    { itemId: "samosa", name: "Samosa", qty: 1, unitPrice: 5, image: "" },
  ],
};
const same: Submission = {
  name: "Kofi Mensah",
  phone: "+233200000000",
  fulfilment: "delivery",
  preferredTime: "13:30",
  storedNotes: "Delivery address: Nikoi Olai St\n\nhot",
  lines: [{ id: "samosa", qty: 1 }, { id: "chairman", qty: 2 }],
  expectedTotal: 55,
};

test("stored request keys are namespaced per customer and can never equal a web key", () => {
  const key = "123e4567-e89b-12d3-a456-426614174000";
  assert.equal(requestKeyFor("customer-a", key), `mobile:customer-a:${key}`);
  assert.notEqual(requestKeyFor("customer-a", key), requestKeyFor("customer-b", key));
  assert.ok(!/^[a-zA-Z0-9-]{16,100}$/.test(requestKeyFor("customer-a", key)), "web keys cannot contain ':'");
});

test("the same order replays regardless of line order", () => {
  assert.ok(sameSubmission(saved, same));
  assert.ok(sameSubmission(saved, { ...same, expectedTotal: undefined }), "expectedTotal is optional");
});

test("any difference in what was asked for is a conflict", () => {
  assert.ok(!sameSubmission(saved, { ...same, lines: [{ id: "chairman", qty: 3 }, { id: "samosa", qty: 1 }] }));
  assert.ok(!sameSubmission(saved, { ...same, lines: [{ id: "chairman", qty: 2 }] }));
  assert.ok(!sameSubmission(saved, { ...same, lines: [...same.lines, { id: "water", qty: 1 }] }));
  assert.ok(!sameSubmission(saved, { ...same, storedNotes: "Delivery address: Elsewhere\n\nhot" }));
  assert.ok(!sameSubmission(saved, { ...same, name: "Ama" }));
  assert.ok(!sameSubmission(saved, { ...same, phone: "0200000001" }));
  assert.ok(!sameSubmission(saved, { ...same, fulfilment: "pickup" }));
  assert.ok(!sameSubmission(saved, { ...same, preferredTime: "14:00" }));
  assert.ok(!sameSubmission(saved, { ...same, expectedTotal: 50 }));
});

test("a replay must ask for the same way to pay", () => {
  assert.ok(sameSubmission(saved, { ...same, payment: { method: "delivery" } }));
  assert.ok(!sameSubmission(saved, { ...same, payment: { method: "momo" } }));
  assert.ok(sameSubmission({ ...saved, transaction_id: "123456789012" }, { ...same, payment: { method: "momo" } }));
});

test("prices are not compared: a replay after a menu change is still the same order", () => {
  const repriced = { ...saved, lines: saved.lines.map((line) => ({ ...line, unitPrice: line.unitPrice * 2 })) };
  assert.ok(sameSubmission(repriced, { ...same, expectedTotal: undefined }));
});

test("a malformed stored order never matches", () => {
  assert.ok(!sameSubmission({ ...saved, lines: null }, same));
});
