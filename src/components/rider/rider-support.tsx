"use client";

import { useState } from "react";
import { InfiniteScroll, LIST_PAGE_SIZE, useInfiniteList } from "@/components/infinite-list";
import { riderRequest } from "./rider-api";

type Ticket = { id: string; subject: string; message: string; status: string; created_at: string };
export function RiderSupport() {
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const list = useInfiniteList<Ticket>(String(revision), (offset, signal) =>
    riderRequest<{ ok: true; items: Ticket[]; total: number }>(`/api/rider/support?limit=${LIST_PAGE_SIZE}&offset=${offset}`, { signal })
      .then((result) => ({ items: result.items, total: result.total })));
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    setBusy(true); setError(""); setNotice("");
    try {
      await riderRequest("/api/rider/support", { method: "POST", body: JSON.stringify({ subject: values.get("subject"), message: values.get("message") }) });
      form.reset(); setRevision((value) => value + 1); setNotice("Your support request was sent.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not submit your request."); }
    finally { setBusy(false); }
  }
  return <section>
    <h1 className="font-display">Rider support</h1>
    <p>Send a request to the Play Man Lounge team.</p>
    <form className="rider-form rider-card" onSubmit={(event) => void submit(event)}>
      <label>Subject<input name="subject" minLength={3} maxLength={160} required /></label>
      <label>Message<textarea name="message" minLength={10} maxLength={4000} rows={5} required /></label>
      <button className="rider-button" disabled={busy}>{busy ? "Sending…" : "Send request"}</button>
    </form>
    {(error || list.error) && <p className="rider-error" role="alert">{error || list.error}</p>}
    {notice && <p className="rider-success" role="status">{notice}</p>}
    <h2>Previous requests</h2>
    {list.loading && <p role="status">Loading your requests…</p>}
    {list.items.map((item) => <article className="rider-card" key={item.id}><strong>{item.subject}</strong><p>{item.message}</p><span>{item.status} · {new Date(item.created_at).toLocaleString()}</span></article>)}
    {!list.loading && !list.items.length && <p>No support requests yet.</p>}
    <InfiniteScroll sentinel={list.sentinel} loadingMore={list.loadingMore} />
  </section>;
}
