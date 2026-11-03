import assert from "node:assert/strict";
import { test } from "node:test";
import type { Dashboard } from "./contracts";
import { dashboardSummaryCsv, recentOrdersCsv, toCsv } from "./dashboard-export";

const dashboard: Dashboard = {
  totalOrders: 4,
  paidOrders: 2,
  pendingOrders: 1,
  failedPayments: 1,
  codOrders: 0,
  revenue: 75,
  openSupport: 1,
  closedSupport: 3,
  menuItems: 10,
  customerCount: null,
  adminCount: 2,
  recentOrders: [],
};

test("csv cells that contain commas stay in one column", () => {
  assert.equal(toCsv([["Name", "A, B"]]), "Name,\"A, B\"");
});

test("dashboard summary includes the figures shown on the kitchen home", () => {
  const csv = dashboardSummaryCsv(dashboard);
  assert.match(csv, /Orders created,4/);
  assert.match(csv, /Paid revenue \(GH₵\),GH₵ 75/);
  assert.match(csv, /Registered customers,Not set up/);
  assert.match(csv, /Administrators,2/);
});

test("recent orders export one row per ticket", () => {
  const csv = recentOrdersCsv([
    {
      id: "PML-1",
      createdAt: "2026-11-03T12:00:00.000Z",
      updatedAt: "2026-11-03T12:00:00.000Z",
      customerName: "Ama, Serwaa",
      customerEmail: "",
      customerPhone: "024 000 0000",
      fulfilment: "delivery",
      preferredTime: "",
      notes: "",
      status: "cooking",
      paymentStatus: "paid",
      total: 25,
      transactionId: null,
      kitchenId: "kaneshie",
      deliveryAddress: "",
      deliveryLatitude: null,
      deliveryLongitude: null,
      lines: [],
    },
  ]);
  assert.match(csv, /"Ama, Serwaa"/);
  assert.match(csv, /PML-1/);
  assert.match(csv, /GH₵ 25/);
});
