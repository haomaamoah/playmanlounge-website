import "server-only";
import { site } from "../content";
import { siteUrl } from "../mail/config";
import { supersedePayment, updatePayment } from "../db/orders";
import { nextAfterCharge } from "../payments/fallback";
import {
  chargeMomo,
  fetchStatus,
  gatewayConfig,
  initiateCheckout,
  isConfigured,
  newTransactionId,
  type PaymentResult,
} from "../payments/theteller";
import type { MomoNetwork } from "../payments/networks";
import { MobileFailure } from "./errors";

type Row = Record<string, unknown>;

/** What the app is told about a payment. Gateway references never leave the server. */
export type MobilePaymentView = {
  state: "cod" | "pending" | "paid" | "failed";
  message: string;
  /** Present when PaySwitch wants the customer to finish on its hosted page instead of a wallet prompt. */
  checkoutUrl?: string;
};

export function mobileMoneyEnabled() {
  return isConfigured(gatewayConfig());
}

export function requireMobileMoney() {
  if (!mobileMoneyEnabled()) {
    throw new MobileFailure(503, "Mobile money is not available right now. Choose pay on delivery.", { code: "payment_unavailable" });
  }
}

export function paymentView(row: Row, message = ""): MobilePaymentView {
  const status = String(row.payment_status);
  const state = status === "paid" || status === "failed" || status === "cod" ? status : "pending";
  return { state, message: message || defaultMessage(state) };
}

function defaultMessage(state: MobilePaymentView["state"]) {
  switch (state) {
    case "paid": return "Payment received.";
    case "failed": return "The payment did not go through.";
    case "cod": return "Pay when your order arrives.";
    default: return "Approve the mobile money prompt on your phone.";
  }
}

/** PaySwitch refuses a return address it cannot reach, so only a public https origin is used. */
function publicReturnUrl() {
  try {
    const url = new URL(siteUrl());
    const local = url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname.endsWith(".local");
    return url.protocol === "https:" && !local ? `${url.origin}/` : null;
  } catch {
    return null;
  }
}

/**
 * Sends the wallet prompt for the order's current attempt (`row.transaction_id`). A timeout leaves the attempt
 * pending (the prompt may still arrive) so no second charge is opened; a definitive merchant refusal on the
 * "auto" flow moves the same order to hosted checkout, exactly like the website.
 */
export async function chargeOrder(row: Row, wallet: { network: MomoNetwork; momoNumber: string }): Promise<MobilePaymentView> {
  const config = gatewayConfig();
  const transactionId = String(row.transaction_id);
  const total = Number(row.total);
  const description = `${site.name} order ${String(row.order_ref)}`;

  let outcome: { result: PaymentResult } | { error: unknown };
  try {
    outcome = { result: await chargeMomo(config, { transactionId, total, network: wallet.network, subscriberNumber: wallet.momoNumber, description }) };
  } catch (error) {
    outcome = { error };
  }

  const next = nextAfterCharge(config.flow, outcome);
  if (next === "await") {
    return { state: "pending", message: "Mobile money did not answer in time. Check your phone to approve the payment." };
  }
  if (next === "unreachable" || !("result" in outcome)) {
    return { state: "pending", message: "Mobile money could not be reached. Check your phone before trying again, or call the kitchen." };
  }

  if (next === "checkout") {
    const redirectUrl = publicReturnUrl();
    if (!redirectUrl) {
      await updatePayment(transactionId, "failed");
      return { state: "failed", message: "Mobile money is not available right now. Choose pay on delivery." };
    }
    const checkoutId = newTransactionId();
    await supersedePayment(transactionId, checkoutId);
    const started = await initiateCheckout(config, { transactionId: checkoutId, total, description, email: String(row.customer_email), redirectUrl });
    if ("error" in started) {
      await updatePayment(checkoutId, "failed");
      return { state: "failed", message: "Mobile money is not switched on for this business yet. Choose pay on delivery, or call the kitchen." };
    }
    return { state: "pending", message: "Finish paying on the secure PaySwitch page.", checkoutUrl: started.checkoutUrl };
  }

  const result = outcome.result;
  // A direct refusal is definitive even when it is the merchant account's fault, so the order can be retried or
  // switched to pay on delivery instead of sitting in "pending" for ever.
  if (result.state === "failed") await updatePayment(transactionId, "failed");
  else await updatePayment(transactionId, result.state, result.gatewayIssue);
  return { state: result.state, message: result.message };
}

/** Asks PaySwitch about a pending attempt. Gateway hiccups keep it pending rather than inventing a failure. */
export async function checkPayment(row: Row): Promise<string> {
  const config = gatewayConfig();
  const transactionId = row.transaction_id ? String(row.transaction_id) : "";
  if (row.payment_status !== "pending" || !transactionId || !isConfigured(config)) return "";
  try {
    const result = await fetchStatus(config, transactionId);
    await updatePayment(transactionId, result.state, result.gatewayIssue);
    return result.gatewayIssue ? "Still waiting for mobile money to confirm the payment." : result.message;
  } catch {
    return "Could not read the payment status. Try again in a moment.";
  }
}

export { newTransactionId, supersedePayment, updatePayment };
