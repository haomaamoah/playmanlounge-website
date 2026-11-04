import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { RiderDashboardStats } from "./rider-home";

test("rider statistics render accessible delivery charts with real proportions", () => {
  const html = renderToStaticMarkup(createElement(RiderDashboardStats, { stats: {
    activeDeliveries: 3, completedToday: 2, completedDeliveries: 8, openSupportRequests: 1,
  } }));
  assert.match(html, /aria-label="3 active deliveries, 8 completed deliveries"/);
  assert.match(html, /class="rider-chart-active" style="flex-grow:3"/);
  assert.match(html, /class="rider-chart-completed" style="flex-grow:8"/);
  assert.match(html, /aria-label="2 of 8 deliveries completed today, 25%"/);
  assert.match(html, /style="width:25%"/);
  assert.match(html, /Open support requests/);
  assert.equal((html.match(/<article>/g) ?? []).length, 4);
});

test("empty rider charts explain missing activity without invalid proportions", () => {
  const html = renderToStaticMarkup(createElement(RiderDashboardStats, { stats: {
    activeDeliveries: 0, completedToday: 0, completedDeliveries: 0, openSupportRequests: 0,
  } }));
  assert.match(html, /No deliveries to chart yet/);
  assert.match(html, /No completed deliveries yet/);
  assert.doesNotMatch(html, /NaN|Infinity|role="img"/);
});
