export type NotificationCopyInput = {
  eventType: "order.created" | "support.created" | "order.status_changed";
  entityId: string;
  payload: Record<string, unknown>;
};

const statusLabel = (status: string) =>
  ({
    pending: "received",
    cooking: "being prepared",
    ready: "ready",
    out: "on its way",
    completed: "completed",
    cancelled: "cancelled",
  })[status] ?? "updated";

export function notificationCopy({
  eventType,
  entityId,
  payload,
}: NotificationCopyInput): { title: string; body: string; data: Record<string, string> } {
  if (eventType === "order.created") {
    const orderRef = typeof payload.orderRef === "string" ? payload.orderRef : "";
    const awaitingPayment = payload.paymentStatus === "pending";
    return {
      title: `New order · ${orderRef}`,
      body: awaitingPayment
        ? "Payment pending · open the dashboard to review."
        : "Payment confirmed · open the dashboard to prepare.",
      data: { type: eventType, orderId: entityId, orderRef },
    };
  }
  if (eventType === "support.created") {
    const subject = typeof payload.subject === "string" ? payload.subject.slice(0, 90) : "New request";
    return {
      title: "New support request",
      body: `A customer submitted “${subject}”.`,
      data: { type: eventType, ticketId: entityId },
    };
  }
  const orderRef = typeof payload.orderRef === "string" ? payload.orderRef : "";
  const status = typeof payload.status === "string" ? payload.status : "";
  return {
    title: `Order ${orderRef} update`,
    body: `Your order is ${statusLabel(status)}.`,
    data: { type: eventType, orderId: entityId, status },
  };
}

export function customerOrderStatusEmail(orderRef: string, status: string) {
  return {
    subject: `Order ${orderRef} update`,
    message: `Your Play Man Lounge order ${orderRef} is ${statusLabel(status)}.`,
  };
}
