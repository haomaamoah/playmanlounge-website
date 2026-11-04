"use client";

import Link from "next/link";
import { Banknote, CircleCheck, CircleX, ClipboardList, Clock3, Download, MessagesSquare, ShieldCheck, UsersRound, UtensilsCrossed, Wallet } from "lucide-react";
import type { Dashboard } from "@/lib/admin/contracts";
import { dashboardSummaryCsv, downloadCsv, recentOrdersCsv } from "@/lib/admin/dashboard-export";
import { formatGhs } from "@/lib/content";
import { EmptyState, OrderTable, PageHeading, ResourceState, useAdminBasePath, useAdminResource } from "./admin-ui";

function ShareBar({ title, segments }: {
  title: string;
  segments: { key: string; label: string; value: number; tone: string }[];
}) {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  const summary = segments.map((segment) => `${segment.label} ${segment.value}`).join(", ");
  return (
    <figure className="admin-share">
      <figcaption>{title}</figcaption>
      {total === 0 ? (
        <p>Nothing to chart yet.</p>
      ) : (
        <div className="admin-mix" role="img" aria-label={summary}>
          {segments.filter((segment) => segment.value > 0).map((segment) => (
            <span key={segment.key} className={segment.tone} style={{ flexGrow: segment.value }} />
          ))}
        </div>
      )}
      <ul>
        {segments.map((segment) => (
          <li key={segment.key}>
            <i className={segment.tone} aria-hidden="true" />
            <span>{segment.label}</span>
            <strong>{segment.value}</strong>
            <small>{total ? `${Math.round((segment.value / total) * 100)}%` : "0%"}</small>
          </li>
        ))}
      </ul>
    </figure>
  );
}

export function DashboardStats({ dashboard }: { dashboard: Dashboard }) {
  return <dl className={`admin-stats${dashboard.adminCount !== null ? " admin-stats-manager" : ""}`}>
    <div><dt><ClipboardList size={22} aria-hidden="true" /><span>Orders created</span></dt><dd>{dashboard.totalOrders}</dd></div>
    <div className="admin-stat-paid"><dt><CircleCheck size={22} aria-hidden="true" /><span>Paid</span></dt><dd>{dashboard.paidOrders}</dd></div>
    <div className="admin-stat-pending"><dt><Clock3 size={22} aria-hidden="true" /><span>Pending payment</span></dt><dd>{dashboard.pendingOrders}</dd></div>
    <div className="admin-stat-cod"><dt><Banknote size={22} aria-hidden="true" /><span>Pay on delivery</span></dt><dd>{dashboard.codOrders}</dd></div>
    <div className="admin-stat-failed"><dt><CircleX size={22} aria-hidden="true" /><span>Failed payments</span></dt><dd>{dashboard.failedPayments}</dd></div>
    {dashboard.adminCount !== null && <div className="admin-stat-admins"><dt><ShieldCheck size={22} aria-hidden="true" /><span>Administrators</span></dt><dd>{dashboard.adminCount}</dd></div>}
  </dl>;
}

export function HomeDashboard() {
  const basePath = useAdminBasePath();
  const { data, loading, error, reload, setData } = useAdminResource<{ ok: true; dashboard: Dashboard }>("/api/admin/dashboard");
  const dashboard = data?.dashboard;
  return <>
    <PageHeading
      title="Home"
      description="A live view of the kitchen. All-time totals from your orders and customer requests."
      action={dashboard ? (
        <div className="admin-heading-actions">
          <button
            type="button"
            className="admin-button admin-button-secondary"
            onClick={() => downloadCsv("playman-kitchen-summary.csv", dashboardSummaryCsv(dashboard))}
          >
            <Download size={16} aria-hidden="true" />
            Download summary
          </button>
          <button
            type="button"
            className="admin-button admin-button-secondary"
            onClick={() => downloadCsv("playman-recent-orders.csv", recentOrdersCsv(dashboard.recentOrders))}
            disabled={dashboard.recentOrders.length === 0}
          >
            <Download size={16} aria-hidden="true" />
            Download recent orders
          </button>
          <button type="button" className="admin-button admin-button-secondary" onClick={reload}>Refresh</button>
        </div>
      ) : (
        <button type="button" className="admin-button admin-button-secondary" onClick={reload}>Refresh</button>
      )}
    />
    <ResourceState loading={loading} error={error} retry={reload} />
    {dashboard && <>
      <section className="admin-report" aria-labelledby="orders-overview">
        <div className="admin-section-heading"><h2 id="orders-overview">Orders & payments</h2><Link href={`${basePath}/orders`}>View all orders</Link></div>
        <DashboardStats dashboard={dashboard} />
        <div className="admin-revenue"><span className="admin-metric-label"><Wallet size={22} aria-hidden="true" />Paid revenue</span><strong>{formatGhs(dashboard.revenue)}</strong><small>Excludes pending, failed and pay-on-delivery orders.</small></div>
        <div className="admin-share-grid">
          <ShareBar
            title="How orders were paid"
            segments={[
              { key: "paid", label: "Paid", value: dashboard.paidOrders, tone: "admin-mix-paid" },
              { key: "pending", label: "Pending payment", value: dashboard.pendingOrders, tone: "admin-mix-pending" },
              { key: "cod", label: "Pay on delivery", value: dashboard.codOrders, tone: "admin-mix-cod" },
              { key: "failed", label: "Failed payments", value: dashboard.failedPayments, tone: "admin-mix-failed" },
            ]}
          />
          <ShareBar
            title="Support requests"
            segments={[
              { key: "open", label: "Open", value: dashboard.openSupport, tone: "admin-mix-open" },
              { key: "closed", label: "Closed", value: dashboard.closedSupport, tone: "admin-mix-closed" },
            ]}
          />
        </div>
      </section>
      <div className="admin-home-secondary">
        <section className="admin-summary"><h2 className="admin-metric-label"><MessagesSquare size={22} aria-hidden="true" />Customer care</h2><p><strong>{dashboard.openSupport}</strong> open requests <span>· {dashboard.closedSupport} closed</span></p><Link href={`${basePath}/support`}>Open support desk</Link></section>
        <section className="admin-summary"><h2 className="admin-metric-label"><UsersRound size={22} aria-hidden="true" />Customers</h2><p><strong>{dashboard.customerCount ?? "—"}</strong> registered customers</p>
          {dashboard.customerCount === null ? <p>Customer records are not set up yet.</p> : null}
          <Link href={`${basePath}/customers`}>View customers</Link>
        </section>
        <section className="admin-summary"><h2 className="admin-metric-label"><UtensilsCrossed size={22} aria-hidden="true" />On the menu</h2><p><strong>{dashboard.menuItems}</strong> menu items</p><Link href={`${basePath}/menu`}>Manage the menu</Link></section>
      </div>
      <section className="admin-report"><div className="admin-section-heading"><h2>Recent orders</h2><span>Latest activity</span></div>
        {dashboard.recentOrders.length ? <OrderTable items={dashboard.recentOrders} onOrderUpdated={(order) => {
          setData((current) => {
            if (!current?.dashboard) return current;
            return {
              ...current,
              dashboard: {
                ...current.dashboard,
                recentOrders: current.dashboard.recentOrders.map((item) => item.id === order.id ? { ...item, ...order } : item),
              },
            };
          });
        }} /> : <EmptyState title="Your first order will appear here">New customer orders will populate this live activity list.</EmptyState>}
      </section>
    </>}
  </>;
}
