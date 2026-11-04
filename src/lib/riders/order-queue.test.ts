import assert from "node:assert/strict";
import { test } from "node:test";
import { riderOrderScope, visibleInQueue } from "./order-queue";

const open = { riderId: null, status: "ready", paymentStatus: "paid", riderDeliveryStatus: null };
const claimed = { ...open, riderId: "rider-1", riderDeliveryStatus: "assigned" };
const completed = { ...claimed, status: "completed", riderDeliveryStatus: "delivered" };
const cancelled = { ...claimed, status: "cancelled" };

test("all orders includes open deliveries and the rider's entire assigned history", () => {
  for (const row of [open, claimed, completed, cancelled]) {
    assert.equal(visibleInQueue("all", row), true);
  }
  assert.equal(visibleInQueue("all", { ...open, paymentStatus: "pending" }), false);
  assert.equal(visibleInQueue("all", { ...open, status: "cancelled" }), false);
  assert.equal(visibleInQueue("all", { ...open, status: "completed" }), false);
});

test("the server all-orders scope restricts assigned history to the signed-in rider", () => {
  assert.equal(riderOrderScope("rider-1", "all"),
    "rider_id.eq.rider-1,and(rider_id.is.null,status.in.(pending,cooking,ready),payment_status.in.(paid,cod))");
});

test("the default active queue still excludes completed and cancelled deliveries", () => {
  assert.equal(visibleInQueue("", open), true);
  assert.equal(visibleInQueue("", claimed), true);
  assert.equal(visibleInQueue("", completed), false);
  assert.equal(visibleInQueue("", cancelled), false);
  assert.match(riderOrderScope("rider-1", ""), /rider_id\.eq\.rider-1,rider_delivery_status\.in\.\(assigned,picked_up\),status\.neq\.cancelled/);
});

test("individual queues retain their delivery filters", () => {
  for (const [queue, row] of [["open", open], ["claimed", claimed], ["delivered", completed], ["cancelled", cancelled]] as const) {
    assert.equal(visibleInQueue(queue, row), true);
  }
  assert.equal(visibleInQueue("open", claimed), false);
  assert.equal(visibleInQueue("claimed", cancelled), false);
  assert.equal(visibleInQueue("delivered", open), false);
  assert.equal(visibleInQueue("cancelled", completed), false);
});
