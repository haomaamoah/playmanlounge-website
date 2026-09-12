import type { PaymentInfo } from "@/lib/email";
import { isMomoNetwork, type MomoNetwork } from "@/lib/payments/networks";
import { fetchStatus, gatewayConfig, isConfigured, isTransactionId } from "@/lib/payments/theteller";

/** What the browser claims about payment. Never trusted for the paid state. */
export type PaymentRequest =
  | { method: "delivery" }
  | { method: "momo"; reference: string; network?: MomoNetwork; momoNumber?: string };

export function readPaymentRequest(raw: unknown): PaymentRequest {
  if (!raw || typeof raw !== "object") return { method: "delivery" };
  const body = (raw as Record<string, unknown>).payment;
  if (!body || typeof body !== "object") return { method: "delivery" };
  const payment = body as Record<string, unknown>;
  if (payment.method !== "momo") return { method: "delivery" };
  const reference = typeof payment.reference === "string" ? payment.reference : "";
  const momoNumber = typeof payment.momoNumber === "string" ? payment.momoNumber : undefined;
  return {
    method: "momo",
    reference,
    network: isMomoNetwork(payment.network) ? payment.network : undefined,
    momoNumber,
  };
}

/**
 * Asks PaySwitch what really happened to the reference before the kitchen is
 * told an order is paid. A page could otherwise claim any order was settled.
 */
export async function verifyPayment(request: PaymentRequest): Promise<PaymentInfo> {
  if (request.method === "delivery") return { method: "delivery" };

  const unconfirmed: PaymentInfo = {
    method: "momo",
    state: "pending",
    reference: request.reference,
    network: request.network,
    momoNumber: request.momoNumber,
  };

  const config = gatewayConfig();
  if (!isConfigured(config) || !isTransactionId(request.reference)) return unconfirmed;

  try {
    const result = await fetchStatus(config, request.reference);
    return { ...unconfirmed, state: result.state };
  } catch {
    return unconfirmed;
  }
}
