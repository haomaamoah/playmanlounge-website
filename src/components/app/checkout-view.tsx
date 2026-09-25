"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatGhs, site } from "@/lib/content";
import { DELIVERY_AREAS } from "@/lib/mocks/seed";
import { useMockStore } from "@/lib/mocks/store";
import type { MomoNetwork } from "@/lib/mocks/types";

export function CheckoutView() {
  const router = useRouter();
  const { bag, bagTotal, placeMockOrder } = useMockStore();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [area, setArea] = useState<string>(DELIVERY_AREAS[0]);
  const [network, setNetwork] = useState<MomoNetwork>("mtn");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (bag.length === 0 && !busy) {
    return (
      <div>
        <h1 className="font-display text-4xl">Nothing to pay</h1>
        <p className="text-muted-foreground mt-3 text-base">
          Put something in the bag first.
        </p>
      </div>
    );
  }

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (!name.trim()) {
      setError("Write your name so the rider knows who to call.");
      return;
    }
    if (phone.replace(/\s/g, "").length < 9) {
      setError("Give a Ghana number we can call.");
      return;
    }
    setBusy(true);
    const order = placeMockOrder({
      customerName: name,
      customerPhone: phone,
      deliveryArea: area,
      network,
    });
    if (!order) {
      setBusy(false);
      setError("The bag emptied before we could take the order. Add plates again.");
      return;
    }
    router.push(`/app/status/${order.id}`);
  }

  return (
    <div>
      <h1 className="font-display text-4xl">Pay the kitchen</h1>
      <p className="text-muted-foreground mt-3 max-w-md text-base leading-relaxed">
        This button does not debit MoMo yet. It stamps the order as paid so we
        can design the kitchen board. Total {formatGhs(bagTotal)}.
      </p>
      <form onSubmit={onSubmit} className="mt-8 space-y-5">
        <label className="block">
          <span className="text-sm font-medium">Your name</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="border-border mt-2 h-12 w-full border bg-transparent px-3 text-base"
            autoComplete="name"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Phone</span>
          <input
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            className="border-border mt-2 h-12 w-full border bg-transparent px-3 text-base"
            autoComplete="tel"
            inputMode="tel"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Where should it go?</span>
          <select
            value={area}
            onChange={(event) => setArea(event.target.value)}
            className="border-border mt-2 h-12 w-full border bg-surface px-3 text-base"
          >
            {DELIVERY_AREAS.map((entry) => (
              <option key={entry} value={entry}>
                {entry}
              </option>
            ))}
          </select>
        </label>
        <fieldset>
          <legend className="text-sm font-medium">MoMo network (for the mock receipt)</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {(
              [
                ["mtn", "MTN"],
                ["telecel", "Telecel"],
                ["airteltigo", "AirtelTigo"],
              ] as const
            ).map(([value, label]) => (
              <label
                key={value}
                className={`inline-flex min-h-11 cursor-pointer items-center border px-3 text-sm font-medium ${
                  network === value
                    ? "border-cocoa bg-cocoa text-cream"
                    : "border-border"
                }`}
              >
                <input
                  type="radio"
                  name="network"
                  value={value}
                  checked={network === value}
                  onChange={() => setNetwork(value)}
                  className="sr-only"
                />
                {label}
              </label>
            ))}
          </div>
        </fieldset>
        {error ? (
          <p className="text-destructive text-sm" role="alert">
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={busy}
          className="bg-palm text-cream hover:bg-palm/90 inline-flex min-h-12 w-full items-center justify-center px-5 font-semibold disabled:opacity-60 sm:w-auto"
        >
          {busy ? "Stamping paid…" : `Pay now · ${formatGhs(bagTotal)}`}
        </button>
        <p className="text-muted-foreground text-sm">
          After this preview, follow up on{" "}
          <a className="underline" href={`tel:${site.followUpPhoneTel}`}>
            {site.followUpPhoneDisplay}
          </a>
          .
        </p>
      </form>
    </div>
  );
}
