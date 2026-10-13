"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { formatGhs, site } from "@/lib/content";
import { DELIVERY_AREAS } from "@/lib/mocks/seed";
import { useMockStore } from "@/lib/mocks/store";

type CustomerProfile = { name: string; email: string; phone: string };

type OrderResponse = {
  ok?: boolean;
  orderRef?: string;
  orderId?: string;
  persisted?: boolean;
  error?: string;
};

export function CheckoutView() {
  const { bag, bagTotal, clearBag, resolvedMenu } = useMockStore();
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [area, setArea] = useState<string>(DELIVERY_AREAS[0]);
  const [preferredTime, setPreferredTime] = useState("13:00");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [placedTotal, setPlacedTotal] = useState(0);
  const [busy, setBusy] = useState(false);
  const submission = useRef<{ body: string; key: string } | null>(null);

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
    item: resolvedMenu.find((item) => item.id === line.itemId),
  }));

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
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
        <p className="text-muted-foreground mt-2">Total {formatGhs(placedTotal)} · Pay on delivery.</p>
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
        Your order will be saved to your account and shown in the kitchen dashboard. Pay on delivery.
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
        {error && <p role="alert" className="text-destructive text-sm">{error}</p>}
        <button type="submit" disabled={busy || !profile}
          className="bg-palm text-cream hover:bg-palm/90 inline-flex min-h-12 w-full items-center justify-center px-5 font-semibold disabled:opacity-60 sm:w-auto">
          {busy ? "Saving your order…" : `Place order · ${formatGhs(bagTotal)}`}
        </button>
        <p className="text-muted-foreground text-sm">
          Questions? Call{" "}
          <a className="underline" href={`tel:${site.followUpPhoneTel}`}>{site.followUpPhoneDisplay}</a>.
        </p>
      </form>
    </div>
  );
}
