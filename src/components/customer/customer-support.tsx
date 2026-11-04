"use client";

import { useState } from "react";
import type { SupportRequest } from "@/lib/admin/contracts";
import { Badge, dateLabel } from "@/components/admin/admin-ui";
import { streamMatches } from "@/lib/live/apply";
import { InfiniteScroll, LIST_PAGE_SIZE, useInfiniteList } from "@/components/infinite-list";
import { PortalSearch } from "@/components/portal-search";

export function CustomerSupport() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [revision, setRevision] = useState(0);
  const list = useInfiniteList<SupportRequest>(`${query}:${revision}`, async (offset, signal) => {
    const response = await fetch(`/api/customer/support?q=${encodeURIComponent(query)}&limit=${LIST_PAGE_SIZE}&offset=${offset}`, { cache: "no-store", credentials: "same-origin", signal });
    const data = await response.json().catch(() => null);
    if (!response.ok || data?.ok !== true) throw new Error(data?.error ?? "Could not load your support requests.");
    return { items: data.items as SupportRequest[], total: Number(data.total ?? 0) };
  }, {
    table: "support_requests",
    id: (item) => item.id,
    accept: (row) => streamMatches(query, [row.subject, row.message, row.status]),
  });

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setError("");
    setNotice("");
    setBusy(true);
    const values = new FormData(form);
    try {
      const response = await fetch("/api/customer/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: String(values.get("subject") ?? ""),
          message: String(values.get("message") ?? ""),
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || data?.ok !== true || typeof data.id !== "string") throw new Error(data?.error ?? "Your message could not be sent.");
      form.reset();
      setNotice("Your message has been sent. Our team will get back to you.");
      list.upsert({
        id: data.id,
        subject: String(values.get("subject") ?? ""),
        message: String(values.get("message") ?? ""),
        status: "open",
        customerName: "",
        customerEmail: "",
        phone: "",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }, (item) => item.id);
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
    <section className="mt-12" aria-labelledby="support-history-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="support-history-title" className="font-display text-3xl">Your requests</h2>
        <button type="button" className="min-h-11 rounded border border-border px-4 text-sm font-semibold"
          onClick={() => setRevision((value) => value + 1)}>Refresh requests</button>
      </div>
      <PortalSearch label="Search your support requests by subject, message, or status"
        placeholder="Search subject, message, or status"
        onSearch={setQuery} />
      {list.error && <p role="alert" className="text-destructive">{list.error}</p>}
      {list.loading && <p role="status">Loading your requests…</p>}
      {!list.loading && !list.error && <>
        <p role="status" className="text-muted-foreground text-sm">{list.total} {query ? "matching " : ""}requests</p>
        {list.items.length ? <ul className="mt-4 space-y-4">{list.items.map((item) => <li key={item.id} className="rounded border border-border p-5">
          <div className="flex items-start justify-between gap-3">
            <div><h3 className="font-semibold">{item.subject}</h3><p className="text-muted-foreground mt-1 text-sm">{dateLabel(item.createdAt)}</p></div>
            <Badge value={item.status}>{item.status === "open" ? "Open" : "Closed"}</Badge>
          </div>
          <p className="mt-3 whitespace-pre-wrap break-words">{item.message}</p>
        </li>)}</ul> : <p className="mt-4">{query ? "No matching requests. Try another search or clear it." : "No requests yet. Messages sent from your account will appear here."}</p>}
      </>}
      <InfiniteScroll sentinel={list.sentinel} loadingMore={list.loadingMore} />
    </section>
  </section>;
}
