import assert from "node:assert/strict";
import { test } from "node:test";
import {
  describeCode,
  describeStatus,
  formatAmount,
  gatewayBase,
  checkoutBase,
  isMomoNetwork,
  newTransactionId,
  normaliseSubscriberNumber,
  paymentFlow,
  priceOrder,
} from "./theteller.ts";

test("amounts are sent in pesewas, padded to twelve digits", () => {
  assert.equal(formatAmount(40), "000000004000");
  assert.equal(formatAmount(0.1), "000000000010");
  assert.equal(formatAmount(0.05), "000000000005");
  assert.equal(formatAmount(1234.5), "000000123450");
  assert.throws(() => formatAmount(0));
  assert.throws(() => formatAmount(-5));
});

test("transaction references are twelve digits and do not repeat", () => {
  const reference = newTransactionId();
  assert.match(reference, /^[0-9]{12}$/);
  const many = new Set(Array.from({ length: 200 }, () => newTransactionId()));
  assert.ok(many.size > 190, `expected mostly unique references, got ${many.size}`);
});

test("wallet numbers are normalised to the international form", () => {
  assert.equal(normaliseSubscriberNumber("0547539942"), "233547539942");
  assert.equal(normaliseSubscriberNumber("054 753 9942"), "233547539942");
  assert.equal(normaliseSubscriberNumber("+233 20 578 6433"), "233205786433");
  assert.equal(normaliseSubscriberNumber("205786433"), "233205786433");
  assert.equal(normaliseSubscriberNumber("12345"), null);
  assert.equal(normaliseSubscriberNumber("02057864331234"), null);
});

test("networks are limited to the three Ghanaian wallets", () => {
  assert.ok(isMomoNetwork("MTN"));
  assert.ok(isMomoNetwork("VDF"));
  assert.ok(isMomoNetwork("ATL"));
  assert.equal(isMomoNetwork("TGO"), false);
  assert.equal(isMomoNetwork("bitcoin"), false);
});

test("gateway response codes map to states the form can act on", () => {
  assert.equal(describeCode("000").state, "paid");

  const pending = describeCode("111");
  assert.equal(pending.state, "pending");
  assert.match(pending.message, /prompt/i);

  const noFunds = describeCode("101");
  assert.equal(noFunds.state, "failed");
  assert.equal(noFunds.retryable, true);
  assert.equal(noFunds.gatewayIssue, false);

  // Access denied is our problem, not the customer's: never ask them to retry.
  const denied = describeCode("999", "Access Denied. Merchant not found");
  assert.equal(denied.state, "failed");
  assert.equal(denied.gatewayIssue, true);
  assert.equal(denied.retryable, false);

  const unknown = describeCode("742", "Something new");
  assert.equal(unknown.state, "failed");
  assert.match(unknown.message, /Something new \(code 742\)/);
});

test("status words settle a transaction even without a code", () => {
  assert.equal(describeStatus("approved", ""), "paid");
  assert.equal(describeStatus("", "000"), "paid");
  assert.equal(describeStatus("pending", ""), "pending");
  assert.equal(describeStatus("", "111"), "pending");
  assert.equal(describeStatus("declined", "104"), "failed");
});

test("mode and flow settings pick the right endpoints", () => {
  assert.equal(gatewayBase({}), "https://test.theteller.net");
  assert.equal(gatewayBase({ THETELLER_MODE: "live" }), "https://prod.theteller.net");
  assert.equal(checkoutBase({}), "https://checkout-test.theteller.net");
  assert.equal(checkoutBase({ THETELLER_MODE: "LIVE" }), "https://checkout.theteller.net");
  assert.equal(paymentFlow({}), "auto");
  assert.equal(paymentFlow({ THETELLER_FLOW: "checkout" }), "checkout");
  assert.equal(paymentFlow({ THETELLER_FLOW: "nonsense" }), "auto");
});

test("the order is priced from our own table, not the browser", () => {
  const priced = priceOrder([{ id: "fried-rice", qty: 2 }, { id: "ben-10", qty: 1 }], 5000);
  assert.ok(!("error" in priced));
  assert.equal(priced.total, 95);
  assert.equal(priced.lines[0].name, "Fried rice");
});

test("bad baskets are refused before any money is asked for", () => {
  assert.ok("error" in priceOrder([], 5000));
  assert.ok("error" in priceOrder([{ id: "caviar", qty: 1 }], 5000));
  assert.ok("error" in priceOrder([{ id: "fried-rice", qty: 0 }], 5000));
  assert.ok("error" in priceOrder([{ id: "fried-rice", qty: 51 }], 5000));
  assert.ok("error" in priceOrder([{ id: "fried-rice", qty: 1.5 }], 5000));
  assert.ok("error" in priceOrder([{ id: "jumbo-bite", qty: 50 }], 100));
});
