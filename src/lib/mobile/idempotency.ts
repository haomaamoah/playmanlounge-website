import { pesewas } from "../content";

/**
 * Stored in the existing `orders.request_key` column. The customer id is part of the value, so one customer's
 * Idempotency-Key can never collide with (or reveal) another customer's, and it can never equal a web key
 * (those cannot contain ":").
 */
export const requestKeyFor = (customerId: string, key: string) => `mobile:${customerId}:${key}`;

export type Submission = {
  name: string;
  phone: string;
  fulfilment: string;
  preferredTime: string;
  storedNotes: string;
  deliveryLatitude?: number | null;
  deliveryLongitude?: number | null;
  lines: { id: string; qty: number }[];
  expectedTotal?: number;
  payment?: { method: "delivery" | "momo" };
};

const signature = (lines: { id: string; qty: number }[]) =>
  JSON.stringify(lines.map((line) => [line.id, line.qty]).sort((a, b) => String(a[0]).localeCompare(String(b[0]))));

/**
 * A replay is "the same body" when it asks for the same order as the saved one. Prices are deliberately not
 * compared (the menu may have moved since), only what the customer chose and, when they sent it, the total they
 * were shown.
 */
export function sameSubmission(saved: Record<string, unknown>, incoming: Submission): boolean {
  const savedLines = (Array.isArray(saved.lines) ? saved.lines : []).map((line: Record<string, unknown>) => ({
    id: String(line.itemId),
    qty: Number(line.qty),
  }));
  return (
    saved.customer_name === incoming.name &&
    saved.customer_phone === incoming.phone &&
    saved.fulfilment === incoming.fulfilment &&
    saved.preferred_time === incoming.preferredTime &&
    saved.notes === incoming.storedNotes &&
    (incoming.deliveryLatitude === undefined || (saved.delivery_latitude == null ? null : Number(saved.delivery_latitude)) === incoming.deliveryLatitude) &&
    (incoming.deliveryLongitude === undefined || (saved.delivery_longitude == null ? null : Number(saved.delivery_longitude)) === incoming.deliveryLongitude) &&
    signature(savedLines) === signature(incoming.lines) &&
    (incoming.payment === undefined || (saved.transaction_id ? "momo" : "delivery") === incoming.payment.method) &&
    (incoming.expectedTotal === undefined || pesewas(Number(saved.total)) === pesewas(incoming.expectedTotal))
  );
}
