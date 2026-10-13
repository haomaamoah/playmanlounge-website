"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { formatGhs, pesewas, site, type MenuItem } from "@/lib/content";
import { DELIVERY_AREAS } from "@/lib/mocks/seed";
import { useMockStore } from "@/lib/mocks/store";
import { clearPendingOrder, readPendingOrder, rememberPendingOrder, type PendingOrder } from "@/lib/pending-order";
import { guessNetwork, isValidMomoNumber, momoNetworks, type MomoNetwork } from "@/lib/payments/networks";
import { loadPaymentConfig, PaymentError, readCheckoutReturn, startPayment, stripCheckoutParams, waitForPayment } from "@/lib/payments/client";

type CustomerProfile = { name: string; email: string; phone: string };

type OrderResponse = {
  ok?: boolean;
  orderRef?: string;
  orderId?: string;
  persisted?: boolean;
  error?: string;
  payment?: { method?: string; state?: string };
};

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
  const [paymentBlocked, setPaymentBlocked] = useState(false);
  const [restoringPayment, setRestoringPayment] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [placedTotal, setPlacedTotal] = useState(0);
  const [busy, setBusy] = useState(false);
  const submission = useRef<{ body: string; key: string } | null>(null);
  const [paymentKind, setPaymentKind] = useState<"delivery" | "momo">("delivery");

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
    setPendingPayment(order);
    setPaymentReference(reference);
    setBusy(true);
    setError("");
    setPaymentMessage("Checking your mobile money payment…");
    const controller = new AbortController();
    pollRef.current?.abort();
    pollRef.current = controller;
    try {
      const settled = await waitForPayment(reference, {
        signal: controller.signal,
        intervalMs: 4000,
        timeoutMs: 45_000,
        onUpdate: (update) => setPaymentMessage(update.message),
      });
      if (controller.signal.aborted) return;
      if (settled.state === "paid" && !settled.gatewayIssue) {
        await finishPaidOrder(order, reference);
        return;
      }
      if (settled.state === "failed" && !settled.gatewayIssue) {
        clearPendingOrder();
        setPendingPayment(null);
        setPaymentReference("");
        setPaymentMessage("");
        setError(`${settled.message} Reference: ${reference}`);
        return;
      }
      setPendingPayment(order);
      setPaymentReference(reference);
      setPaymentMessage(`${settled.message} Do not start another payment while this one is unconfirmed.`);
    } catch (reason) {
      if (!controller.signal.aborted) {
        setPendingPayment(order);
        setPaymentReference(reference);
        setPaymentMessage("We could not confirm the payment. Check your mobile wallet or contact the kitchen with your reference before trying again.");
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
        const startedOrder = { ...order, transactionId: started.transactionId, total: started.total };
        activeOrder = startedOrder;
        if (started.mode === "prompt" && started.state === "failed" && !started.gatewayIssue) {
          setError(started.message);
          setPaymentMessage("");
          return;
        }
        setPendingPayment(startedOrder);
        setPaymentReference(started.transactionId);
        const stored = rememberPendingOrder(startedOrder);
        if (started.mode === "checkout") {
          if (!stored) {
            throw new Error("This browser could not save the payment details. Contact the kitchen with your reference before continuing.");
          }
          setPaymentMessage("Opening secure payment…");
          window.location.assign(started.checkoutUrl);
          return;
        }
        if (started.state === "paid" && !started.gatewayIssue) {
          await finishPaidOrder(startedOrder, started.transactionId);
          return;
        }
        await checkPayment(startedOrder, started.transactionId);
      } catch (reason) {
        if (reason instanceof PaymentError && reason.transactionId) {
          const uncertainOrder = { ...order, transactionId: reason.transactionId };
          rememberPendingOrder(uncertainOrder);
          setPendingPayment(uncertainOrder);
          setPaymentReference(reason.transactionId);
        } else if (!(reason instanceof PaymentError) || !reason.retryable) {
          if (!activeOrder) {
            rememberPendingOrder({ ...order, startUnconfirmed: true });
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
    return <section>
      <h1 className="font-display text-4xl">Your payment</h1>
      {paymentReference && <p className="mt-4">Reference: {paymentReference}</p>}
      {paymentMessage && <p role="status" className="mt-4">{paymentMessage}</p>}
      {error && <p role="alert" className="text-destructive mt-4">{error}</p>}
      {pendingPayment && paymentReference && <button type="button" disabled={busy}
        onClick={() => void checkPayment(pendingPayment, paymentReference)}
        className="border-border mt-6 inline-flex min-h-11 items-center border px-4 font-semibold disabled:opacity-60">
        {busy ? "Checking payment…" : "Check payment status"}
      </button>}
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
