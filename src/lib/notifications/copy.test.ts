import assert from "node:assert/strict";
import test from "node:test";
import { customerOrderStatusEmail, notificationCopy } from "./copy";

test("staff order alerts carry a stable order route payload", () => {
  assert.deepEqual(
    notificationCopy({
      eventType: "order.created",
      entityId: "order-id",
      payload: { orderRef: "PL-123", paymentStatus: "pending" },
    }),
    {
      title: "New order · PL-123",
      body: "Payment pending · open the dashboard to review.",
      data: { type: "order.created", orderId: "order-id", orderRef: "PL-123" },
    },
  );
});

test("support alerts do not expose unbounded subject content", () => {
  const copy = notificationCopy({
    eventType: "support.created",
    entityId: "ticket-id",
    payload: { subject: "x".repeat(200) },
  });
  assert.equal(copy.body, `A customer submitted “${"x".repeat(90)}”.`);
  assert.deepEqual(copy.data, { type: "support.created", ticketId: "ticket-id" });
});

test("customer status notifications use the human-readable status in email", () => {
  const email = customerOrderStatusEmail("PL-123", "ready");
  assert.equal(email.subject, "Order PL-123 update");
  assert.equal(email.message, "Your Play Man Lounge order PL-123 is ready.");
  assert.equal(
    notificationCopy({
      eventType: "order.status_changed",
      entityId: "order-id",
      payload: { orderRef: "PL-123", status: "ready" },
    }).body,
    "Your order is ready.",
  );
});
