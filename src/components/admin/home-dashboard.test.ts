import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { Dashboard } from "../../lib/admin/contracts";
import { DashboardStats } from "./home-dashboard";

const dashboard: Dashboard = {
  totalOrders: 10, paidOrders: 4, pendingOrders: 3, codOrders: 2, failedPayments: 1,
  revenue: 200, openSupport: 1, closedSupport: 2, menuItems: 8,
  customerCount: 6, adminCount: null, recentOrders: [],
};

test("admin dashboard stat cards pair every label and value with a decorative icon", () => {
  const html = renderToStaticMarkup(createElement(DashboardStats, { dashboard }));
  const labels = [...html.matchAll(/<dt>.*?<span>(.*?)<\/span><\/dt>/g)].map((match) => match[1]);
  assert.deepEqual(labels, ["Orders created", "Paid", "Pending payment", "Pay on delivery", "Failed payments"]);
  const values = [...html.matchAll(/<dd>(.*?)<\/dd>/g)].map((match) => match[1]);
  assert.deepEqual(values, ["10", "4", "3", "2", "1"]);
  assert.equal((html.match(/<svg[^>]*aria-hidden="true"/g) ?? []).length, labels.length);
  assert.doesNotMatch(html, /admin-stats-manager|Administrators/);
});

test("manager dashboards also show the administrator card, including a zero count", () => {
  const html = renderToStaticMarkup(createElement(DashboardStats, { dashboard: { ...dashboard, adminCount: 0 } }));
  assert.match(html, /admin-stats-manager/);
  assert.match(html, /lucide-shield-check/);
  assert.match(html, /<span>Administrators<\/span><\/dt><dd>0<\/dd>/);
  assert.equal((html.match(/<svg[^>]*aria-hidden="true"/g) ?? []).length, 6);
});
