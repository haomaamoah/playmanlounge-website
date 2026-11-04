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
  kitchenId:"kitchen-a",deliveryAddress:"",deliveryLatitude:null,deliveryLongitude:null,
};

test("pending PaySwitch payments are clickable in the admin table", () => {
  const html = renderToStaticMarkup(createElement(OrderTable, { items: [base] }));
  assert.match(html, /<button[^>]*aria-label="Check PaySwitch payment status for PML-2001"/);
  assert.match(html, /href="\/admin\/orders\/PML-2001"/);
  assert.match(html, />PML-2\.\.\.</);
  assert.doesNotMatch(html, />PML-2001<\/a>/);
});

test("settled, pay-on-delivery and customer-portal payments are not clickable", () => {
  for (const order of [{ ...base, paymentStatus: "paid" as const }, { ...base, paymentStatus: "cod" as const, transactionId: null }]) {
    assert.doesNotMatch(renderToStaticMarkup(createElement(OrderTable, { items: [order] })), /Check PaySwitch payment status/);
  }
  assert.doesNotMatch(renderToStaticMarkup(createElement(OrderTable, { items: [base], checkPayments: false })), /Check PaySwitch payment status/);
});

test("kitchen status options follow the legal transition sequence and payment gate", () => {
  assert.deepEqual(availableOrderStatuses("pending", "paid"), ["pending", "cooking", "ready", "cancelled"]);
  assert.deepEqual(availableOrderStatuses("pending", "cod"), ["pending", "cooking", "ready", "cancelled"]);
  assert.deepEqual(availableOrderStatuses("pending", "pending"), ["pending", "cancelled"]);
  assert.deepEqual(availableOrderStatuses("cooking", "failed"), ["cooking", "cancelled"]);
  assert.deepEqual(availableOrderStatuses("ready", "cod"), ["ready", "out", "completed", "cancelled"]);
  assert.deepEqual(availableOrderStatuses("completed", "paid"), ["completed"]);
  assert.deepEqual(availableOrderStatuses("cancelled", "paid"), ["cancelled"]);
});

test("admin order rows show kitchen status as text and proceed or cancel actions", () => {
  const paidOrder = { ...base, paymentStatus: "paid" as const };
  const html = renderToStaticMarkup(createElement(OrderTable, { items: [paidOrder] }));
  assert.match(html, /<th>Actions<\/th>/);
  assert.match(html, /admin-badge-pending/);
  assert.doesNotMatch(html, /<select/);
  assert.match(html, /aria-label="Proceed order PML-2001 to Cooking"/);
  assert.match(html, /aria-label="Cancel order PML-2001"/);
  assert.match(html, /lucide-arrow-right/);
  assert.match(html, /lucide-x/);
  assert.match(html, />Proceed</);
  assert.match(html, />Cancel</);
  assert.doesNotMatch(html, /admin-order-action-dot/);
  assert.doesNotMatch(html, /admin-order-action-proceed" disabled=""/);
  assert.doesNotMatch(html, /admin-order-action-cancel" disabled=""/);
});

test("customer order tables do not include kitchen proceed or cancel actions", () => {
  const html = renderToStaticMarkup(createElement(OrderTable, { items: [{ ...base, paymentStatus: "paid" }], canUpdateStatus: false }));
  assert.doesNotMatch(html, /<th>Actions<\/th>/);
  assert.doesNotMatch(html, /admin-order-action/);
  assert.doesNotMatch(html, /lucide-arrow-right/);
  assert.doesNotMatch(html, />Proceed</);
  assert.doesNotMatch(html, />Cancel</);
});

test("proceed is disabled when the order is completed or cancelled", () => {
  const html = renderToStaticMarkup(
    createElement(OrderTable, {
      items: [
        { ...base, status: "completed", paymentStatus: "paid" },
        { ...base, id: "PML-2002", status: "cancelled", paymentStatus: "failed" },
      ],
    }),
  );
  assert.match(html, /admin-badge-completed/);
  assert.match(html, /admin-badge-cancelled/);
  assert.equal((html.match(/admin-order-action-proceed" disabled=""/g) ?? []).length, 2);
  assert.equal((html.match(/admin-order-action-cancel" disabled=""/g) ?? []).length, 2);
});

test("proceed stays off until payment is confirmed", () => {
  const html = renderToStaticMarkup(createElement(OrderTable, { items: [base] }));
  assert.match(html, /admin-order-action-proceed" disabled=""/);
  assert.doesNotMatch(html, /admin-order-action-cancel" disabled=""/);
});
