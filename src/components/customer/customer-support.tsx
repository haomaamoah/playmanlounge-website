"use client";

import { useState } from "react";

export function CustomerSupport() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setError("");
    setNotice("");
    setBusy(true);
    const values = new FormData(form);
    try {
      const profileResponse = await fetch("/api/customer/profile", { cache: "no-store" });
      const profileData = await profileResponse.json().catch(() => null);
      if (!profileResponse.ok || profileData?.ok !== true) throw new Error(profileData?.error ?? "Your account details could not be loaded.");
      const response = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: profileData.profile.name,
          customerEmail: profileData.profile.email,
          phone: profileData.profile.phone,
          subject: String(values.get("subject") ?? ""),
          message: String(values.get("message") ?? ""),
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || data?.ok !== true) throw new Error(data?.error ?? "Your message could not be sent.");
      form.reset();
      setNotice("Your message has been sent. Our team will get back to you.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Your message could not be sent.");
    } finally {
      setBusy(false);
    }
  }

  return <section>
    <h1 className="font-display text-4xl">Support</h1>
    <p className="text-muted-foreground mt-3 max-w-xl leading-relaxed">Send a question to the Play Man Lounge team. Your account contact details are included automatically.</p>
    <form onSubmit={submit} className="mt-8 max-w-xl space-y-5">
      <label className="block">
        <span className="text-sm font-semibold">Subject</span>
        <input name="subject" required minLength={3} maxLength={160}
          className="mt-2 min-h-12 w-full border border-border bg-transparent px-3" />
      </label>
      <label className="block">
        <span className="text-sm font-semibold">Message</span>
        <textarea name="message" required minLength={10} maxLength={4000} rows={6}
          className="mt-2 w-full border border-border bg-transparent px-3 py-3" />
      </label>
      {error && <p role="alert" className="text-destructive text-sm">{error}</p>}
      {notice && <p role="status" className="text-sm font-medium text-green-800">{notice}</p>}
      <button disabled={busy} className="bg-cocoa text-cream inline-flex min-h-12 items-center justify-center px-5 font-semibold disabled:opacity-60">
        {busy ? "Sending…" : "Send message"}
      </button>
    </form>
  </section>;
}
