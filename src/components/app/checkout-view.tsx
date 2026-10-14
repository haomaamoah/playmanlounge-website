"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { formatGhs, pesewas, site, type MenuItem } from "@/lib/content";
import { DELIVERY_AREAS } from "@/lib/mocks/seed";
import { useMockStore } from "@/lib/mocks/store";
import { clearPendingOrder, MAX_PAYMENT_RETRIES, PAYMENT_TIMEOUT_MS, readPendingOrder, rememberPendingOrder, startPaymentAttempt, type PendingOrder } from "@/lib/pending-order";
import { guessNetwork, isValidMomoNumber, momoNetworks, type MomoNetwork } from "@/lib/payments/networks";
import { fetchPaymentStatus, loadPaymentConfig, PaymentError, readCheckoutReturn, startPayment, stripCheckoutParams, waitForPayment, type PaymentUpdate } from "@/lib/payments/client";

type CustomerProfile = { name: string; email: string; phone: string };

type OrderResponse = {
  ok?: boolean;
  orderRef?: string;
  orderId?: string;
  persisted?: boolean;
  error?: string;
  payment?: { method?: string; state?: string };
};

function retryGuidance(retriesUsed: number) {
  const remaining = Math.max(0, MAX_PAYMENT_RETRIES - retriesUsed);
  return remaining === 0
    ? "You’ve used both mobile money retries. Switch to Pay on delivery or contact the kitchen."
    : `You may retry mobile money ${remaining} more ${remaining === 1 ? "time" : "times"}.`;
}

export function CheckoutView() {
  const { bag, clearBag, ready } = useMockStore();
  const [catalog, setCatalog] = useState<MenuItem[] | null>(null);
  const pollRef = useRef<AbortController | null>(null);
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [area, setArea] = useState<string>(DELIVERY_AREAS[0]);
  const [preferredTime, setPreferredTime] = useState("13:00");
  const [notes, setNotes] = useState("");
  const [payMethod, setPayMethod] = useState<"delivery" | "momo">("delivery");
  const [momoNumber, setMomoNumber] = useState("");
  const [network, setNetwork] = useState<MomoNetwork | "">("");
  const [canPayOnline, setCanPayOnline] = useState(false);
  const [paymentMessage, setPaymentMessage] = useState("");
  const [pendingPayment, setPendingPayment] = useState<PendingOrder | null>(null);
  const [paymentReference, setPaymentReference] = useState("");
  const [paymentTimeLeft, setPaymentTimeLeft] = useState(PAYMENT_TIMEOUT_MS);
  const [walletConfirmedUnpaid, setWalletConfirmedUnpaid] = useState(false);
  const [paymentBlocked, setPaymentBlocked] = useState(false);
  const [restoringPayment, setRestoringPayment] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [placedTotal, setPlacedTotal] = useState(0);
  const [busy, setBusy] = useState(false);
  const submission = useRef<{ body: string; key: string } | null>(null);
  const [paymentKind, setPaymentKind] = useState<"delivery" | "momo">("delivery");
  const [switchingToDelivery, setSwitchingToDelivery] = useState(false);

  useEffect(() => {
    void loadPaymentConfig().then(setCanPayOnline);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/menu", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok || data?.ok !== true || !Array.isArray(data.items)) {
          throw new Error(data?.error ?? "The menu could not be loaded. Please try again.");
        }
        return data.items as MenuItem[];
      })
      .then(setCatalog)
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "The menu could not be loaded.");
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/customer/profile", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const data = await response.json().catch(() => null);
        if (!response.ok || data?.ok !== true) {
          throw new Error(data?.error ?? "Your account details could not be loaded.");
        }
        return data.profile as CustomerProfile;
      })
      .then((customer) => {
        if (controller.signal.aborted) return;
        setProfile(customer);
        setName(customer.name);
        setPhone(customer.phone);
      })
      .catch((reason: Error) => {
        if (!controller.signal.aborted) setError(reason.message);
      });
    return () => controller.abort();
  }, []);

  const lines = bag.map((line) => ({
    id: line.itemId,
    qty: line.qty,
    item: catalog?.find((item) => item.id === line.itemId),
  }));
  const bagTotal = pesewas(lines.reduce((sum, line) => sum + (line.item?.price ?? 0) * line.qty, 0)) / 100;

  async function finishPaidOrder(order: PendingOrder, reference: string) {
    const body = JSON.stringify({
      ...order.customer,
      lines: order.lines,
      payment: {
        method: "momo",
        reference,
        network: order.network,
        momoNumber: order.momoNumber,
      },
      acceptedTerms: true,
    });
    const response = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
    const data = await response.json().catch(() => null) as OrderResponse | null;
    if ((!response.ok || data?.ok !== true) && data?.persisted !== true) {
      setPendingPayment(order);
      setPaymentReference(reference);
      setPaymentMessage("Payment was confirmed, but the order could not be finalized. Contact the kitchen and provide your payment reference; do not pay again.");
      throw new Error(data?.error ?? "Your payment was received, but your order could not be finalized.");
    }
    if (data?.payment?.method !== "momo" || data.payment.state !== "paid") {
      setPendingPayment(order);
      setPaymentReference(reference);
      setPaymentMessage("The payment is not confirmed yet. Check your mobile wallet or contact the kitchen before trying again.");
      throw new Error(data?.error ?? "Your payment has not been confirmed yet.");
    }

    clearPendingOrder();
    setPendingPayment(null);
    setPaymentReference("");
    setPaymentMessage("");
    setPaymentKind("momo");
    setPlacedTotal(order.total);
    clearBag();
    setSuccess(
      data?.persisted === true && !response.ok
        ? `Payment received and order ${data.orderRef ?? data.orderId ?? ""} saved. The receipt could not be sent, but the kitchen has your order.`
        : `Payment received. Order ${data?.orderRef ?? ""} is confirmed.`,
    );
  }

  async function checkPayment(order: PendingOrder, reference: string) {
    const startedAt = order.attemptStartedAt ?? Date.now();
    const attempt = { ...order, attemptStartedAt: startedAt, lastPaymentState: "pending" as const };
    rememberPendingOrder(attempt);
    setPendingPayment(attempt);
    setPaymentReference(reference);
    setWalletConfirmedUnpaid(false);
    setBusy(true);
    setError("");
    setPaymentTimeLeft(Math.max(0, startedAt + PAYMENT_TIMEOUT_MS - Date.now()));
    setPaymentMessage("Waiting for your mobile money prompt. Approve it on your phone.");
    const controller = new AbortController();
    pollRef.current?.abort();
    pollRef.current = controller;
    try {
      const remainingMs = Math.max(0, startedAt + PAYMENT_TIMEOUT_MS - Date.now());
      let settled: PaymentUpdate;
      if (remainingMs > 0) {
        settled = await waitForPayment(reference, {
          signal: controller.signal,
          intervalMs: 4000,
          timeoutMs: remainingMs,
          onUpdate: (update) => setPaymentMessage(update.message),
        });
      } else {
        try {
          settled = await fetchPaymentStatus(reference);
        } catch {
          settled = {
            transactionId: reference, state: "pending", code: "111",
            message: "The approval timer ended. Check your wallet before retrying.",
            retryable: true, gatewayIssue: false,
          };
        }
      }
      if (controller.signal.aborted) return;
      if (settled.state === "paid" && !settled.gatewayIssue) {
        await finishPaidOrder(order, reference);
        return;
      }
      if (settled.state === "failed" && !settled.gatewayIssue) {
        const failed = { ...attempt, lastPaymentState: "failed" as const };
        rememberPendingOrder(failed);
        setPendingPayment(failed);
        setPaymentMessage(`${settled.message} ${retryGuidance(attempt.retriesUsed ?? 0)}`);
        return;
      }
      setPendingPayment(order);
      setPaymentReference(reference);
      const stillPending = { ...attempt, lastPaymentState: "pending" as const };
      rememberPendingOrder(stillPending);
      setPendingPayment(stillPending);
      setPaymentMessage(`${settled.message} You can retry after the timer expires, or switch to Pay on delivery.`);
    } catch (reason) {
      if (!controller.signal.aborted) {
        setPendingPayment(attempt);
        setPaymentReference(reference);
        setPaymentMessage("We could not confirm the payment yet. Keep the prompt open and check your phone.");
        setError(reason instanceof Error ? reason.message : "Your payment status could not be confirmed.");
      }
    } finally {
      if (pollRef.current === controller) pollRef.current = null;
      if (!controller.signal.aborted) setBusy(false);
    }
  }

  useEffect(() => {
    const returned = readCheckoutReturn(window.location.search);
    if (returned) stripCheckoutParams();
    let cancelled = false;
    void (async () => {
      const pending = readPendingOrder();
      if (returned && (!pending || pending.transactionId !== returned.transactionId)) {
        if (!cancelled) {
          setPaymentBlocked(true);
          setError(`We could not restore the order details for payment reference ${returned.transactionId}. Contact the kitchen before paying again.`);
        }
        return;
      }

      if (!pending || !pending.customerPortal) return;
      const response = await fetch("/api/customer/profile", { cache: "no-store" });
      const data = await response.json().catch(() => null);
      if (!response.ok || data?.ok !== true) {
        throw new Error(data?.error ?? "Your account details could not be loaded.");
      }
      if (cancelled) return;
      if (data.profile.email.toLowerCase() === pending.customer.email.toLowerCase()) {
        if (pending.startUnconfirmed) {
          setPaymentBlocked(true);
          setError("The previous payment attempt could not be confirmed. Check your wallet or contact the kitchen before paying again.");
          return;
        }
        await checkPayment(pending, pending.transactionId);
      } else if (returned) {
        setPaymentBlocked(true);
        setError("Sign in with the account that started this payment. Do not pay again.");
      }
    })().catch((reason: unknown) => {
      if (!cancelled) {
        setPaymentBlocked(true);
        setError(reason instanceof Error ? reason.message : "The previous payment status could not be checked.");
      }
    }).finally(() => {
      if (!cancelled) setRestoringPayment(false);
    });
    return () => { cancelled = true; pollRef.current?.abort(); };
    // Restore only on mount, not when form fields or the bag change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => () => pollRef.current?.abort(), []);

  useEffect(() => {
    if (!pendingPayment?.attemptStartedAt) return;
    const update = () => setPaymentTimeLeft(Math.max(0, pendingPayment.attemptStartedAt! + PAYMENT_TIMEOUT_MS - Date.now()));
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [pendingPayment?.attemptStartedAt]);

  async function retryPayment() {
    if (!pendingPayment || !paymentReference || busy || switchingToDelivery ||
        (pendingPayment.retriesUsed ?? 0) >= MAX_PAYMENT_RETRIES) return;
    setBusy(true);
    setError("");
    setPaymentMessage("Starting a new mobile money prompt…");
    const retryOrder = startPaymentAttempt({
      ...pendingPayment,
      retriesUsed: (pendingPayment.retriesUsed ?? 0) + 1,
    });
    try {
      const started = await startPayment({
        ...retryOrder.customer,
        lines: retryOrder.lines,
        expectedTotal: retryOrder.total,
        acceptedTerms: true,
        network: pendingPayment.network,
        momoNumber: pendingPayment.momoNumber,
        customerPortal: true,
        retryTransactionId: paymentReference,
      });
      const nextAttempt: PendingOrder = {
        ...retryOrder,
        transactionId: started.transactionId,
        total: started.total,
      };
      if (!rememberPendingOrder(nextAttempt)) {
        setPaymentBlocked(true);
        throw new Error("This browser could not save the retry details. Contact the kitchen before trying to pay again.");
      }
      setPendingPayment(nextAttempt);
      setPaymentReference(started.transactionId);
      if (started.mode === "checkout") {
        window.location.assign(started.checkoutUrl);
        return;
      }
      if (started.state === "failed" && !started.gatewayIssue) {
        const failed = { ...nextAttempt, lastPaymentState: "failed" as const };
        rememberPendingOrder(failed);
        setPendingPayment(failed);
        setPaymentMessage(`${started.message} ${retryGuidance(nextAttempt.retriesUsed ?? 0)}`);
        return;
      }
      if (started.state === "paid" && !started.gatewayIssue) {
        await finishPaidOrder(nextAttempt, started.transactionId);
        return;
      }
      await checkPayment(nextAttempt, started.transactionId);
    } catch (reason) {
      let blocked = false;
      if (reason instanceof PaymentError && reason.transactionId) {
        const uncertain = {
          ...retryOrder,
          transactionId: reason.transactionId,
          lastPaymentState: "pending" as const,
        };
        rememberPendingOrder(uncertain);
        setPendingPayment(uncertain);
        setPaymentReference(reason.transactionId);
      } else if (reason instanceof PaymentError && !reason.retryable) {
        setPaymentBlocked(true);
        blocked = true;
        setPaymentMessage("We could not confirm whether the retry started. Do not pay again; contact the kitchen with your current reference.");
      }
      if (!blocked) setPaymentMessage("We couldn't confirm whether the new prompt started. Check your phone before taking another action.");
      setError(reason instanceof Error ? reason.message : "The retry could not be started.");
    } finally {
      setBusy(false);
    }
  }

  async function switchToDelivery() {
    if (!pendingPayment || !paymentReference || busy || switchingToDelivery) return;
    setSwitchingToDelivery(true);
    setError("");
    setPaymentMessage("Switching your order to Pay on delivery…");
    try {
      const response = await fetch("/api/payments/switch-to-delivery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactionId: paymentReference }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || data?.ok !== true) throw new Error(data?.error ?? "We could not switch this order to Pay on delivery.");
      clearPendingOrder();
      setPendingPayment(null);
      setPaymentReference("");
      setPaymentKind("delivery");
      setPlacedTotal(pendingPayment.total);
      clearBag();
      setSuccess(data.receiptSent
        ? `Order ${data.orderRef} is confirmed. Pay on delivery.`
        : `Order ${data.orderRef} is saved. ${data.receiptError ?? "The receipt could not be sent."} Pay on delivery.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "We could not switch this order to Pay on delivery.");
      setPaymentMessage("");
    } finally {
      setSwitchingToDelivery(false);
    }
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || restoringPayment || paymentBlocked || !catalog) return;
    setError("");
    setSuccess("");
    if (pendingPayment) {
      setError("A mobile money payment is still being checked. Confirm its status before starting another payment.");
      return;
    }
    if (!profile) {
      setError("Your account details are not ready yet. Please try again.");
      return;
    }
    if (!/^\+?[0-9]{9,15}$/.test(phone.replace(/\s/g, ""))) {
      setError("Enter a valid phone number so the rider can reach you.");
      return;
    }
    if (lines.some((line) => !line.item)) {
      setError("A menu item is no longer available. Remove it and choose again.");
      return;
    }

    const orderNotes = [`Delivery area: ${area}`, notes.trim()].filter(Boolean).join("\n");
    if (orderNotes.length > 800) {
      setError("Shorten your notes to fit the order details.");
      return;
    }
    if (payMethod === "momo") {
      if (!canPayOnline) {
        setError("Mobile money payment is not available right now. Choose pay on delivery or call the kitchen.");
        return;
      }
      if (!isValidMomoNumber(momoNumber)) {
        setError("Enter a valid Ghana mobile money number, such as 0241234567.");
        return;
      }
      if (!network) {
        setError("Choose your mobile money network.");
        return;
      }

      const order: PendingOrder = {
        customerPortal: true,
        transactionId: "",
        savedAt: 0,
        attemptStartedAt: 0,
        retriesUsed: 0,
        lastPaymentState: "pending",
        total: bagTotal,
        network,
        momoNumber,
        customer: {
          name: name.trim(),
          phone: phone.replace(/\s/g, ""),
          email: profile.email,
          fulfilment: "delivery",
          preferredTime,
          notes: orderNotes,
        },
        lines: lines.map(({ id, qty }) => ({ id, qty })),
      };
      const attemptOrder = startPaymentAttempt(order);
      let activeOrder: PendingOrder | undefined;
      setBusy(true);
      setPaymentMessage("Starting mobile money payment…");
      try {
        const started = await startPayment({
          ...order.customer,
          lines: order.lines,
          expectedTotal: bagTotal,
          acceptedTerms: true,
          network,
          momoNumber,
          customerPortal: true,
        });
        const timedStartedOrder = { ...attemptOrder, transactionId: started.transactionId, total: started.total };
        activeOrder = timedStartedOrder;
        setPendingPayment(timedStartedOrder);
        setPaymentReference(started.transactionId);
        const stored = rememberPendingOrder(timedStartedOrder);
        if (started.mode === "prompt" && started.state === "failed" && !started.gatewayIssue) {
          const failed = { ...timedStartedOrder, lastPaymentState: "failed" as const };
          rememberPendingOrder(failed);
          setPendingPayment(failed);
          setPaymentMessage(`${started.message} ${retryGuidance(timedStartedOrder.retriesUsed ?? 0)}`);
          return;
        }
        if (started.mode === "checkout") {
          if (!stored) {
            throw new Error("This browser could not save the payment details. Contact the kitchen with your reference before continuing.");
          }
          setPaymentMessage("Opening secure payment…");
          window.location.assign(started.checkoutUrl);
          return;
        }
        if (started.state === "paid" && !started.gatewayIssue) {
          await finishPaidOrder(timedStartedOrder, started.transactionId);
          return;
        }
        await checkPayment(timedStartedOrder, started.transactionId);
      } catch (reason) {
        if (reason instanceof PaymentError && reason.transactionId) {
          const uncertainOrder = { ...attemptOrder, transactionId: reason.transactionId };
          rememberPendingOrder(uncertainOrder);
          setPendingPayment(uncertainOrder);
          setPaymentReference(reason.transactionId);
        } else if (!(reason instanceof PaymentError) || !reason.retryable) {
          if (!activeOrder) {
            rememberPendingOrder({ ...attemptOrder, startUnconfirmed: true });
            setPaymentBlocked(true);
          }
        }
        setPaymentMessage("If your wallet shows a debit, do not pay again. Contact the kitchen if the payment cannot be confirmed.");
        setError(reason instanceof PaymentError
          ? reason.message
          : reason instanceof Error
            ? reason.message
            : "The payment could not be started. Choose pay on delivery or try again.");
      } finally {
        setBusy(false);
      }
      return;
    }

    const requestBody = JSON.stringify({
      name: name.trim(),
      phone: phone.replace(/\s/g, ""),
      email: profile.email,
      fulfilment: "delivery",
      preferredTime,
      notes: orderNotes,
      lines: lines.map(({ id, qty }) => ({ id, qty })),
      payment: { method: "delivery" },
      acceptedTerms: true,
    });
    if (submission.current?.body !== requestBody) {
      submission.current = { body: requestBody, key: crypto.randomUUID() };
    }

    setBusy(true);
    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": submission.current.key,
        },
        body: requestBody,
      });
      const data = await response.json().catch(() => null) as OrderResponse | null;
      if ((!response.ok || data?.ok !== true) && data?.persisted !== true) {
        throw new Error(data?.error ?? "Your order could not be placed. Please try again.");
      }

      submission.current = null;
      setPlacedTotal(bagTotal);
      setPaymentKind("delivery");
      clearBag();
      setSuccess(
        data?.persisted === true && !response.ok
          ? `Order ${data.orderRef ?? data.orderId ?? ""} is saved, but its receipt could not be sent. The kitchen has your order.`
          : `Order ${data?.orderRef ?? ""} is confirmed. Pay the rider on delivery.`,
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Your order could not be placed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (success) {
    return (
      <section aria-live="polite">
        <h1 className="font-display text-4xl">Order placed</h1>
        <p className="mt-4 text-base leading-relaxed">{success}</p>
        <p className="text-muted-foreground mt-2">
          Total {formatGhs(placedTotal)} · {paymentKind === "momo" ? "Paid by mobile money." : "Pay on delivery."}
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/app/orders" className="bg-cocoa text-cream inline-flex min-h-12 items-center px-5 font-semibold">
            View my orders
          </Link>
          <Link href="/app" className="border-border inline-flex min-h-12 items-center border px-5 font-semibold">
            Back to menu
          </Link>
        </div>
      </section>
    );
  }

  if (restoringPayment || !ready) {
    return <p role="status" className="text-muted-foreground">Loading your checkout…</p>;
  }

  if (pendingPayment || paymentBlocked) {
    const paymentExpired = paymentTimeLeft <= 0 || pendingPayment?.lastPaymentState === "failed";
    const retriesUsed = pendingPayment?.retriesUsed ?? 0;
    const paymentIsUnconfirmed = pendingPayment?.lastPaymentState !== "failed";
    const paymentFailed = pendingPayment?.lastPaymentState === "failed";
    const secondsLeft = Math.ceil(paymentTimeLeft / 1000);
    const timeLabel = `${String(Math.floor(secondsLeft / 60)).padStart(2, "0")}:${String(secondsLeft % 60).padStart(2, "0")}`;
    return <section>
      <h1 className="font-display text-4xl">Your payment</h1>
      {paymentReference && <p className="mt-4">Reference: {paymentReference}</p>}
      {pendingPayment && (
        <div className="bg-cream mt-5 border border-border p-4">
          {paymentFailed
            ? <p role="status" className="font-display text-2xl">Payment attempt failed</p>
            : <p role="timer" aria-live="off" aria-label={`${secondsLeft} seconds remaining to approve payment`}
                className="font-display text-2xl">
                {paymentExpired ? "Approval time ended" : `Time to approve: ${timeLabel}`}
              </p>}
          <p className="text-muted-foreground mt-2 text-sm">
            Approve the mobile money prompt on your phone. You can retry up to {MAX_PAYMENT_RETRIES} times ({retriesUsed} used).
          </p>
          {paymentExpired && paymentIsUnconfirmed && (
            <label className="mt-3 flex items-start gap-2 text-sm">
              <input type="checkbox" checked={walletConfirmedUnpaid}
                onChange={(event) => setWalletConfirmedUnpaid(event.target.checked)} />
              <span>I checked my mobile wallet and this payment was not taken.</span>
            </label>
          )}
        </div>
      )}
      {paymentMessage && <p role="status" className="mt-4">{paymentMessage}</p>}
      {error && <p role="alert" className="text-destructive mt-4">{error}</p>}
      <div className="mt-6 flex flex-wrap gap-3">
        {pendingPayment && paymentReference && !paymentExpired && !paymentBlocked && (
          <button type="button" disabled={busy || switchingToDelivery}
            onClick={() => void checkPayment(pendingPayment, paymentReference)}
            className="border-border inline-flex min-h-11 items-center border px-4 font-semibold disabled:opacity-60">
            {busy ? "Checking payment…" : "Check payment status"}
          </button>
        )}
        {pendingPayment && paymentExpired && retriesUsed < MAX_PAYMENT_RETRIES && !paymentBlocked && (
          <button type="button" disabled={busy || switchingToDelivery || (paymentIsUnconfirmed && !walletConfirmedUnpaid)}
            onClick={() => void retryPayment()}
            className="bg-cocoa text-cream inline-flex min-h-11 items-center px-4 font-semibold disabled:opacity-60">
            {busy ? "Starting retry…" : `Retry mobile money (${MAX_PAYMENT_RETRIES - retriesUsed} left)`}
          </button>
        )}
        {pendingPayment && paymentExpired && !paymentBlocked && (
          <button type="button" disabled={busy || switchingToDelivery}
            onClick={() => void switchToDelivery()}
            className="border-border inline-flex min-h-11 items-center border px-4 font-semibold disabled:opacity-60">
            {switchingToDelivery ? "Switching…" : "Switch to Pay on delivery"}
          </button>
        )}
      </div>
      <p className="mt-4 text-sm">Need help? Call <a className="underline" href={`tel:${site.followUpPhoneTel}`}>{site.followUpPhoneDisplay}</a>.</p>
    </section>;
  }

  if (bag.length === 0) {
    return (
      <div>
        <h1 className="font-display text-4xl">Your bag is empty</h1>
        <p className="text-muted-foreground mt-3 text-base">Choose a deal or a favourite from the menu to get started.</p>
        <Link href="/app" className="bg-cocoa text-cream mt-6 inline-flex min-h-12 items-center px-5 font-semibold">
          Browse the menu
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="font-display text-4xl">Place your order</h1>
      <p className="text-muted-foreground mt-3 max-w-md text-base leading-relaxed">
        Your order will be saved to your account and shown in the kitchen dashboard.
      </p>

      <ul className="mt-6 divide-y divide-border border-y border-border">
        {lines.map(({ id, qty, item }) => item && (
          <li key={id} className="flex items-center gap-3 py-3">
            <Image src={item.image} alt="" width={56} height={56} className="size-14 rounded-lg object-cover" />
            <span className="min-w-0 flex-1 text-sm">{qty} × {item.name}</span>
            <span className="font-medium">{formatGhs(qty * item.price)}</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 flex justify-between font-semibold">
        <span>Total</span><span>{formatGhs(bagTotal)}</span>
      </p>

      {!profile && !error && <p role="status" className="mt-6">Loading your account details…</p>}
      <form onSubmit={onSubmit} className="mt-8 space-y-5">
        <label className="block">
          <span className="text-sm font-medium">Your name</span>
          <input value={name} onChange={(event) => setName(event.target.value)} required maxLength={100}
            className="border-border mt-2 min-h-12 w-full border bg-transparent px-3 text-base" autoComplete="name" />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Email for your receipt</span>
          <input value={profile?.email ?? ""} readOnly
            className="border-border bg-cream mt-2 min-h-12 w-full border px-3 text-base" />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Phone</span>
          <input value={phone} onChange={(event) => setPhone(event.target.value)} required maxLength={16}
            className="border-border mt-2 min-h-12 w-full border bg-transparent px-3 text-base" autoComplete="tel" inputMode="tel" />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Delivery area</span>
          <select value={area} onChange={(event) => setArea(event.target.value)}
            className="border-border mt-2 min-h-12 w-full border bg-surface px-3 text-base">
            {DELIVERY_AREAS.map((entry) => <option key={entry} value={entry}>{entry}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="text-sm font-medium">Preferred time</span>
          <input type="time" min="12:00" max="23:00" required value={preferredTime}
            onChange={(event) => setPreferredTime(event.target.value)}
            className="border-border mt-2 min-h-12 w-full border bg-surface px-3 text-base" />
          <span className="text-muted-foreground mt-1 block text-xs">Kitchen order window is noon to 11:00 PM.</span>
        </label>
        <label className="block">
          <span className="text-sm font-medium">Order notes</span>
          <textarea rows={3} maxLength={740} value={notes} onChange={(event) => setNotes(event.target.value)}
            placeholder="Add a landmark, spice preference, or other instructions."
            className="border-border mt-2 min-h-24 w-full border bg-transparent px-3 py-2 text-base" />
        </label>
        <fieldset className="border-t border-border pt-5">
          <legend className="mb-2 text-sm font-medium">Payment</legend>
          <div className="flex flex-col gap-2">
            <label className="inline-flex min-h-11 items-center gap-2">
              <input
                type="radio"
                name="payment"
                value="delivery"
                checked={payMethod === "delivery"}
                onChange={() => setPayMethod("delivery")}
              />
              Pay on delivery
            </label>
            {canPayOnline && (
              <label className="inline-flex min-h-11 items-center gap-2">
                <input
                  type="radio"
                  name="payment"
                  value="momo"
                  checked={payMethod === "momo"}
                  onChange={() => setPayMethod("momo")}
                />
                Pay now with mobile money
              </label>
            )}
          </div>
          {payMethod === "momo" && (
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-sm font-medium">Mobile money number</span>
                <input
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel"
                  placeholder="0241234567"
                  value={momoNumber}
                  onChange={(event) => {
                    const value = event.target.value;
                    setMomoNumber(value);
                    const guessed = guessNetwork(value);
                    if (guessed) setNetwork(guessed);
                  }}
                  required
                  className="border-border mt-2 min-h-12 w-full border bg-transparent px-3 text-base"
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium">Network</span>
                <select
                  value={network}
                  onChange={(event) => setNetwork(event.target.value as MomoNetwork | "")}
                  required
                  className="border-border mt-2 min-h-12 w-full border bg-surface px-3 text-base"
                >
                  <option value="">Choose network</option>
                  {momoNetworks.map((option) => (
                    <option key={option.code} value={option.code}>{option.label}</option>
                  ))}
                </select>
              </label>
            </div>
          )}
        </fieldset>
        {paymentMessage && (
          <p role="status" aria-live="polite" className="text-sm leading-relaxed">
            {paymentMessage}
          </p>
        )}
        {error && <p role="alert" className="text-destructive text-sm">{error}</p>}
        <button type="submit" disabled={busy || !profile || !catalog || Boolean(pendingPayment)}
          className="bg-palm text-cream hover:bg-palm/90 inline-flex min-h-12 w-full items-center justify-center px-5 font-semibold disabled:opacity-60 sm:w-auto">
          {busy
            ? payMethod === "momo"
              ? "Checking mobile money…"
              : "Saving your order…"
            : payMethod === "momo"
              ? `Pay ${formatGhs(bagTotal)} now`
              : `Place order · ${formatGhs(bagTotal)}`}
        </button>
        <p className="text-muted-foreground text-sm">
          Questions? Call{" "}
          <a className="underline" href={`tel:${site.followUpPhoneTel}`}>{site.followUpPhoneDisplay}</a>.
        </p>
      </form>
    </div>
  );
}
