import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { AdminOrder } from "../../lib/admin/contracts";
import { CustomerOrdersView } from "./customer-orders";
import { CustomerOrderDetailView } from "./customer-order-detail";

const order: AdminOrder = {
  id: "PML-1001", createdAt: "2025-01-02T12:00:00.000Z", updatedAt: "2025-01-02T12:00:00.000Z", customerName: "Ama Mensah", customerPhone: "0240000000",
  customerEmail: "ama@example.com", fulfilment: "delivery", preferredTime: "", notes: "Extra pepper",
  lines: [{ itemId: "jollof", name: "Jollof", qty: 2, unitPrice: 50, image: "/media/jollof.webp" }], total: 100,
  status: "cooking", paymentStatus: "paid", transactionId: "TX-9",
};

test("customer orders table shows Order and Payment without customer names", () => {
  const html = renderToStaticMarkup(createElement(CustomerOrdersView, { orders: [order] }));
  assert.match(html, /<th>Order<\/th>/);
  assert.match(html, /<th>Payment<\/th>/);
  assert.doesNotMatch(html, /Order \/ customer/);
  assert.doesNotMatch(html, /Ama Mensah/);
  assert.match(html, /href="\/app\/orders\/PML-1001"/);
  assert.match(html, /Paid/);
});

test("customer order detail shows only the ticket and fulfilment sections", () => {
  const html = renderToStaticMarkup(createElement(CustomerOrderDetailView, { order }));
  const headings = [...html.matchAll(/<h2>(.*?)<\/h2>/g)].map((match) => match[1]);
  assert.deepEqual(headings, ["Order ticket", "Customer &amp; fulfilment"]);
  assert.doesNotMatch(html, /Save kitchen status|Kitchen status changes/);
  assert.match(html, /TX-9/);
});
