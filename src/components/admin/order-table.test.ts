import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { AdminOrder } from "../../lib/admin/contracts";
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
