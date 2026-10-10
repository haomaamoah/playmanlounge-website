"use client";

import Link from "next/link";
import type { Dashboard } from "@/lib/admin/contracts";
import { formatGhs } from "@/lib/content";
import { EmptyState, OrderTable, PageHeading, ResourceState, useAdminResource } from "./admin-ui";

export function HomeDashboard() {
  const { data, loading, error, reload } = useAdminResource<{ ok: true; dashboard: Dashboard }>("/api/admin/dashboard");
  const dashboard = data?.dashboard;
  return <>
    <PageHeading title="Home" description="A live view of the kitchen. All-time totals from your orders and customer requests." action={<button className="admin-button admin-button-secondary" onClick={reload}>Refresh</button>} />
    <ResourceState loading={loading} error={error} retry={reload} />
    {dashboard && <>
      <section className="admin-report" aria-labelledby="orders-overview">
        <div className="admin-section-heading"><h2 id="orders-overview">Orders & payments</h2><Link href="/admin/orders">View all orders</Link></div>
        <dl className="admin-stats">
          <div><dt>Orders created</dt><dd>{dashboard.totalOrders}</dd></div>
          <div className="admin-stat-paid"><dt>Paid</dt><dd>{dashboard.paidOrders}</dd></div>
          <div className="admin-stat-pending"><dt>Pending payment</dt><dd>{dashboard.pendingOrders}</dd></div>
          <div className="admin-stat-cod"><dt>Pay on delivery</dt><dd>{dashboard.codOrders}</dd></div>
          <div className="admin-stat-failed"><dt>Failed payments</dt><dd>{dashboard.failedPayments}</dd></div>
        </dl>
        <div className="admin-revenue"><span>Paid revenue</span><strong>{formatGhs(dashboard.revenue)}</strong><small>Excludes pending, failed and pay-on-delivery orders.</small></div>
        <p className="admin-footnote">Demo records are excluded from all totals{dashboard.demoOrders || dashboard.demoSupport ? ` (${dashboard.demoOrders} demo orders, ${dashboard.demoSupport} demo support requests)` : ""}.</p>
      </section>
      <div className="admin-home-secondary">
        <section className="admin-summary"><h2>Customer care</h2><p><strong>{dashboard.openSupport}</strong> open requests <span>· {dashboard.closedSupport} closed</span></p><Link href="/admin/support">Open support desk</Link></section>
        <section className="admin-summary"><h2>On the menu</h2><p><strong>{dashboard.menuItems}</strong> menu items</p><Link href="/admin/menu">Manage the menu</Link></section>
      </div>
      <section className="admin-report"><div className="admin-section-heading"><h2>Recent orders</h2><span>Latest activity</span></div>
        {dashboard.recentOrders.length ? <OrderTable items={dashboard.recentOrders} /> : <EmptyState title="Your first order will appear here">New customer orders will populate this live activity list.</EmptyState>}
      </section>
    </>}
  </>;
}
