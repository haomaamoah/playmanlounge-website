import assert from "node:assert/strict";
import { test } from "node:test";
import { liveChangeVisible } from "./changes";

const customer = { portal: "customer" as const, id: "cust-1" };
const admin = { portal: "admin" as const, id: "admin-1", kitchenId: "kitchen-a" };
const rider = { portal: "rider" as const, id: "rider-1" };

test("a customer hears their own order and the shared menu, not someone else's ticket", () => {
  assert.equal(liveChangeVisible(customer, "orders", { customer_id: "cust-1" }), true);
  assert.equal(liveChangeVisible(customer, "orders", { customer_id: "cust-2" }), false);
  assert.equal(liveChangeVisible(customer, "menu_items", { id: "fried-rice" }), true);
  assert.equal(liveChangeVisible(customer, "rider_locations", { rider_id: "rider-1" }), false);
});

test("a kitchen admin hears orders for their kitchen only", () => {
  assert.equal(liveChangeVisible(admin, "orders", { kitchen_id: "kitchen-a" }), true);
  assert.equal(liveChangeVisible(admin, "orders", { kitchen_id: "kitchen-b" }), false);
  assert.equal(liveChangeVisible(admin, "menu_items", { id: "playboy" }), true);
});

test("a rider hears open or assigned deliveries", () => {
  assert.equal(liveChangeVisible(rider, "orders", { fulfilment: "delivery", rider_id: null }), true);
  assert.equal(liveChangeVisible(rider, "orders", { fulfilment: "delivery", rider_id: "rider-1" }), true);
  assert.equal(liveChangeVisible(rider, "orders", { fulfilment: "delivery", rider_id: "rider-2" }), false);
  assert.equal(liveChangeVisible(rider, "orders", { fulfilment: "pickup", rider_id: null }), false);
});
