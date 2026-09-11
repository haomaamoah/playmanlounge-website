"use client";

import { useId, useRef, useState } from "react";
import { formatGhs, site } from "@/lib/content";
import { useOrder } from "@/lib/order-context";
import {
  businessEmail,
  formatOrderBody,
  formatOrderSubject,
  mailtoHref,
  type Fulfilment,
  type OrderPayload,
} from "@/lib/email";

type FieldErrors = Partial<
  Record<"name" | "phone" | "email" | "fulfilment" | "preferredTime" | "cart", string>
>;

function validate(order: OrderPayload): FieldErrors {
  const errors: FieldErrors = {};
  if (!order.name.trim()) errors.name = "Enter your name.";
  const phone = order.phone.replace(/\s/g, "");
  if (!phone) errors.phone = "Enter a phone number we can call.";
  else if (!/^\+?[0-9]{9,15}$/.test(phone))
    errors.phone = "Use a number with country code, like +233578141242.";
  if (!order.email.trim()) errors.email = "Enter your email.";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(order.email))
    errors.email = "Enter an email we can reply to.";
  if (!order.fulfilment) errors.fulfilment = "Choose pickup or delivery.";
  if (!order.preferredTime) errors.preferredTime = "Choose a time between 12:00 and 23:00.";
  if (order.lines.length === 0) errors.cart = "Add at least one menu item.";
  return errors;
}

export function OrderSection() {
  const { lines, total, setQty, remove, clear } = useOrder();
  const formId = useId();
  const summaryRef = useRef<HTMLDivElement>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [fulfilment, setFulfilment] = useState<Fulfilment>("pickup");
  const [preferredTime, setPreferredTime] = useState("13:00");
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [status, setStatus] = useState<
    | { kind: "idle" }
    | { kind: "sending" }
    | { kind: "success"; summary: string; via: "email" | "mailto" | "mock"; orderRef?: string }
    | { kind: "error"; message: string }
  >({ kind: "idle" });

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const payload: OrderPayload = {
      name,
      phone,
      email,
      fulfilment,
      preferredTime,
      notes,
      lines,
      total,
    };
    const nextErrors = validate(payload);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      setStatus({ kind: "idle" });
      requestAnimationFrame(() => summaryRef.current?.focus());
      return;
    }

    const subject = formatOrderSubject(payload);
    const body = formatOrderBody(payload);
    setStatus({ kind: "sending" });

    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          phone,
          email,
          fulfilment,
          preferredTime,
          notes,
          lines: lines.map((line) => ({ id: line.item.id, qty: line.qty })),
          company: "",
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        via?: "brevo" | "resend" | "mock";
        orderRef?: string;
        reason?: string;
        errors?: FieldErrors;
      };

      if (res.ok && data.ok) {
        setStatus({
          kind: "success",
          summary: body,
          via: data.via === "mock" ? "mock" : "email",
          orderRef: data.orderRef,
        });
        clear();
        return;
      }

      if (res.status === 400 && data.errors) {
        setErrors(data.errors);
        setStatus({ kind: "idle" });
        requestAnimationFrame(() => summaryRef.current?.focus());
        return;
      }

      if (res.status === 502) {
        setStatus({
          kind: "error",
          message:
            "The order emails did not send. Call us or try again in a minute.",
        });
        return;
      }
    } catch {
      /* fall through to mailto */
    }

    window.location.href = mailtoHref(businessEmail(), subject, body);
    setStatus({ kind: "success", summary: body, via: "mailto" });
  }

  const field = (id: string) => `${formId}-${id}`;

  return (
    <section id="order" aria-labelledby="order-heading" className="bg-card py-16 sm:py-24">
      <div className="mx-auto grid max-w-6xl gap-12 px-4 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div>
          <h2 id="order-heading" className="font-display text-4xl sm:text-5xl">
            Make an Order
          </h2>
          <p className="mt-3 max-w-md text-base leading-relaxed">
            Build a bag from the menu. Email this order and we send a pictured
            receipt to you and to the kiosk ({businessEmail()}). If that fails, call{" "}
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
                    className="flex items-center justify-between gap-3 py-3"
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
          {status.kind === "error" && (
            <p role="alert" className="border-destructive text-destructive mb-6 border p-4">
              {status.message}{" "}
              <a className="underline" href={`tel:${site.phoneTel}`}>
                {site.phoneDisplay}
              </a>
            </p>
          )}
          {status.kind === "success" && (
            <div className="border-cocoa mb-6 border p-4" role="status">
              <p className="font-semibold">
                {status.via === "email"
                  ? `Receipt ${status.orderRef ?? ""} sent to your inbox. The kiosk got a kitchen copy too.`
                  : status.via === "mock"
                    ? `Preview mode — receipts were not emailed. Ticket ${status.orderRef ?? ""} is saved on this machine.`
                    : "Your mail app should open with the order filled in. Send it to complete."}
              </p>
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
              <legend className="mb-2 text-sm font-medium">Pickup or delivery</legend>
              <div className="flex flex-col gap-2 sm:flex-row sm:gap-6">
                <label className="inline-flex min-h-11 items-center gap-2">
                  <input
                    type="radio"
                    name="fulfilment"
                    value="pickup"
                    checked={fulfilment === "pickup"}
                    onChange={() => setFulfilment("pickup")}
                  />
                  Pickup at the kiosk
                </label>
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
              </div>
              {errors.fulfilment && (
                <p className="text-destructive mt-1 text-sm">{errors.fulfilment}</p>
              )}
            </fieldset>
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
                We cook from noon to 11:00 PM.
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
              disabled={status.kind === "sending"}
              className="bg-cocoa text-cream hover:bg-cocoa-deep inline-flex min-h-12 w-full items-center justify-center px-6 text-base font-semibold disabled:opacity-60"
            >
              {status.kind === "sending" ? "Sending order…" : "Email this order"}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
