"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { riderRequest } from "./rider-api";

type Stats = { activeDeliveries: number; completedToday: number; completedDeliveries: number; openSupportRequests: number };

export function RiderHome() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    riderRequest<{ ok: true; stats: Stats }>("/api/rider/dashboard", { signal: controller.signal })
      .then((result) => { if (!controller.signal.aborted) setStats(result.stats); })
      .catch((reason: Error) => { if (!controller.signal.aborted) setError(reason.message); });
    return () => controller.abort();
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
