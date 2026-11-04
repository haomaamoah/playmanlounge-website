"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { StreamChange } from "@/lib/live/apply";
import { riderRequest } from "./rider-api";

type Stats = { activeDeliveries: number; completedToday: number; completedDeliveries: number; openSupportRequests: number };

export function RiderHome() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    let request = new AbortController();
    const load = () => {
      request.abort();
      request = new AbortController();
      const { signal } = request;
      riderRequest<{ ok: true; stats: Stats }>("/api/rider/dashboard", { signal })
        .then((result) => { if (active) { setStats(result.stats); setError(""); } })
        .catch((reason: Error) => { if (active && !signal.aborted) setError(reason.message); });
    };
    load();
    const onStream = (event: Event) => {
      const change = (event as CustomEvent<StreamChange>).detail;
      if (change.table === "orders" || change.table === "rider_support_requests") load();
    };
    window.addEventListener("pml-stream", onStream);
    return () => {
      active = false;
      request.abort();
      window.removeEventListener("pml-stream", onStream);
    };
  }, []);
  return <section>
    <h1 className="font-display">Your rider dashboard</h1>
    <p>Keep deliveries moving and your details up to date.</p>
    {error && <p className="rider-error" role="alert">{error}</p>}
    {!stats && !error && <p role="status">Loading delivery stats…</p>}
    {stats && <div className="rider-stats">
      <article><span>Active deliveries</span><strong>{stats.activeDeliveries}</strong></article>
      <article><span>Completed today</span><strong>{stats.completedToday}</strong></article>
      <article><span>All-time deliveries</span><strong>{stats.completedDeliveries}</strong></article>
      <article><span>Open support requests</span><strong>{stats.openSupportRequests}</strong></article>
    </div>}
    <div className="rider-actions">
      <Link className="rider-button" href="/rider/orders">View delivery orders</Link>
      <Link className="rider-button rider-button-secondary" href="/rider/settings">Update bike details</Link>
    </div>
  </section>;
}
