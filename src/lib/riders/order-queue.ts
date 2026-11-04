export const riderQueues = ["all", "open", "claimed", "delivered", "cancelled"] as const;

export function riderOrderScope(riderId: string, queue: string) {
  const open = "and(rider_id.is.null,status.in.(pending,cooking,ready),payment_status.in.(paid,cod))";
  const claimed = `and(rider_id.eq.${riderId},rider_delivery_status.in.(assigned,picked_up),status.neq.cancelled)`;
  if (queue === "all") return `rider_id.eq.${riderId},${open}`;
  if (queue === "open") return open;
  if (queue === "claimed") return claimed;
  if (queue === "delivered") return `and(rider_id.eq.${riderId},or(rider_delivery_status.eq.delivered,status.eq.completed))`;
  if (queue === "cancelled") return `and(rider_id.eq.${riderId},status.eq.cancelled)`;
  return `${claimed},${open}`;
}

export function visibleInQueue(queue: string, row: Record<string, unknown>) {
  const status = String(row.status ?? "");
  const payment = String(row.paymentStatus ?? "");
  const delivery = row.riderDeliveryStatus;
  const open = row.riderId == null && ["pending", "cooking", "ready"].includes(status) && ["paid", "cod"].includes(payment);
  const claimed = row.riderId != null && (delivery === "assigned" || delivery === "picked_up") && status !== "cancelled";
  const delivered = row.riderId != null && (delivery === "delivered" || status === "completed");
  const cancelled = row.riderId != null && status === "cancelled";
  if (queue === "all") return row.riderId != null || open;
  if (queue === "open") return open;
  if (queue === "claimed") return claimed;
  if (queue === "delivered") return delivered;
  if (queue === "cancelled") return cancelled;
  return open || claimed;
}
