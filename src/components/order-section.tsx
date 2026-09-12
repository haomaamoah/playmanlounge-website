"use client";

import { useEffect, useId, useRef, useState } from "react";
import { formatGhs, site } from "@/lib/content";
import { useOrder } from "@/lib/order-context";
import {
  businessEmail,
  formatOrderBody,
  formatOrderSubject,
  formatPaymentLine,
  mailtoHref,
  type Fulfilment,
  type OrderPayload,
  type PaymentInfo,
} from "@/lib/email";
import {
  clearPendingOrder,
  readPendingOrder,
  rememberPendingOrder,
  restoreOrder,
} from "@/lib/pending-order";
import {
  guessNetwork,
  isValidMomoNumber,
  momoNetworks,
  type MomoNetwork,
} from "@/lib/payments/networks";
import {
  loadPaymentConfig,
  readCheckoutReturn,
  startPayment,
  stripCheckoutParams,
  waitForPayment,
  PaymentError,
} from "@/lib/payments/client";

type PayMethod = "delivery" | "momo";

type FieldErrors = Partial<
  Record<
    | "name"
    | "phone"
    | "email"
    | "fulfilment"
    | "preferredTime"
    | "cart"
    | "notes"
    | "momoNumber"
    | "momoNetwork",
    string
  >
>;

type SendResult =
  | { ok: true; via: "email" | "mailto" | "mock"; orderRef?: string; body: string }
  | { ok: false; errors?: FieldErrors; message?: string };

type Status =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "starting" }
  | { kind: "awaiting"; reference: string; message: string }
  | { kind: "redirecting" }
  | { kind: "verifying" }
  | {
      kind: "success";
      summary: string;
      via: "email" | "mailto" | "mock";
      orderRef?: string;
      payment: PaymentInfo;
      total: number;
    }
  | { kind: "payment-failed"; message: string; reference?: string; gatewayIssue: boolean }
  | { kind: "error"; message: string };

function validate(
  order: OrderPayload,
  payment: { method: PayMethod; momoNumber: string; momoNetwork: MomoNetwork | "" }
): FieldErrors {
  const errors: FieldErrors = {};
  if (!order.name.trim()) errors.name = "Enter your name.";
  const phone = order.phone.replace(/\s/g, "");
  if (!phone) errors.phone = "Enter a phone number we can call.";
  else if (!/^\+?[0-9]{9,15}$/.test(phone))
    errors.phone = "Use a number with country code, like +233547539942.";
  if (!order.email.trim()) errors.email = "Enter your email.";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(order.email))
    errors.email = "Enter an email we can reply to.";
  if (!order.fulfilment) errors.fulfilment = "Choose delivery or arranged pickup.";
  if (!order.preferredTime) errors.preferredTime = "Choose a time between 12:00 and 23:00.";
  if (order.lines.length === 0) errors.cart = "Add at least one menu item.";
  if (payment.method === "momo") {
    if (!payment.momoNumber.trim())
      errors.momoNumber = "Enter the mobile money number to charge.";
    else if (!isValidMomoNumber(payment.momoNumber))
      errors.momoNumber = "Use ten digits, like 0205786433.";
    if (!payment.momoNetwork) errors.momoNetwork = "Choose the mobile money network.";
  }
  return errors;
}

function successHeadline(via: "email" | "mailto" | "mock", payment: PaymentInfo) {
  if (via === "mailto") {
    return "Your mail app should open with the order filled in. Send it to complete.";
  }
  if (via === "mock") return "Order in — preview mode, so nothing was emailed.";
  if (payment.method === "momo") return "Payment received. The kitchen has your ticket.";
  return "Order in. Receipt on its way to your inbox.";
}

export function OrderSection() {
  const { lines, total, setQty, remove, restore, clear } = useOrder();
  const formId = useId();
  const summaryRef = useRef<HTMLDivElement>(null);
  const statusRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<AbortController | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [fulfilment, setFulfilment] = useState<Fulfilment>("delivery");
  const [preferredTime, setPreferredTime] = useState("13:00");
  const [notes, setNotes] = useState("");
  /** Honeypot: a real customer never sees this, so anything in it is a bot. */
  const [company, setCompany] = useState("");
  const [payMethod, setPayMethod] = useState<PayMethod>("delivery");
  const [momoNumber, setMomoNumber] = useState("");
  const [momoNetwork, setMomoNetwork] = useState<MomoNetwork | "">("");
  const [voucherCode, setVoucherCode] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [canPayOnline, setCanPayOnline] = useState(false);

  useEffect(() => {
    void (async () => {
      setCanPayOnline(await loadPaymentConfig());
    })();
  }, []);

  /**
   * The server rebuilds the prices, checks the payment with PaySwitch and sends
   * both receipts. If it cannot be reached at all, the order is handed to the
   * customer's mail app so it is never simply lost.
   */
  async function sendOrder(payload: OrderPayload): Promise<SendResult> {
    const body = formatOrderBody(payload);
    const handToMailApp = (): SendResult => {
      window.location.href = mailtoHref(businessEmail(), formatOrderSubject(payload), body);
      return { ok: true, via: "mailto", body };
    };

    let response: Response;
    try {
      response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: payload.name,
          phone: payload.phone,
          email: payload.email,
          fulfilment: payload.fulfilment,
          preferredTime: payload.preferredTime,
          notes: payload.notes,
          lines: payload.lines.map((line) => ({ id: line.item.id, qty: line.qty })),
          payment: payload.payment,
          company,
        }),
      });
    } catch {
      return handToMailApp();
    }

    let data: {
      ok?: boolean;
      via?: "brevo" | "resend" | "mock";
      orderRef?: string;
      error?: string;
      errors?: FieldErrors;
    } = {};
    try {
      data = await response.json();
    } catch {
      // A non-JSON answer is handled by the status checks below.
    }

    if (response.ok && data.ok) {
      return {
        ok: true,
        via: data.via === "mock" ? "mock" : "email",
        orderRef: data.orderRef,
        body,
      };
    }
    if (response.status === 400 && data.errors) return { ok: false, errors: data.errors };
    // Mail is misconfigured or the provider is down: the order still leaves.
    if (response.status === 502 || response.status === 503) return handToMailApp();
    return {
      ok: false,
      message: data.error ?? "The order did not send. Call us or try again.",
    };
  }

  /**
   * PaySwitch sends the customer back here after hosted checkout. The gateway
   * answers "transaction not found" until the debit lands, so the status is
   * polled for a short while rather than read once.
   */
  useEffect(() => {
    void (async () => {
      const returned = readCheckoutReturn(window.location.search);
      if (!returned) return;
      stripCheckoutParams();
      const pending = readPendingOrder();
      setStatus({ kind: "verifying" });

      const settled = await waitForPayment(returned.transactionId, {
        intervalMs: 4000,
        timeoutMs: 45_000,
      });

      const payment: PaymentInfo = {
        method: "momo",
        state: settled.state,
        reference: settled.transactionId,
        network: pending?.network,
        momoNumber: pending?.momoNumber,
      };

      // Anything short of a confirmed payment keeps the order in the customer's
      // hands: the bag comes back so they can retry or pay the rider.
      if (settled.state !== "paid") {
        if (pending) restore(pending.lines);
        setStatus({
          kind: "payment-failed",
          message: settled.message,
          reference: settled.transactionId,
          gatewayIssue: settled.gatewayIssue,
        });
        return;
      }

      if (!pending) {
        setStatus({
          kind: "payment-failed",
          message:
            "The payment went through, but this browser lost the order details. Call the kitchen with your reference and we will take the order by phone.",
          reference: settled.transactionId,
          gatewayIssue: false,
        });
        return;
      }

      const payload = restoreOrder(pending, payment);
      const sent = await sendOrder(payload);
      if (!sent.ok) {
        setStatus({
          kind: "error",
          message:
            "The payment went through but the order did not reach the kitchen. Call us with your reference and we will still cook it.",
        });
        return;
      }

      clearPendingOrder();
      clear();
      setStatus({
        kind: "success",
        summary: sent.body,
        via: sent.via,
        orderRef: sent.orderRef,
        payment,
        total: payload.total,
      });
    })();
    // Runs once, for the redirect it arrived on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Move focus to whatever the form is now saying, so the payment steps are
  // announced instead of silently appearing above the fields.
  useEffect(() => {
    if (status.kind === "idle" || status.kind === "sending") return;
    statusRef.current?.focus();
  }, [status.kind]);

  useEffect(() => () => pollRef.current?.abort(), []);

  function currentPayload(payment: PaymentInfo): OrderPayload {
    return {
      name,
      phone,
      email,
      fulfilment,
      preferredTime,
      notes,
      lines,
      total,
      payment,
    };
  }

  async function finishPaidOrder(payment: PaymentInfo) {
    const payload = currentPayload(payment);
    const sent = await sendOrder(payload);
    if (!sent.ok) {
      setStatus({
        kind: "error",
        message:
          "Payment went through but the order did not reach the kitchen. Call us and we will still cook it.",
      });
      return;
    }

    clear();
    setStatus({
      kind: "success",
      summary: sent.body,
      via: sent.via,
      orderRef: sent.orderRef,
      payment,
      total: payload.total,
    });
  }

  async function payWithMomo(payload: OrderPayload, network: MomoNetwork) {
    setStatus({ kind: "starting" });

    let started;
    try {
      started = await startPayment({
        name,
        phone,
        email,
        fulfilment,
        preferredTime,
        notes,
        lines: payload.lines.map((line) => ({ id: line.item.id, qty: line.qty })),
        expectedTotal: payload.total,
        network,
        momoNumber,
        voucherCode: voucherCode.trim() || undefined,
      });
    } catch (error) {
      setStatus({
        kind: "payment-failed",
        message:
          error instanceof PaymentError
            ? error.message
            : "The payment could not be started. Try again, or choose pay on delivery.",
        gatewayIssue: error instanceof PaymentError ? error.gatewayIssue : false,
      });
      return;
    }

    if (started.mode === "checkout") {
      rememberPendingOrder({
        transactionId: started.transactionId,
        savedAt: Date.now(),
        total: payload.total,
        network,
        momoNumber,
        customer: { name, phone, email, fulfilment, preferredTime, notes },
        lines: payload.lines.map((line) => ({ id: line.item.id, qty: line.qty })),
      });
      setStatus({ kind: "redirecting" });
      window.location.assign(started.checkoutUrl);
      return;
    }

    const payment = (state: "paid" | "pending" | "failed"): PaymentInfo => ({
      method: "momo",
      state,
      reference: started.transactionId,
      network,
      momoNumber,
    });

    if (started.state === "paid") {
      await finishPaidOrder(payment("paid"));
      return;
    }
    if (started.state === "failed") {
      setStatus({
        kind: "payment-failed",
        message: started.message,
        reference: started.transactionId,
        gatewayIssue: started.gatewayIssue,
      });
      return;
    }

    setStatus({
      kind: "awaiting",
      reference: started.transactionId,
      message: started.message,
    });

    pollRef.current?.abort();
    const controller = new AbortController();
    pollRef.current = controller;
    const settled = await waitForPayment(started.transactionId, {
      signal: controller.signal,
      onUpdate: (update) =>
        setStatus({
          kind: "awaiting",
          reference: update.transactionId,
          message: update.message,
        }),
    });
    if (controller.signal.aborted) return;

    if (settled.state === "paid") {
      await finishPaidOrder(payment("paid"));
      return;
    }
    setStatus({
      kind: "payment-failed",
      message: settled.message,
      reference: settled.transactionId,
      gatewayIssue: settled.gatewayIssue,
    });
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const payment: PaymentInfo =
      payMethod === "delivery"
        ? { method: "delivery" }
        : { method: "momo", state: "pending", reference: "", network: momoNetwork || undefined };
    const payload = currentPayload(payment);

    const nextErrors = validate(payload, { method: payMethod, momoNumber, momoNetwork });
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      setStatus({ kind: "idle" });
      requestAnimationFrame(() => summaryRef.current?.focus());
      return;
    }

    if (payMethod === "momo" && momoNetwork) {
      await payWithMomo(payload, momoNetwork);
      return;
    }

    setStatus({ kind: "sending" });
    const sent = await sendOrder(payload);
    if (!sent.ok) {
      if (sent.errors) {
        setErrors(sent.errors);
        setStatus({ kind: "idle" });
        requestAnimationFrame(() => summaryRef.current?.focus());
        return;
      }
      setStatus({
        kind: "error",
        message: sent.message ?? "The order did not send. Call us or try again.",
      });
      return;
    }

    if (sent.via !== "mailto") clear();
    setStatus({
      kind: "success",
      summary: sent.body,
      via: sent.via,
      orderRef: sent.orderRef,
      payment,
      total: payload.total,
    });
  }

  function onMomoNumberChange(value: string) {
    setMomoNumber(value);
    const guess = guessNetwork(value);
    if (guess) setMomoNetwork(guess);
  }

  function switchToPayOnDelivery() {
    pollRef.current?.abort();
    setPayMethod("delivery");
    setStatus({ kind: "idle" });
  }

  const field = (id: string) => `${formId}-${id}`;
  const busy =
    status.kind === "sending" ||
    status.kind === "starting" ||
    status.kind === "awaiting" ||
    status.kind === "redirecting" ||
    status.kind === "verifying";

  function submitLabel() {
    if (status.kind === "starting") return "Starting payment…";
    if (status.kind === "awaiting") return "Waiting for your approval…";
    if (status.kind === "redirecting") return "Opening secure payment…";
    if (status.kind === "verifying") return "Confirming payment…";
    if (status.kind === "sending") return "Sending order…";
    if (payMethod === "momo") return `Pay ${formatGhs(total)} now`;
    return "Email this order";
  }

  return (
    <section id="order" aria-labelledby="order-heading" className="bg-card py-16 sm:py-24">
      <div className="mx-auto grid max-w-6xl gap-12 px-4 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div>
          <h2 id="order-heading" className="font-display text-4xl sm:text-5xl">
            Make an Order
          </h2>
          <p className="mt-3 max-w-md text-base leading-relaxed">
            Pay on delivery, or pay now with mobile money and we start cooking
            straight away. Either way you get a pictured receipt and the kitchen
            gets the same ticket ({businessEmail()}). If anything sticks, call{" "}
            <a className="underline" href={`tel:${site.phoneTel}`}>
              {site.phoneDisplay}
            </a>
            .
          </p>
          <div className="border-cocoa mt-8 border-t-2 pt-4">
            <h3 className="font-display text-2xl">Your bag</h3>
            {lines.length === 0 ? (
              <p className="text-muted-foreground mt-3 text-sm">
                Nothing in the bag yet. Add plates from the menu, then come back
                here.
              </p>
            ) : (
              <ul className="mt-4 divide-border divide-y">
                {lines.map((line) => (
                  <li
                    key={line.item.id}
                    className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="font-medium">{line.item.name}</p>
                      <p className="text-muted-foreground text-sm">
                        {formatGhs(line.item.price)} each
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="sr-only" htmlFor={`qty-${line.item.id}`}>
                        Quantity of {line.item.name}
                      </label>
                      <input
                        id={`qty-${line.item.id}`}
                        type="number"
                        min={0}
                        value={line.qty}
                        onChange={(e) =>
                          setQty(line.item.id, Number(e.target.value))
                        }
                        className="border-border min-h-11 w-16 border bg-surface px-2 text-center"
                      />
                      <button
                        type="button"
                        className="min-h-11 px-2 text-sm underline"
                        onClick={() => remove(line.item.id)}
                      >
                        Remove
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <p className="font-display mt-4 text-3xl">
              Total {formatGhs(total)}
            </p>
          </div>
        </div>

        <form onSubmit={onSubmit} noValidate className="bg-surface p-5 sm:p-8">
          {Object.keys(errors).length > 0 && (
            <div
              ref={summaryRef}
              tabIndex={-1}
              role="alert"
              className="border-destructive text-destructive mb-6 border p-4"
            >
              <p className="font-semibold">There is a problem</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                {Object.entries(errors).map(([key, message]) => (
                  <li key={key}>
                    <a className="underline" href={`#${field(key)}`}>
                      {message}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {(status.kind === "starting" ||
            status.kind === "redirecting" ||
            status.kind === "verifying" ||
            status.kind === "awaiting") && (
            <div
              ref={statusRef}
              tabIndex={-1}
              role="status"
              aria-live="polite"
              className="border-cocoa mb-6 border p-4"
            >
              <p className="font-semibold motion-safe:animate-pulse">
                {status.kind === "starting" && "Asking mobile money for your payment…"}
                {status.kind === "redirecting" && "Opening the secure payment page…"}
                {status.kind === "verifying" && "Confirming your payment…"}
                {status.kind === "awaiting" && "Check your phone"}
              </p>
              {status.kind === "awaiting" && (
                <>
                  <p className="mt-2 text-sm leading-relaxed">
                    {status.message} We are watching for {formatGhs(total)} on{" "}
                    {momoNumber}. Keep this page open.
                  </p>
                  <p className="text-muted-foreground mt-2 text-sm">
                    Reference {status.reference}
                  </p>
                  <button
                    type="button"
                    onClick={switchToPayOnDelivery}
                    className="mt-3 min-h-11 text-sm underline"
                  >
                    Stop waiting and pay on delivery instead
                  </button>
                </>
              )}
            </div>
          )}

          {status.kind === "payment-failed" && (
            <div
              ref={statusRef}
              tabIndex={-1}
              role="alert"
              className="border-destructive text-destructive mb-6 border p-4"
            >
              <p className="font-semibold">Payment not completed</p>
              <p className="mt-2 text-sm leading-relaxed">{status.message}</p>
              {status.reference && (
                <p className="mt-2 text-sm">Reference {status.reference}</p>
              )}
              <div className="mt-3 flex flex-wrap gap-4">
                <button
                  type="button"
                  onClick={switchToPayOnDelivery}
                  className="min-h-11 text-sm underline"
                >
                  Pay on delivery instead
                </button>
                <a className="min-h-11 text-sm underline" href={`tel:${site.phoneTel}`}>
                  Call {site.phoneDisplay}
                </a>
              </div>
            </div>
          )}

          {status.kind === "error" && (
            <div
              ref={statusRef}
              tabIndex={-1}
              role="alert"
              className="border-destructive text-destructive mb-6 border p-4"
            >
              {status.message}{" "}
              <a className="underline" href={`tel:${site.phoneTel}`}>
                {site.phoneDisplay}
              </a>
            </div>
          )}

          {status.kind === "success" && (
            <div
              ref={statusRef}
              tabIndex={-1}
              className="border-cocoa mb-6 border p-4"
              role="status"
            >
              <p className="font-semibold">{successHeadline(status.via, status.payment)}</p>
              {status.via === "email" && (
                <p className="mt-2 text-sm leading-relaxed">
                  Receipt {status.orderRef} is in your inbox, and the kitchen has
                  the same ticket.
                </p>
              )}
              {status.via === "mock" && (
                <p className="mt-2 text-sm leading-relaxed">
                  Ticket {status.orderRef} was saved on this machine instead.
                </p>
              )}
              <p className="mt-2 text-sm leading-relaxed">
                {formatPaymentLine(status.payment, status.total)}
              </p>
              {status.payment.method === "momo" && status.via === "mailto" && (
                <p className="mt-2 text-sm leading-relaxed">
                  Your mail app is opening with the paid order — send it so the
                  kitchen has your address and time.
                </p>
              )}
              <pre className="mt-3 max-h-48 overflow-auto text-xs whitespace-pre-wrap">
                {status.summary}
              </pre>
            </div>
          )}

          <div className="space-y-5">
            <div aria-hidden="true" className="hidden">
              <label htmlFor={field("company")}>Company</label>
              <input
                id={field("company")}
                name="company"
                tabIndex={-1}
                autoComplete="off"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor={field("name")} className="mb-1 block text-sm font-medium">
                Name
              </label>
              <input
                id={field("name")}
                name="name"
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                aria-invalid={!!errors.name}
                aria-describedby={errors.name ? `${field("name")}-error` : undefined}
                className="border-input min-h-11 w-full border bg-background px-3"
              />
              {errors.name && (
                <p id={`${field("name")}-error`} className="text-destructive mt-1 text-sm">
                  {errors.name}
                </p>
              )}
            </div>
            <div>
              <label htmlFor={field("phone")} className="mb-1 block text-sm font-medium">
                Phone number
              </label>
              <input
                id={field("phone")}
                name="phone"
                type="tel"
                autoComplete="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                aria-invalid={!!errors.phone}
                aria-describedby={errors.phone ? `${field("phone")}-error` : undefined}
                className="border-input min-h-11 w-full border bg-background px-3"
              />
              {errors.phone && (
                <p id={`${field("phone")}-error`} className="text-destructive mt-1 text-sm">
                  {errors.phone}
                </p>
              )}
            </div>
            <div>
              <label htmlFor={field("email")} className="mb-1 block text-sm font-medium">
                Email
              </label>
              <input
                id={field("email")}
                name="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-invalid={!!errors.email}
                aria-describedby={errors.email ? `${field("email")}-error` : undefined}
                className="border-input min-h-11 w-full border bg-background px-3"
              />
              {errors.email && (
                <p id={`${field("email")}-error`} className="text-destructive mt-1 text-sm">
                  {errors.email}
                </p>
              )}
            </div>
            <fieldset id={field("fulfilment")}>
              <legend className="mb-2 text-sm font-medium">Delivery or arranged pickup</legend>
              <div className="flex flex-col gap-2 sm:flex-row sm:gap-6">
                <label className="inline-flex min-h-11 items-center gap-2">
                  <input
                    type="radio"
                    name="fulfilment"
                    value="delivery"
                    checked={fulfilment === "delivery"}
                    onChange={() => setFulfilment("delivery")}
                  />
                  Delivery
                </label>
                <label className="inline-flex min-h-11 items-center gap-2">
                  <input
                    type="radio"
                    name="fulfilment"
                    value="pickup"
                    checked={fulfilment === "pickup"}
                    onChange={() => setFulfilment("pickup")}
                  />
                  Arranged pickup at the hub
                </label>
              </div>
              <p className="text-muted-foreground mt-2 text-sm">
                Pickup is by arrangement only. The hub is not open to the public
                without a booking.
              </p>
              {errors.fulfilment && (
                <p className="text-destructive mt-1 text-sm">{errors.fulfilment}</p>
              )}
            </fieldset>

            <fieldset className="border-border border-t pt-5">
              <legend className="mb-2 text-sm font-medium">Payment</legend>
              <div className="flex flex-col gap-2">
                <label className="inline-flex min-h-11 items-center gap-2">
                  <input
                    type="radio"
                    name="payMethod"
                    value="delivery"
                    checked={payMethod === "delivery"}
                    onChange={() => setPayMethod("delivery")}
                  />
                  Pay on delivery
                </label>
                <label className="inline-flex min-h-11 items-center gap-2">
                  <input
                    type="radio"
                    name="payMethod"
                    value="momo"
                    checked={payMethod === "momo"}
                    disabled={!canPayOnline}
                    onChange={() => setPayMethod("momo")}
                  />
                  Pay now with mobile money
                </label>
              </div>
              <p className="text-muted-foreground mt-2 text-sm">
                {canPayOnline
                  ? "Paying now puts your order straight into the queue. Pay on delivery means you settle the rider."
                  : "Paying online is being switched on. For now, choose pay on delivery and we will confirm by phone."}
              </p>
            </fieldset>

            {payMethod === "momo" && canPayOnline && (
              <div className="space-y-5">
                <div>
                  <label
                    htmlFor={field("momoNumber")}
                    className="mb-1 block text-sm font-medium"
                  >
                    Mobile money number
                  </label>
                  <input
                    id={field("momoNumber")}
                    name="momoNumber"
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel-national"
                    placeholder="0205786433"
                    value={momoNumber}
                    onChange={(e) => onMomoNumberChange(e.target.value)}
                    aria-invalid={!!errors.momoNumber}
                    aria-describedby={
                      errors.momoNumber
                        ? `${field("momoNumber")}-error`
                        : `${field("momoNumber")}-hint`
                    }
                    className="border-input min-h-11 w-full border bg-background px-3"
                  />
                  <p
                    id={`${field("momoNumber")}-hint`}
                    className="text-muted-foreground mt-1 text-sm"
                  >
                    The wallet we should charge {formatGhs(total)} from. It can
                    differ from your phone number above.
                  </p>
                  {errors.momoNumber && (
                    <p
                      id={`${field("momoNumber")}-error`}
                      className="text-destructive mt-1 text-sm"
                    >
                      {errors.momoNumber}
                    </p>
                  )}
                </div>
                <div>
                  <label
                    htmlFor={field("momoNetwork")}
                    className="mb-1 block text-sm font-medium"
                  >
                    Mobile money network
                  </label>
                  <select
                    id={field("momoNetwork")}
                    name="momoNetwork"
                    value={momoNetwork}
                    onChange={(e) => setMomoNetwork(e.target.value as MomoNetwork | "")}
                    aria-invalid={!!errors.momoNetwork}
                    aria-describedby={
                      errors.momoNetwork ? `${field("momoNetwork")}-error` : undefined
                    }
                    className="border-input min-h-11 w-full border bg-background px-3"
                  >
                    <option value="">Choose a network</option>
                    {momoNetworks.map((network) => (
                      <option key={network.code} value={network.code}>
                        {network.label}
                      </option>
                    ))}
                  </select>
                  {errors.momoNetwork && (
                    <p
                      id={`${field("momoNetwork")}-error`}
                      className="text-destructive mt-1 text-sm"
                    >
                      {errors.momoNetwork}
                    </p>
                  )}
                </div>
                {momoNetwork === "VDF" && (
                  <div>
                    <label
                      htmlFor={field("voucherCode")}
                      className="mb-1 block text-sm font-medium"
                    >
                      Telecel Cash approval code (if your wallet asks for one)
                    </label>
                    <input
                      id={field("voucherCode")}
                      name="voucherCode"
                      inputMode="numeric"
                      value={voucherCode}
                      onChange={(e) => setVoucherCode(e.target.value)}
                      className="border-input min-h-11 w-full border bg-background px-3"
                    />
                    <p className="text-muted-foreground mt-1 text-sm">
                      Dial *110# on the Telecel line to generate it. Leave it
                      blank if you are not asked.
                    </p>
                  </div>
                )}
              </div>
            )}

            <div>
              <label
                htmlFor={field("preferredTime")}
                className="mb-1 block text-sm font-medium"
              >
                Preferred time
              </label>
              <input
                id={field("preferredTime")}
                name="preferredTime"
                type="time"
                min="12:00"
                max="23:00"
                value={preferredTime}
                onChange={(e) => setPreferredTime(e.target.value)}
                aria-invalid={!!errors.preferredTime}
                aria-describedby={
                  errors.preferredTime
                    ? `${field("preferredTime")}-error`
                    : `${field("preferredTime")}-hint`
                }
                className="border-input min-h-11 w-full border bg-background px-3"
              />
              <p id={`${field("preferredTime")}-hint`} className="text-muted-foreground mt-1 text-sm">
                Kitchen order window is noon to 11:00 PM.
              </p>
              {errors.preferredTime && (
                <p
                  id={`${field("preferredTime")}-error`}
                  className="text-destructive mt-1 text-sm"
                >
                  {errors.preferredTime}
                </p>
              )}
            </div>
            <div>
              <label htmlFor={field("notes")} className="mb-1 block text-sm font-medium">
                Notes
              </label>
              <textarea
                id={field("notes")}
                name="notes"
                rows={4}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Spice level, allergies, a landmark if we should deliver"
                className="border-input min-h-24 w-full border bg-background px-3 py-2"
              />
            </div>
            {errors.cart && (
              <p id={field("cart")} className="text-destructive text-sm">
                {errors.cart}
              </p>
            )}
            <button
              type="submit"
              disabled={busy}
              className="bg-cocoa text-cream hover:bg-cocoa-deep inline-flex min-h-12 w-full items-center justify-center px-6 text-base font-semibold disabled:opacity-60"
            >
              {submitLabel()}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
