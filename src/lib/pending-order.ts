/**
 * Hosted checkout takes the customer off the site, which throws away the React
 * state holding their order. The order is parked in session storage first and
 * rebuilt when PaySwitch sends them back, so the kitchen still gets one email
 * with the payment reference attached.
 */
import { menu } from "@/lib/content";
import type { Fulfilment, OrderPayload, PaymentInfo } from "@/lib/email";
import type { MomoNetwork } from "@/lib/payments/networks";

export type PendingOrder = {
  transactionId: string;
  savedAt: number;
  total: number;
  network: MomoNetwork;
  momoNumber: string;
  customer: {
    name: string;
    phone: string;
    email: string;
    fulfilment: Fulfilment;
    preferredTime: string;
    notes: string;
  };
  lines: { id: string; qty: number }[];
};

const KEY = "playman.pendingOrder";
const MAX_AGE_MS = 2 * 60 * 60 * 1000;

export function rememberPendingOrder(pending: PendingOrder) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(pending));
  } catch {
    // Private browsing can refuse storage. The payment still works; the page
    // just cannot email the order by itself when the customer returns.
  }
}

export function readPendingOrder(): PendingOrder | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingOrder;
    if (!parsed?.transactionId) return null;
    if (Date.now() - parsed.savedAt > MAX_AGE_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearPendingOrder() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // Nothing to clean up when storage is unavailable.
  }
}

/** Turns a parked order back into the payload the order form submits. */
export function restoreOrder(pending: PendingOrder, payment: PaymentInfo): OrderPayload {
  const lines = pending.lines.flatMap((line) => {
    const item = menu.find((candidate) => candidate.id === line.id);
    return item ? [{ item, qty: line.qty }] : [];
  });

  return {
    ...pending.customer,
    lines,
    total: lines.reduce((sum, line) => sum + line.qty * line.item.price, 0) || pending.total,
    payment,
  };
}
