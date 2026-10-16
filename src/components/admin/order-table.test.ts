import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { availableOrderStatuses, type AdminOrder } from "../../lib/admin/contracts";
import { OrderTable } from "./admin-ui";

const base: AdminOrder = {
  id: "PML-2001", createdAt: "2025-01-02T12:00:00.000Z", updatedAt: "2025-01-02T12:00:00.000Z",
  customerName: "Kofi", customerPhone: "0240000000", customerEmail: "", fulfilment: "pickup", preferredTime: "", notes: "",
  lines: [], total: 40, status: "pending", paymentStatus: "pending", transactionId: "123456789012",
};

test("pending PaySwitch payments are clickable in the admin table", () => {
  const html = renderToStaticMarkup(createElement(OrderTable, { items: [base] }));
  assert.match(html, /<button[^>]*aria-label="Check PaySwitch payment status for PML-2001"/);
  assert.match(html, />PML-2001\.\.\.\.\.\.<\/a>/);
  assert.doesNotMatch(html, />PML-2001<\/a>/);
});

test("settled, pay-on-delivery and customer-portal payments are not clickable", () => {
  for (const order of [{ ...base, paymentStatus: "paid" as const }, { ...base, paymentStatus: "cod" as const, transactionId: null }]) {
    assert.doesNotMatch(renderToStaticMarkup(createElement(OrderTable, { items: [order] })), /<button/);
  }
  assert.doesNotMatch(renderToStaticMarkup(createElement(OrderTable, { items: [base], checkPayments: false })), /<button/);
});

test("kitchen status options follow the legal transition sequence and payment gate", () => {
  assert.deepEqual(availableOrderStatuses("pending", "paid"), ["pending", "cooking", "cancelled"]);
  assert.deepEqual(availableOrderStatuses("pending", "pending"), ["pending", "cancelled"]);
  assert.deepEqual(availableOrderStatuses("cooking", "failed"), ["cooking", "cancelled"]);
  assert.deepEqual(availableOrderStatuses("ready", "cod"), ["ready", "out", "completed", "cancelled"]);
  assert.deepEqual(availableOrderStatuses("completed", "paid"), ["completed"]);
  assert.deepEqual(availableOrderStatuses("cancelled", "paid"), ["cancelled"]);
});

test("admin order table renders an inline kitchen status selector", () => {
  const paidOrder = { ...base, paymentStatus: "paid" as const };
  const html = renderToStaticMarkup(createElement(OrderTable, { items: [paidOrder] }));
  assert.match(html, /aria-label="Kitchen status for order PML-2001"/);
  assert.match(html, /<option value="cooking">Cooking<\/option>/);
  assert.doesNotMatch(html, /<option value="ready">Ready<\/option>/);
});
