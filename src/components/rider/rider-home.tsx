"use client";

import { useEffect, useState } from "react";
import { Bike, CheckCheck, CircleCheck, MessagesSquare } from "lucide-react";
import type { StreamChange } from "@/lib/live/apply";
import { riderRequest } from "./rider-api";
import { RiderRecentOrders } from "./rider-orders";

type Stats = { activeDeliveries: number; completedToday: number; completedDeliveries: number; openSupportRequests: number };

export function RiderDashboardStats({ stats }: { stats: Stats }) {
  const total = stats.activeDeliveries + stats.completedDeliveries;
  const todayShare = stats.completedDeliveries ? Math.min(100, Math.round(stats.completedToday / stats.completedDeliveries * 100)) : 0;
  return <>
    <div className="rider-stats">
      <article><Bike size={22} aria-hidden="true" /><span>Active deliveries</span><strong>{stats.activeDeliveries}</strong></article>
      <article><CircleCheck size={22} aria-hidden="true" /><span>Completed today</span><strong>{stats.completedToday}</strong></article>
      <article><CheckCheck size={22} aria-hidden="true" /><span>All-time deliveries</span><strong>{stats.completedDeliveries}</strong></article>
      <article><MessagesSquare size={22} aria-hidden="true" /><span>Open support requests</span><strong>{stats.openSupportRequests}</strong></article>
    </div>
    <div className="rider-chart-grid">
      <figure className="rider-card rider-chart">
        <figcaption>Delivery overview</figcaption>
        <p>Active and completed deliveries assigned to you.</p>
        {total ? <div className="rider-chart-track" role="img" aria-label={`${stats.activeDeliveries} active deliveries, ${stats.completedDeliveries} completed deliveries`}>
          {stats.activeDeliveries > 0 && <span className="rider-chart-active" style={{ flexGrow: stats.activeDeliveries }} />}
          {stats.completedDeliveries > 0 && <span className="rider-chart-completed" style={{ flexGrow: stats.completedDeliveries }} />}
        </div> : <p className="rider-chart-empty">No deliveries to chart yet.</p>}
        <ul className="rider-chart-legend">
          <li><i className="rider-chart-active" aria-hidden="true" /><span>Active</span><strong>{stats.activeDeliveries}</strong></li>
          <li><i className="rider-chart-completed" aria-hidden="true" /><span>Completed</span><strong>{stats.completedDeliveries}</strong></li>
        </ul>
      </figure>
      <figure className="rider-card rider-chart">
        <figcaption>Today&apos;s deliveries</figcaption>
        <p>Today&apos;s share of your all-time completed deliveries. Accra time.</p>
        {stats.completedDeliveries ? <div className="rider-chart-track" role="img" aria-label={`${stats.completedToday} of ${stats.completedDeliveries} deliveries completed today, ${todayShare}%`}>
          <span className="rider-chart-completed" style={{ width: `${todayShare}%` }} />
        </div> : <p className="rider-chart-empty">No completed deliveries yet.</p>}
        <ul className="rider-chart-legend">
          <li><i className="rider-chart-completed" aria-hidden="true" /><span>Completed today</span><strong>{stats.completedToday}</strong></li>
          <li><i className="rider-chart-previous" aria-hidden="true" /><span>Completed before today</span><strong>{Math.max(0, stats.completedDeliveries - stats.completedToday)}</strong></li>
        </ul>
      </figure>
    </div>
  </>;
}

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
    {stats && <RiderDashboardStats stats={stats} />}
    <RiderRecentOrders />
  </section>;
}
