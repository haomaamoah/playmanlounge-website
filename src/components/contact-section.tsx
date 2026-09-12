"use client";

import { useId, useRef, useState } from "react";
import { site } from "@/lib/content";
import {
  contactEmail,
  mailtoHref,
  submitViaWeb3Forms,
  web3formsKey,
} from "@/lib/email";

type Errors = Partial<Record<"name" | "email" | "message", string>>;

export function ContactSection() {
  const formId = useId();
  const summaryRef = useRef<HTMLDivElement>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [status, setStatus] = useState<
    | { kind: "idle" }
    | { kind: "sending" }
    | { kind: "success"; via: "web3forms" | "mailto" }
    | { kind: "error"; message: string }
  >({ kind: "idle" });

  const field = (id: string) => `${formId}-${id}`;

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const next: Errors = {};
    if (!name.trim()) next.name = "Enter your name.";
    if (!email.trim()) next.email = "Enter your email.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      next.email = "Enter an email we can reply to.";
    if (!message.trim()) next.message = "Write a short message.";
    setErrors(next);
    if (Object.keys(next).length) {
      requestAnimationFrame(() => summaryRef.current?.focus());
      return;
    }

    const subject = `${site.name} contact from ${name}`;
    const body = [
      `Name: ${name}`,
      `Email: ${email}`,
      `Phone: ${phone || "(not given)"}`,
      "",
      message,
    ].join("\n");

    setStatus({ kind: "sending" });
    if (web3formsKey()) {
      try {
        const result = await submitViaWeb3Forms({
          subject,
          fromName: name,
          fromEmail: email,
          message: body,
        });
        if (result.ok) {
          setStatus({ kind: "success", via: "web3forms" });
          setName("");
          setEmail("");
          setPhone("");
          setMessage("");
          return;
        }
      } catch {
        setStatus({
          kind: "error",
          message: "The message did not send. Call us instead.",
        });
        return;
      }
    }
    window.location.href = mailtoHref(contactEmail(), subject, body);
    setStatus({ kind: "success", via: "mailto" });
  }

  return (
    <section
      id="contact"
      aria-labelledby="contact-heading"
      className="bg-surface py-16 sm:py-24"
    >
      <div className="mx-auto grid max-w-6xl gap-12 px-4 sm:px-6 lg:grid-cols-2">
        <div>
          <h2 id="contact-heading" className="font-display text-4xl sm:text-5xl">
            Contact Us
          </h2>
          <address className="mt-6 not-italic">
            <p className="font-medium">{site.addressLine}</p>
            <p>{site.area}</p>
            <p className="text-muted-foreground mt-1 text-sm">Plus code {site.plusCode}</p>
          </address>
          <p className="mt-4 max-w-md text-base leading-relaxed">
            {site.locationNote} To book an event or ask about a delivery, call or
            email us.
          </p>
          <p className="mt-4">
            <a className="min-h-11 font-medium underline" href={`tel:${site.phoneTel}`}>
              {site.phoneDisplay}
            </a>
          </p>
          <p className="mt-2">
            <a className="underline" href={`mailto:${contactEmail()}`}>
              {contactEmail()}
            </a>
          </p>
          <p className="mt-4">
            <span className="font-medium">{site.hoursLabel}: </span>
            {site.hours}, {site.hoursDays}
          </p>
          <p className="mt-6 max-w-md text-base leading-relaxed">
            “{site.review.quote}” — {site.review.author}
          </p>
          <p className="mt-4 flex flex-wrap gap-4 text-sm">
            <a className="underline" href={site.socials.instagram}>
              Instagram
            </a>
            <a className="underline" href={site.socials.facebook}>
              Facebook
            </a>
            <a className="underline" href={site.socials.tiktok}>
              TikTok
            </a>
          </p>
          <div className="border-border mt-8 overflow-hidden border">
            <iframe
              title="Map of Play Man Lounge in Kaneshie, Accra"
              src={site.mapsEmbed}
              className="h-64 w-full max-w-full"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
            <a
              href={site.mapsUrl}
              className="inline-flex min-h-11 items-center px-3 text-sm underline"
            >
              Open in Google Maps
            </a>
          </div>
        </div>

        <form onSubmit={onSubmit} noValidate className="bg-card p-5 sm:p-8">
          <h3 className="font-display text-2xl">Email us</h3>
          {Object.keys(errors).length > 0 && (
            <div
              ref={summaryRef}
              tabIndex={-1}
              role="alert"
              className="border-destructive text-destructive mt-4 border p-4"
            >
              <p className="font-semibold">There is a problem</p>
              <ul className="mt-2 list-disc pl-5 text-sm">
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
            <p role="alert" className="text-destructive mt-4">
              {status.message}{" "}
              <a className="underline" href={`tel:${site.phoneTel}`}>
                {site.phoneDisplay}
              </a>
            </p>
          )}
          {status.kind === "success" && (
            <p role="status" className="mt-4 font-medium">
              {status.via === "web3forms"
                ? "Message sent. We will reply from the business email."
                : "Your mail app should open with the message filled in. Send it to complete."}
            </p>
          )}
          <div className="mt-5 space-y-5">
            <div>
              <label htmlFor={field("name")} className="mb-1 block text-sm font-medium">
                Name
              </label>
              <input
                id={field("name")}
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
                aria-invalid={!!errors.name}
                className="border-input min-h-11 w-full border bg-background px-3"
              />
              {errors.name && (
                <p className="text-destructive mt-1 text-sm">{errors.name}</p>
              )}
            </div>
            <div>
              <label htmlFor={field("email")} className="mb-1 block text-sm font-medium">
                Email
              </label>
              <input
                id={field("email")}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                aria-invalid={!!errors.email}
                className="border-input min-h-11 w-full border bg-background px-3"
              />
              {errors.email && (
                <p className="text-destructive mt-1 text-sm">{errors.email}</p>
              )}
            </div>
            <div>
              <label htmlFor={field("phone")} className="mb-1 block text-sm font-medium">
                Phone <span className="text-muted-foreground font-normal">(optional)</span>
              </label>
              <input
                id={field("phone")}
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                autoComplete="tel"
                className="border-input min-h-11 w-full border bg-background px-3"
              />
            </div>
            <div>
              <label htmlFor={field("message")} className="mb-1 block text-sm font-medium">
                Message
              </label>
              <textarea
                id={field("message")}
                rows={5}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                aria-invalid={!!errors.message}
                className="border-input min-h-28 w-full border bg-background px-3 py-2"
              />
              {errors.message && (
                <p className="text-destructive mt-1 text-sm">{errors.message}</p>
              )}
            </div>
            <button
              type="submit"
              disabled={status.kind === "sending"}
              className="bg-cocoa text-cream hover:bg-cocoa-deep inline-flex min-h-12 w-full items-center justify-center px-6 font-semibold disabled:opacity-60"
            >
              {status.kind === "sending" ? "Sending…" : "Send message"}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
