import { formatGhs, site, type MenuItem } from "@/lib/content";
import { networkLabel, type MomoNetwork } from "@/lib/payments/networks";

export type Fulfilment = "pickup" | "delivery";

/** How the customer chose to pay, and what actually happened if they paid now. */
export type PaymentInfo =
  | { method: "delivery" }
  | {
      method: "momo";
      state: "paid" | "pending" | "failed";
      reference: string;
      network?: MomoNetwork;
      momoNumber?: string;
    };

export type OrderPayload = {
  name: string;
  phone: string;
  email: string;
  fulfilment: Fulfilment;
  preferredTime: string;
  notes: string;
  lines: { item: MenuItem; qty: number }[];
  total: number;
  payment: PaymentInfo;
};

export function formatPaymentLine(payment: PaymentInfo, total: number) {
  if (payment.method === "delivery") {
    return `Payment: PAY ON DELIVERY — collect ${formatGhs(total)} on arrival`;
  }
  const wallet = [payment.network ? networkLabel(payment.network) : "", payment.momoNumber]
    .filter(Boolean)
    .join(" ");
  const walletNote = wallet ? ` from ${wallet}` : "";
  if (payment.state === "paid") {
    return `Payment: PAID ONLINE${walletNote} — PaySwitch reference ${payment.reference}`;
  }
  if (payment.state === "pending") {
    return `Payment: NOT CONFIRMED YET${walletNote} — PaySwitch reference ${payment.reference}. Check the PaySwitch dashboard before cooking.`;
  }
  return `Payment: ONLINE PAYMENT FAILED${walletNote} — collect ${formatGhs(total)} instead (reference ${payment.reference})`;
}

export function businessEmail() {
  return (
    process.env.NEXT_PUBLIC_ORDER_EMAIL?.trim() || site.email
  );
}

export function contactEmail() {
  return (
    process.env.NEXT_PUBLIC_CONTACT_EMAIL?.trim() || site.email
  );
}

export function web3formsKey() {
  return process.env.NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY?.trim() || "";
}

export function formatOrderBody(order: OrderPayload) {
  const items = order.lines
    .map(
      (line) =>
        `- ${line.qty} × ${line.item.name} (${formatGhs(line.item.price)}) = ${formatGhs(line.qty * line.item.price)}`
    )
    .join("\n");

  const fulfilmentLabel =
    order.fulfilment === "delivery"
      ? "Delivery"
      : "Arranged pickup at the Kaneshie hub (not walk-in)";

  return [
    `New order for ${site.name}`,
    "",
    `Name: ${order.name}`,
    `Phone: ${order.phone}`,
    `Email: ${order.email}`,
    `Fulfilment: ${fulfilmentLabel}`,
    `Preferred time: ${order.preferredTime}`,
    "",
    "Items:",
    items || "(none)",
    "",
    `Total: ${formatGhs(order.total)}`,
    formatPaymentLine(order.payment, order.total),
    "",
    "Notes:",
    order.notes.trim() || "(none)",
  ].join("\n");
}

export function formatOrderSubject(order: OrderPayload) {
  const paymentTag =
    order.payment.method === "delivery"
      ? "pay on delivery"
      : order.payment.state === "paid"
        ? "PAID"
        : "payment unconfirmed";
  return `${site.name} order — ${order.name} — ${formatGhs(order.total)} — ${paymentTag}`;
}

export function mailtoHref(to: string, subject: string, body: string) {
  const params = new URLSearchParams({ subject, body });
  return `mailto:${to}?${params.toString()}`;
}

export async function submitViaWeb3Forms(fields: {
  subject: string;
  fromName: string;
  fromEmail: string;
  message: string;
  replyTo?: string;
}) {
  const key = web3formsKey();
  if (!key) return { ok: false as const, reason: "no-key" as const };

  const res = await fetch("https://api.web3forms.com/submit", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      access_key: key,
      subject: fields.subject,
      name: fields.fromName,
      email: fields.fromEmail,
      message: fields.message,
      replyto: fields.replyTo || fields.fromEmail,
    }),
  });

  if (!res.ok) return { ok: false as const, reason: "network" as const };
  const data = (await res.json()) as { success?: boolean };
  if (!data.success) return { ok: false as const, reason: "network" as const };
  return { ok: true as const };
}
