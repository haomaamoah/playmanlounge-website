"use client";

import { useEffect, useState } from "react";
import { riderRequest } from "./rider-api";

type Ticket = { id: string; subject: string; message: string; status: string; created_at: string };
export function RiderSupport() {
  const [items, setItems] = useState<Ticket[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    riderRequest<{ ok: true; items: Ticket[] }>("/api/rider/support", { signal: controller.signal })
      .then((result) => { if (!controller.signal.aborted) setItems(result.items); })
      .catch((reason: Error) => { if (!controller.signal.aborted) setError(reason.message); });
    return () => controller.abort();
  }, [revision]);
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
    {error && <p className="rider-error" role="alert">{error}</p>}
    {notice && <p className="rider-success" role="status">{notice}</p>}
    <h2>Previous requests</h2>
    {items.map((item) => <article className="rider-card" key={item.id}><strong>{item.subject}</strong><p>{item.message}</p><span>{item.status} · {new Date(item.created_at).toLocaleString()}</span></article>)}
    {!items.length && <p>No support requests yet.</p>}
  </section>;
}
