import assert from "node:assert/strict";
import { test } from "node:test";
import type { Dashboard } from "@/lib/admin/contracts";
import { applyDashboardOrders, applyStreamList } from "./apply";

const orders = [
  { id: "a", status: "pending" },
  { id: "b", status: "cooking" },
];

test("an update emission replaces the matching row and leaves the rest", () => {
  const next = applyStreamList(orders, 2, {
    table: "orders",
    event: "UPDATE",
    id: "a",
    row: { id: "a", status: "ready" },
  }, (order) => order.id);
  assert.deepEqual(next.items.map((order) => order.status), ["ready", "cooking"]);
  assert.equal(next.total, 2);
});

test("an insert emission prepends a new row", () => {
  const next = applyStreamList(orders, 2, {
    table: "orders",
    event: "INSERT",
    id: "c",
    row: { id: "c", status: "pending" },
  }, (order) => order.id);
  assert.equal(next.items[0]?.id, "c");
  assert.equal(next.total, 3);
});

test("a dashboard emission updates the matching recent order in place", () => {
  const dashboard = {
    totalOrders: 2, paidOrders: 1, pendingOrders: 1, failedPayments: 0, codOrders: 0, revenue: 35,
    openSupport: 0, closedSupport: 0, menuItems: 1, customerCount: 1, adminCount: null,
    recentOrders: [{ id: "a", status: "pending", paymentStatus: "paid", total: 35 }],
  } as Dashboard;
  const next = applyDashboardOrders(dashboard, {
    table: "orders",
    event: "UPDATE",
    id: "a",
    row: { id: "a", status: "cooking", paymentStatus: "paid", total: 35 },
    previousPaymentStatus: "paid",
  });
  assert.equal((next.recentOrders[0] as { status: string }).status, "cooking");
  assert.equal(next.totalOrders, 2);
  assert.equal(next.revenue, 35);
});

test("a delete emission removes the row", () => {
  const next = applyStreamList(orders, 2, {
    table: "orders",
    event: "DELETE",
    id: "b",
    row: null,
  }, (order) => order.id);
  assert.deepEqual(next.items.map((order) => order.id), ["a"]);
  assert.equal(next.total, 1);
});

test("an update that no longer matches the open filter leaves the list", () => {
  const next = applyStreamList(orders, 2, {
    table: "orders",
    event: "UPDATE",
    id: "a",
    row: { id: "a", status: "cancelled" },
  }, (order) => order.id, (row) => row.status !== "cancelled");
  assert.deepEqual(next.items.map((order) => order.id), ["b"]);
});
