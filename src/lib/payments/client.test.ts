import assert from "node:assert/strict";
import { test } from "node:test";
import { PaymentError, startPayment, waitForPayment, type StartPaymentInput } from "./client";

const input: StartPaymentInput = {
  name: "Test customer",
  phone: "0241234567",
  email: "customer@example.com",
  fulfilment: "delivery",
  preferredTime: "13:00",
  notes: "Delivery area: Kaneshie",
  lines: [{ id: "fried-rice", qty: 1 }],
  expectedTotal: 35,
  acceptedTerms: true,
  network: "MTN",
  momoNumber: "0241234567",
  customerPortal: true,
};

test("customer payment start sends the account, basket, wallet and portal return flag", async (t) => {
  t.mock.method(globalThis, "fetch", async (url: string, options: RequestInit) => {
    assert.equal(url, "/api/payments/start");
    assert.equal(options.method, "POST");
    assert.deepEqual(JSON.parse(String(options.body)), input);
    return Response.json({ mode: "checkout", total: 35, transactionId: "123456789012", checkoutUrl: "https://checkout.theteller.net/test" });
  });
  const result = await startPayment(input);
  assert.equal(result.mode, "checkout");
  assert.equal(result.transactionId, "123456789012");
});

test("an ambiguous start error preserves its transaction reference for status checks", async (t) => {
  t.mock.method(globalThis, "fetch", async () => Response.json({
    error: "Check your wallet.",
    transactionId: "123456789012",
    retryable: false,
  }, { status: 502 }));
  await assert.rejects(startPayment(input), (error: unknown) => {
    assert.ok(error instanceof PaymentError);
    assert.equal(error.transactionId, "123456789012");
    assert.equal(error.retryable, false);
    return true;
  });
});

test("a dropped payment-start connection must not invite another charge", async (t) => {
  t.mock.method(globalThis, "fetch", async () => { throw new Error("Disconnected"); });
  await assert.rejects(startPayment(input), (error: unknown) => {
    assert.ok(error instanceof PaymentError);
    assert.equal(error.retryable, false);
    assert.match(error.message, /before trying again/);
    return true;
  });
});

test("status polling checks the existing reference and returns confirmed payment", async (t) => {
  t.mock.method(globalThis, "fetch", async (url: string) => {
    assert.equal(url, "/api/payments/status/123456789012");
    return Response.json({
      transactionId: "123456789012", state: "paid", code: "000",
      message: "Payment received.", retryable: false, gatewayIssue: false,
    });
  });
  const result = await waitForPayment("123456789012", { intervalMs: 0, timeoutMs: 1000 });
  assert.equal(result.state, "paid");
});

test("transaction-not-found is not treated as a wallet refusal during polling", async (t) => {
  let checks = 0;
  t.mock.method(globalThis, "fetch", async () => {
    checks++;
    return Response.json({
      transactionId: "123456789012", state: checks === 1 ? "failed" : "paid",
      code: checks === 1 ? "999" : "000", message: "", retryable: false, gatewayIssue: false,
    });
  });
  const result = await waitForPayment("123456789012", { intervalMs: 0, timeoutMs: 1000 });
  assert.equal(result.state, "paid");
  assert.equal(checks, 2);
});

test("cancelled polling does not contact the gateway or report payment success", async (t) => {
  t.mock.method(globalThis, "fetch", async () => { assert.fail("Polling was cancelled"); });
  const controller = new AbortController();
  controller.abort();
  const result = await waitForPayment("123456789012", { signal: controller.signal });
  assert.equal(result.state, "pending");
});
